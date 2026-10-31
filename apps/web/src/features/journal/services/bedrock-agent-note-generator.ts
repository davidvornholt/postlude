/**
 * Writes the agent note with Claude Sonnet 5.5 on Amazon Bedrock.
 *
 * The region and the EU inference profile are fixed here rather than
 * configured, because the journal text must be processed only in EU regions
 * and a global profile must never be one setting away.
 *
 * No failure that reaches the log or the page carries the prompt, the journal
 * text, the answer, or a credential.
 */

import {
  BedrockRuntimeClient,
  type BedrockRuntimeClientConfig,
  ConverseCommand,
  type ConverseCommandInput,
  type ConverseCommandOutput,
} from '@aws-sdk/client-bedrock-runtime';
import { Data, Duration, Effect, Layer, Schedule } from 'effect';

import { agentNotePromptOf } from '../agent-note-prompt.ts';
import { agentNoteTextOf } from '../agent-note-text.ts';
import { AgentNoteGenerationError } from '../errors/journal-errors.ts';
import { notConfiguredMessage } from '../evening-messages.ts';
import {
  AgentNoteGenerator,
  type AgentNoteInput,
} from './agent-note-generator.ts';

export const bedrockRegion = 'eu-central-1';

/** The EU geographic profile. Never a global one; see the module comment. */
export const agentNoteInferenceProfile = 'eu.anthropic.claude-sonnet-5-5';

export const agentNoteModelName = 'Claude Sonnet 5.5 (Amazon Bedrock, EU)';

/**
 * Room for the short thinking low effort does and for a note of a few
 * sentences. It also caps what one note can cost.
 */
const outputTokens = 2048;

/** One attempt; with the retries this stays inside `agentNoteTimeout`. */
const attemptTimeout = Duration.minutes(2);

const retrySchedule = Schedule.max([
  Schedule.exponential(Duration.seconds(2)),
  Schedule.recurs(2),
]);

export const partlyConfiguredMessage =
  'Model access for agent notes is only partly set up, so no note was written.';
export const accessDeniedMessage =
  'The model service refused access, so no note was written. Its spending limit may have been reached, or its credentials need attention.';
export const requestFailedMessage =
  'The model service could not write the note just now. Ask for a new one to try again.';
export const unusableAnswerMessage =
  "The model's answer could not be used as a note. Ask for a new one to try again.";

/** Sends one Converse request; the signal aborts it. */
export type Converse = (
  request: ConverseCommandInput,
  signal: AbortSignal,
) => Promise<ConverseCommandOutput>;

/**
 * What of a failed request may be logged. An SDK error can echo the request,
 * so only its name, HTTP status and request ID are kept, which are enough to
 * find the request in AWS.
 */
type FailureSummary = {
  readonly name: string;
  readonly status: number | null;
  readonly requestId: string | null;
};

const summaryOf = (error: unknown): FailureSummary => {
  if (typeof error !== 'object' || error === null) {
    return { name: typeof error, status: null, requestId: null };
  }
  const name =
    'name' in error && typeof error.name === 'string' ? error.name : 'unknown';
  const metadata =
    '$metadata' in error &&
    typeof error.$metadata === 'object' &&
    error.$metadata !== null
      ? (error.$metadata as { httpStatusCode?: unknown; requestId?: unknown })
      : {};
  return {
    name,
    status:
      typeof metadata.httpStatusCode === 'number'
        ? metadata.httpStatusCode
        : null,
    requestId:
      typeof metadata.requestId === 'string' ? metadata.requestId : null,
  };
};

class RequestFailure extends Data.TaggedError('RequestFailure')<{
  readonly summary: FailureSummary;
}> {}

const unauthorized = 401;
const forbidden = 403;
const requestTimeout = 408;
const tooManyRequests = 429;
const internalServerError = 500;
const badGateway = 502;
const serviceUnavailable = 503;
const gatewayTimeout = 504;

/** Refused credentials, or the deny policy the spending limit attaches. */
const refusedStatuses = new Set([unauthorized, forbidden]);

/** Statuses another attempt may get past: throttling and server errors. */
const transientStatuses = new Set([
  requestTimeout,
  tooManyRequests,
  internalServerError,
  badGateway,
  serviceUnavailable,
  gatewayTimeout,
]);

const isTransient = (failure: RequestFailure) =>
  failure.summary.name === 'TimeoutError' ||
  transientStatuses.has(failure.summary.status ?? 0);

const generationErrorOf = (failure: RequestFailure) =>
  new AgentNoteGenerationError({
    message: refusedStatuses.has(failure.summary.status ?? 0)
      ? accessDeniedMessage
      : requestFailedMessage,
    cause: failure.summary,
  });

const requestOf = (input: AgentNoteInput): ConverseCommandInput => {
  const prompt = agentNotePromptOf(input);
  return {
    modelId: agentNoteInferenceProfile,
    system: prompt.system.map((text) => ({ text })),
    messages: [{ role: 'user', content: [{ text: prompt.data }] }],
    inferenceConfig: { maxTokens: outputTokens },
    additionalModelRequestFields: {
      thinking: { type: 'adaptive' },
      // biome-ignore lint/style/useNamingConvention: Anthropic's Bedrock wire field.
      output_config: { effort: 'low' },
    },
  };
};

const noteOf = (response: ConverseCommandOutput) => {
  const answer =
    response.output?.message?.content
      ?.flatMap((block) => (block.text === undefined ? [] : [block.text]))
      .join('') ?? '';
  const note =
    response.stopReason === 'end_turn' ? agentNoteTextOf(answer) : undefined;
  return note === undefined
    ? Effect.fail(
        new AgentNoteGenerationError({
          message: unusableAnswerMessage,
          cause: { stopReason: response.stopReason ?? null },
        }),
      )
    : Effect.succeed({ note, model: agentNoteModelName });
};

export const bedrockAgentNoteGenerator = (converse: Converse) =>
  AgentNoteGenerator.of({
    generate: (input) =>
      Effect.tryPromise({
        try: (signal) => converse(requestOf(input), signal),
        catch: (error) => new RequestFailure({ summary: summaryOf(error) }),
      }).pipe(
        Effect.timeoutOrElse({
          duration: attemptTimeout,
          orElse: () =>
            Effect.fail(
              new RequestFailure({
                summary: {
                  name: 'TimeoutError',
                  status: null,
                  requestId: null,
                },
              }),
            ),
        }),
        Effect.retry({ schedule: retrySchedule, while: isTransient }),
        Effect.mapError(generationErrorOf),
        Effect.flatMap(noteOf),
      ),
  });

const failingWith = (message: string) =>
  AgentNoteGenerator.of({
    generate: () => Effect.fail(new AgentNoteGenerationError({ message })),
  });

export type BedrockCredentials = {
  readonly accessKeyId: string | undefined;
  readonly secretAccessKey: string | undefined;
};

export const agentNoteGeneratorFor = (
  { accessKeyId, secretAccessKey }: BedrockCredentials,
  converseWith: (credentials: {
    readonly accessKeyId: string;
    readonly secretAccessKey: string;
  }) => Converse,
) => {
  if (accessKeyId !== undefined && secretAccessKey !== undefined) {
    return bedrockAgentNoteGenerator(
      converseWith({ accessKeyId, secretAccessKey }),
    );
  }
  return failingWith(
    accessKeyId === undefined && secretAccessKey === undefined
      ? notConfiguredMessage
      : partlyConfiguredMessage,
  );
};

/** Sends through the AWS SDK; tests pass a `requestHandler` for the network. */
export const bedrockConverse = (
  credentials: {
    readonly accessKeyId: string;
    readonly secretAccessKey: string;
  },
  requestHandler?: BedrockRuntimeClientConfig['requestHandler'],
): Converse => {
  const client = new BedrockRuntimeClient({
    region: bedrockRegion,
    credentials,
    // Effect owns the retries, so every attempt is bounded by the same timeout.
    maxAttempts: 1,
    // An endpoint URL in the environment or AWS config must not get the text.
    ignoreConfiguredEndpointUrls: true,
    requestHandler,
  });
  return (request, signal) =>
    client.send(new ConverseCommand(request), { abortSignal: signal });
};

/**
 * The production generator. The environment is read when the journal runtime
 * is built, not when this module is imported.
 */
export const agentNoteGeneratorLayer = Layer.effect(
  AgentNoteGenerator,
  Effect.promise(() => import('#/shared/env.ts')).pipe(
    Effect.map(({ env }) =>
      agentNoteGeneratorFor(
        {
          accessKeyId: env.BEDROCK_ACCESS_KEY_ID,
          secretAccessKey: env.BEDROCK_SECRET_ACCESS_KEY,
        },
        bedrockConverse,
      ),
    ),
  ),
);
