import { describe, expect, it } from 'bun:test';
import type {
  ConverseCommandInput,
  ConverseCommandOutput,
} from '@aws-sdk/client-bedrock-runtime';
import { env } from 'bun';
import { Cause, type Duration, Effect, Exit, Fiber } from 'effect';
import { TestClock } from 'effect/testing';

import {
  agentNoteInput,
  excludedMarkers,
} from '../testing/agent-note-input.ts';
import { notConfiguredMessage } from './agent-note-generator.ts';
import {
  accessDeniedMessage,
  agentNoteGeneratorFor,
  agentNoteInferenceProfile,
  agentNoteModelName,
  bedrockAgentNoteGenerator,
  bedrockConverse,
  type Converse,
  partlyConfiguredMessage,
  requestFailedMessage,
  unusableAnswerMessage,
} from './bedrock-agent-note-generator.ts';

/** Text an SDK error might echo from the request, which must go no further. */
const echoedText = 'ECHOED-JOURNAL-TEXT Heute war ein langer, guter Tag.';

const answer = (
  text: string,
  stopReason: ConverseCommandOutput['stopReason'] = 'end_turn',
): ConverseCommandOutput =>
  ({
    $metadata: { httpStatusCode: 200 },
    output: { message: { role: 'assistant', content: [{ text }] } },
    stopReason,
    usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    metrics: { latencyMs: 1 },
  }) as ConverseCommandOutput;

const serviceError = (name: string, status: number) =>
  Object.assign(new Error(`${name}: ${echoedText}`), {
    name,
    $metadata: { httpStatusCode: status, requestId: `request-${status}` },
    $response: { body: echoedText },
  });

/** A fake model that answers each request with the next of `replies`. */
const fakeModel = (
  ...replies: ReadonlyArray<ConverseCommandOutput | Error>
) => {
  const requests: Array<ConverseCommandInput> = [];
  const signals: Array<AbortSignal> = [];
  const converse: Converse = (request, signal) => {
    requests.push(request);
    signals.push(signal);
    const reply = replies[Math.min(requests.length, replies.length) - 1];
    return reply instanceof Error || reply === undefined
      ? Promise.reject(reply ?? new Error('No reply left.'))
      : Promise.resolve(reply);
  };
  return { converse, requests, signals };
};

/** The model never answers; it only stops when its request is aborted. */
const silentModel = () => {
  const signals: Array<AbortSignal> = [];
  const converse: Converse = (_request, signal) => {
    signals.push(signal);
    return new Promise<never>(() => undefined);
  };
  return { converse, signals };
};

/** Runs `generate` on a test clock that has moved `elapsed` ahead. */
const generateWith = (
  converse: Converse,
  elapsed: Duration.Input = '0 seconds',
) =>
  Effect.runPromiseExit(
    Effect.gen(function* () {
      const fiber = yield* bedrockAgentNoteGenerator(converse)
        .generate(agentNoteInput())
        .pipe(Effect.forkChild);
      yield* TestClock.adjust(elapsed);
      return yield* Fiber.join(fiber);
    }).pipe(Effect.provide(TestClock.layer())),
  );

const failureOf = <A, E>(exit: Exit.Exit<A, E>) => {
  if (Exit.isSuccess(exit)) {
    throw new Error('Expected the generator to fail.');
  }
  const error = Cause.findErrorOption(exit.cause);
  if (error._tag === 'None') {
    throw new Error(`Expected a failure, got ${Cause.pretty(exit.cause)}`);
  }
  return error.value as { message: string; cause?: unknown };
};

describe('the request', () => {
  it('goes to the EU inference profile with low effort and a token cap', async () => {
    const model = fakeModel(answer('Ein ruhiger Tag.'));
    await generateWith(model.converse);
    const [request] = model.requests;
    expect(request?.modelId).toBe('eu.anthropic.claude-sonnet-5-5');
    expect(agentNoteInferenceProfile.startsWith('eu.')).toBe(true);
    expect(request?.inferenceConfig).toEqual({ maxTokens: 2048 });
    expect(request?.additionalModelRequestFields).toEqual({
      thinking: { type: 'adaptive' },
      // biome-ignore lint/style/useNamingConvention: Anthropic's Bedrock wire field.
      output_config: { effort: 'low' },
    });
  });

  it('carries instructions only in the system prompt and the day only as data', async () => {
    const model = fakeModel(answer('Ein ruhiger Tag.'));
    await generateWith(model.converse);
    const [request] = model.requests;
    expect(request?.system).toHaveLength(2);
    expect(request?.messages).toHaveLength(1);
    const message = request?.messages?.[0];
    expect(message?.role).toBe('user');
    expect(message?.content).toHaveLength(1);
    expect(message?.content?.[0]?.text?.startsWith('<day_data>\n')).toBe(true);
    const sent = JSON.stringify(request);
    for (const marker of Object.values(excludedMarkers)) {
      expect(sent).not.toContain(marker);
    }
  });

  it('goes to Bedrock in eu-central-1 even when an endpoint URL is configured', async () => {
    const hostnames: Array<string> = [];
    const requestHandler = {
      handle: (request: { readonly hostname: string }) => {
        hostnames.push(request.hostname);
        return Promise.reject(new Error('The test sends nothing.'));
      },
    };
    const variable = 'AWS_ENDPOINT_URL_BEDROCK_RUNTIME';
    const configured = env[variable];
    env[variable] = 'https://outside.example.test';
    try {
      await generateWith(
        bedrockConverse(
          { accessKeyId: 'AKIAEXAMPLE', secretAccessKey: 'secret' },
          requestHandler,
        ),
      );
    } finally {
      if (configured === undefined) {
        delete env[variable];
      } else {
        env[variable] = configured;
      }
    }
    expect(hostnames).toEqual(['bedrock-runtime.eu-central-1.amazonaws.com']);
  });
});

describe('a finished answer', () => {
  it('becomes a plain-text note named for the model', async () => {
    const model = fakeModel(answer('**Energie** war niedrig, Fokus hoch.'));
    const exit = await generateWith(model.converse);
    expect(exit).toEqual(
      Exit.succeed({
        note: 'Energie war niedrig, Fokus hoch.',
        model: agentNoteModelName,
      }),
    );
  });

  it.each([
    ['cut off by the token cap', answer('Ein halber', 'max_tokens')],
    ['filtered', answer('', 'content_filtered')],
    ['stopped by a guardrail', answer('Text', 'guardrail_intervened')],
    ['empty', answer('  ')],
  ])('fails as unusable when it is %s', async (_case, reply) => {
    const exit = await generateWith(fakeModel(reply).converse);
    const failure = failureOf(exit);
    expect(failure.message).toBe(unusableAnswerMessage);
    expect(failure.cause).toEqual({ stopReason: reply.stopReason });
  });
});

describe('a failed request', () => {
  it('says access was refused, keeping only the name, status and request ID', async () => {
    const model = fakeModel(serviceError('AccessDeniedException', 403));
    const failure = failureOf(await generateWith(model.converse));
    expect(failure.message).toBe(accessDeniedMessage);
    expect(failure.cause).toEqual({
      name: 'AccessDeniedException',
      status: 403,
      requestId: 'request-403',
    });
    expect(model.requests).toHaveLength(1);
  });

  it('carries nothing the service echoed into what would be logged', async () => {
    const exit = await generateWith(
      fakeModel(serviceError('ValidationException', 400)).converse,
    );
    if (Exit.isSuccess(exit)) {
      throw new Error('Expected the generator to fail.');
    }
    expect(Cause.pretty(exit.cause)).not.toContain('ECHOED-JOURNAL-TEXT');
    expect(JSON.stringify(failureOf(exit))).not.toContain(
      'ECHOED-JOURNAL-TEXT',
    );
  });

  it('is not tried again when the request itself was wrong', async () => {
    const model = fakeModel(serviceError('ValidationException', 400));
    const failure = failureOf(await generateWith(model.converse, '1 minute'));
    expect(failure.message).toBe(requestFailedMessage);
    expect(model.requests).toHaveLength(1);
  });

  it('is tried twice more when throttled, then fails', async () => {
    const model = fakeModel(serviceError('ThrottlingException', 429));
    const failure = failureOf(await generateWith(model.converse, '1 minute'));
    expect(failure.message).toBe(requestFailedMessage);
    expect(failure.cause).toMatchObject({ status: 429 });
    expect(model.requests).toHaveLength(3);
  });

  it('writes the note when a retry succeeds', async () => {
    const model = fakeModel(
      serviceError('ServiceUnavailableException', 503),
      answer('Ein ruhiger Tag.'),
    );
    const exit = await generateWith(model.converse, '1 minute');
    expect(Exit.isSuccess(exit)).toBe(true);
    expect(model.requests).toHaveLength(2);
  });

  it('gives up on an attempt after two minutes and aborts it', async () => {
    const model = silentModel();
    const failure = failureOf(await generateWith(model.converse, '10 minutes'));
    expect(failure.message).toBe(requestFailedMessage);
    expect(failure.cause).toEqual({
      name: 'TimeoutError',
      status: null,
      requestId: null,
    });
    expect(model.signals).toHaveLength(3);
    expect(model.signals.every((signal) => signal.aborted)).toBe(true);
  });
});

describe('the configured generator', () => {
  const generate = (
    credentials: Parameters<typeof agentNoteGeneratorFor>[0],
    converse: Converse,
  ) =>
    Effect.runPromiseExit(
      agentNoteGeneratorFor(credentials, () => converse).generate(
        agentNoteInput(),
      ),
    );

  it('fails as not configured without credentials, and never calls the model', async () => {
    const model = fakeModel(answer('Ein ruhiger Tag.'));
    const exit = await generate(
      { accessKeyId: undefined, secretAccessKey: undefined },
      model.converse,
    );
    expect(failureOf(exit).message).toBe(notConfiguredMessage);
    expect(model.requests).toHaveLength(0);
  });

  it('fails as partly configured with one half of the key pair', async () => {
    const model = fakeModel(answer('Ein ruhiger Tag.'));
    const exits = await Promise.all(
      [
        { accessKeyId: 'AKIAEXAMPLE', secretAccessKey: undefined },
        { accessKeyId: undefined, secretAccessKey: 'secret' },
      ].map((credentials) => generate(credentials, model.converse)),
    );
    for (const exit of exits) {
      const failure = failureOf(exit);
      expect(failure.message).toBe(partlyConfiguredMessage);
      expect(JSON.stringify(failure)).not.toContain('AKIAEXAMPLE');
    }
    expect(model.requests).toHaveLength(0);
  });

  it('calls the model with both halves', async () => {
    const model = fakeModel(answer('Ein ruhiger Tag.'));
    let given: unknown;
    const exit = await Effect.runPromiseExit(
      agentNoteGeneratorFor(
        { accessKeyId: 'AKIAEXAMPLE', secretAccessKey: 'secret' },
        (credentials) => {
          given = credentials;
          return model.converse;
        },
      ).generate(agentNoteInput()),
    );
    expect(Exit.isSuccess(exit)).toBe(true);
    expect(given).toEqual({
      accessKeyId: 'AKIAEXAMPLE',
      secretAccessKey: 'secret',
    });
  });
});
