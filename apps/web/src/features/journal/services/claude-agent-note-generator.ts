/**
 * Writes the agent note with Claude Sonnet 5.5 through the Claude API.
 *
 * The endpoint is fixed here rather than taken from the environment, so a
 * stray `ANTHROPIC_BASE_URL` can't send the journal text anywhere else.
 *
 * No failure that reaches the log or the page carries the prompt, the journal
 * text, the answer, or a credential.
 */

import Anthropic from '@anthropic-ai/sdk';
import { Data, Duration, Effect, Layer, Redacted, Schedule } from 'effect';

import { agentNotePromptOf } from '../agent-note-prompt.ts';
import { agentNoteTextOf } from '../agent-note-text.ts';
import { AgentNoteGenerationError } from '../errors/journal-errors.ts';
import { notConfiguredMessage } from '../evening-messages.ts';
import {
  AgentNoteGenerator,
  type AgentNoteInput,
} from './agent-note-generator.ts';

const requestedModel = 'claude-sonnet-5-5';

/**
 * Lets the API retry a policy decline on the fallback model it picks for
 * Sonnet 5.5, so the note doesn't fail on a false refusal.
 */
const serverSideFallbackBeta = 'server-side-fallback-2026-07-01';

/** Display names for the requested model and its default fallback. */
const modelNames = new Map([
  [requestedModel, 'Claude Sonnet 5.5'],
  ['claude-sonnet-5', 'Claude Sonnet 5'],
]);

const modelNameOf = (model: string) => modelNames.get(model) ?? model;

/**
 * Room for the thinking low effort does and for a note at
 * `agentNoteCharacterLimit`, which in German is under 2,000 tokens. It also
 * caps what one note can cost.
 */
const outputTokens = 8192;

/** One attempt; with the retries this stays inside `agentNoteTimeout`. */
const attemptTimeout = Duration.minutes(2);

const retrySchedule = Schedule.max([
  Schedule.exponential(Duration.seconds(2)),
  Schedule.recurs(2),
]);

export const accessDeniedMessage =
  'The model service refused access, so no note was written. Its spending limit may have been reached, or its credentials need attention.';
export const requestFailedMessage =
  'The model service could not write the note just now. Ask for a new one to try again.';
export const unusableAnswerMessage =
  "The model's answer could not be used as a note. Ask for a new one to try again.";

export type MessageRequest =
  Anthropic.Beta.Messages.MessageCreateParamsNonStreaming;

/** Sends one Messages request; the signal aborts it. */
export type CreateMessage = (
  request: MessageRequest,
  signal: AbortSignal,
) => Promise<Anthropic.Beta.BetaMessage>;

/**
 * What of a failed request may be logged. An SDK error can echo the request,
 * so only its name, HTTP status and request ID are kept, which are enough to
 * find the request in the Claude Console.
 */
type FailureSummary = {
  readonly name: string;
  readonly status: number | null;
  readonly requestId: string | null;
};

type FailureKind = 'refused' | 'transient' | 'failed';

class RequestFailure extends Data.TaggedError('RequestFailure')<{
  readonly kind: FailureKind;
  readonly summary: FailureSummary;
}> {}

const kindOf = (error: unknown): FailureKind => {
  if (
    error instanceof Anthropic.AuthenticationError ||
    error instanceof Anthropic.PermissionDeniedError ||
    // A 402 has no class of its own; its error type is stable.
    (error instanceof Anthropic.APIError && error.type === 'billing_error')
  ) {
    return 'refused';
  }
  if (
    error instanceof Anthropic.RateLimitError ||
    error instanceof Anthropic.InternalServerError ||
    error instanceof Anthropic.APIConnectionError ||
    error instanceof Anthropic.RequestTimeoutError
  ) {
    return 'transient';
  }
  return 'failed';
};

const failureOf = (error: unknown) =>
  new RequestFailure({
    kind: kindOf(error),
    summary: {
      name: error instanceof Error ? error.name : typeof error,
      status:
        error instanceof Anthropic.APIError && error.status !== undefined
          ? error.status
          : null,
      requestId:
        error instanceof Anthropic.APIError ? (error.requestID ?? null) : null,
    },
  });

const attemptTimedOut = new RequestFailure({
  kind: 'transient',
  summary: { name: 'TimeoutError', status: null, requestId: null },
});

const generationErrorOf = (failure: RequestFailure) =>
  new AgentNoteGenerationError({
    message:
      failure.kind === 'refused' ? accessDeniedMessage : requestFailedMessage,
    cause: failure.summary,
  });

const requestOf = (input: AgentNoteInput): MessageRequest => {
  const prompt = agentNotePromptOf(input);
  return {
    model: requestedModel,
    max_tokens: outputTokens,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'low' },
    system: prompt.system.map((text) => ({ type: 'text', text })),
    messages: [
      { role: 'user', content: [{ type: 'text', text: prompt.data }] },
    ],
    betas: [serverSideFallbackBeta],
    fallbacks: 'default',
  };
};

/**
 * Only a finished turn makes a note; a refusal, which the fallback model
 * declined too, or an answer cut off by the token cap does not.
 */
const noteOf = (response: Anthropic.Beta.BetaMessage) => {
  const answer = response.content
    .flatMap((block) => (block.type === 'text' ? [block.text] : []))
    .join('');
  const note =
    response.stop_reason === 'end_turn' ? agentNoteTextOf(answer) : undefined;
  return note === undefined
    ? Effect.fail(
        new AgentNoteGenerationError({
          message: unusableAnswerMessage,
          cause: { stopReason: response.stop_reason },
        }),
      )
    : Effect.succeed({ note, model: modelNameOf(response.model) });
};

export const claudeAgentNoteGenerator = (createMessage: CreateMessage) =>
  AgentNoteGenerator.of({
    generate: (input) =>
      Effect.tryPromise({
        try: (signal) => createMessage(requestOf(input), signal),
        catch: failureOf,
      }).pipe(
        Effect.timeoutOrElse({
          duration: attemptTimeout,
          orElse: () => Effect.fail(attemptTimedOut),
        }),
        Effect.retry({
          schedule: retrySchedule,
          while: (failure) => failure.kind === 'transient',
        }),
        Effect.mapError(generationErrorOf),
        Effect.flatMap(noteOf),
      ),
  });

export const agentNoteGeneratorFor = (
  apiKey: Redacted.Redacted<string> | undefined,
  createMessageWith: (apiKey: Redacted.Redacted<string>) => CreateMessage,
) =>
  apiKey === undefined
    ? AgentNoteGenerator.of({
        generate: () =>
          Effect.fail(
            new AgentNoteGenerationError({ message: notConfiguredMessage }),
          ),
      })
    : claudeAgentNoteGenerator(createMessageWith(apiKey));

/** The Claude API itself; see the module comment. */
const apiBaseUrl = 'https://api.anthropic.com';

/** Sends through the Anthropic SDK; tests pass a `fetch` for the network. */
export const claudeCreateMessage = (
  apiKey: Redacted.Redacted<string>,
  fetch?: typeof globalThis.fetch,
): CreateMessage => {
  const client = new Anthropic({
    apiKey: Redacted.value(apiKey),
    baseURL: apiBaseUrl,
    // Effect owns the retries; the SDK's timeout matches one attempt.
    maxRetries: 0,
    timeout: Duration.toMillis(attemptTimeout),
    // `ANTHROPIC_LOG=debug` would log each request, journal text included.
    logLevel: 'warn',
    fetch,
  });
  return (request, signal) => client.beta.messages.create(request, { signal });
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
        env.ANTHROPIC_API_KEY === undefined
          ? undefined
          : Redacted.make(env.ANTHROPIC_API_KEY),
        claudeCreateMessage,
      ),
    ),
  ),
);
