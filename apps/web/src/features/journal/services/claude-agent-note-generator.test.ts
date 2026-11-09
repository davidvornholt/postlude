import { describe, expect, it } from 'bun:test';
import Anthropic from '@anthropic-ai/sdk';
import { Cause, type Duration, Effect, Exit, Fiber, Redacted } from 'effect';
import { TestClock } from 'effect/testing';
import { notConfiguredMessage } from '../evening-messages.ts';
import {
  agentNoteInput,
  excludedMarkers,
} from '../testing/agent-note-input.ts';
import {
  answer,
  apiError,
  echoedText,
  reply,
  testKey,
  text,
} from '../testing/claude-message.ts';
import {
  accessDeniedMessage,
  agentNoteGeneratorFor,
  type CreateMessage,
  claudeAgentNoteGenerator,
  type MessageRequest,
  requestFailedMessage,
  unusableAnswerMessage,
} from './claude-agent-note-generator.ts';

/** A fake model that answers each request with the next of `replies`. */
const fakeModel = (
  ...replies: ReadonlyArray<Anthropic.Beta.BetaMessage | Error>
) => {
  const requests: Array<MessageRequest> = [];
  const signals: Array<AbortSignal> = [];
  const createMessage: CreateMessage = (request, signal) => {
    requests.push(request);
    signals.push(signal);
    const next = replies[Math.min(requests.length, replies.length) - 1];
    return next instanceof Error || next === undefined
      ? Promise.reject(next ?? new Error('No reply left.'))
      : Promise.resolve(next);
  };
  return { createMessage, requests, signals };
};

/** The model never answers; it only stops when its request is aborted. */
const silentModel = () => {
  const signals: Array<AbortSignal> = [];
  const createMessage: CreateMessage = (_request, signal) => {
    signals.push(signal);
    return new Promise<never>(() => undefined);
  };
  return { createMessage, signals };
};

/** Runs `generate` on a test clock that has moved `elapsed` ahead. */
const generateWith = (
  createMessage: CreateMessage,
  elapsed: Duration.Input = '0 seconds',
) =>
  Effect.runPromiseExit(
    Effect.gen(function* () {
      const fiber = yield* claudeAgentNoteGenerator(createMessage)
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
  it('asks Sonnet 5.5 for low effort under a token cap, with the default fallback', async () => {
    const model = fakeModel(answer('Ein ruhiger Tag.'));
    await generateWith(model.createMessage);
    const [request] = model.requests;
    expect(request).toMatchObject({
      model: 'claude-sonnet-5-5',
      max_tokens: 2048,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'low' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    });
  });

  it('carries instructions only in the system prompt and the day only as data', async () => {
    const model = fakeModel(answer('Ein ruhiger Tag.'));
    await generateWith(model.createMessage);
    const [request] = model.requests;
    expect(request?.system).toHaveLength(2);
    expect(request?.messages).toHaveLength(1);
    const message = request?.messages[0];
    expect(message?.role).toBe('user');
    const content = message?.content;
    expect(Array.isArray(content) ? content : []).toHaveLength(1);
    const [block] = Array.isArray(content) ? content : [];
    expect(block?.type).toBe('text');
    expect(
      block?.type === 'text' && block.text.startsWith('<day_data>\n'),
    ).toBe(true);
    const sent = JSON.stringify(request);
    for (const marker of Object.values(excludedMarkers)) {
      expect(sent).not.toContain(marker);
    }
  });
});

describe('a finished answer', () => {
  it('becomes a plain-text note named for the model', async () => {
    const model = fakeModel(answer('**Energie** war niedrig, Fokus hoch.'));
    const exit = await generateWith(model.createMessage);
    expect(exit).toEqual(
      Exit.succeed({
        note: 'Energie war niedrig, Fokus hoch.',
        model: 'Claude Sonnet 5.5',
      }),
    );
  });

  it('is named for the fallback model when that model wrote it', async () => {
    const fallback = {
      type: 'fallback',
      from: { model: 'claude-sonnet-5-5' },
      to: { model: 'claude-sonnet-5' },
    };
    const model = fakeModel(
      reply({
        content: [fallback, text('Ein ruhiger Tag.')],
        model: 'claude-sonnet-5',
      }),
    );
    const exit = await generateWith(model.createMessage);
    expect(exit).toEqual(
      Exit.succeed({ note: 'Ein ruhiger Tag.', model: 'Claude Sonnet 5' }),
    );
  });

  it('leaves out thinking', async () => {
    const thinking = { type: 'thinking', thinking: '', signature: 'sig' };
    const model = fakeModel(
      reply({ content: [thinking, text('Ein ruhiger Tag.')] }),
    );
    const exit = await generateWith(model.createMessage);
    expect(exit).toEqual(
      Exit.succeed({ note: 'Ein ruhiger Tag.', model: 'Claude Sonnet 5.5' }),
    );
  });

  it.each([
    [
      'cut off by the token cap',
      reply({ content: [text('Ein halber')], stopReason: 'max_tokens' }),
    ],
    ['refused', reply({ content: [], stopReason: 'refusal' })],
    ['empty', answer('  ')],
  ])('fails as unusable when it is %s', async (_case, message) => {
    const exit = await generateWith(fakeModel(message).createMessage);
    const failure = failureOf(exit);
    expect(failure.message).toBe(unusableAnswerMessage);
    expect(failure.cause).toEqual({ stopReason: message.stop_reason });
  });
});

describe('a failed request', () => {
  it.each([
    ['the key', 401, 'authentication_error', 'AuthenticationError'],
    ['permission', 403, 'permission_error', 'PermissionDeniedError'],
    ['billing', 402, 'billing_error', 'APIError'],
  ])(
    'says access was refused over %s, keeping only the name, status and request ID',
    async (_case, status, type, name) => {
      const model = fakeModel(apiError(status, type));
      const failure = failureOf(
        await generateWith(model.createMessage, '1 minute'),
      );
      expect(failure.message).toBe(accessDeniedMessage);
      expect(failure.cause).toEqual({
        name,
        status,
        requestId: `request-${status}`,
      });
      expect(model.requests).toHaveLength(1);
    },
  );

  it('carries nothing the service echoed into what would be logged', async () => {
    const exit = await generateWith(
      fakeModel(apiError(400, 'invalid_request_error')).createMessage,
    );
    if (Exit.isSuccess(exit)) {
      throw new Error('Expected the generator to fail.');
    }
    expect(Cause.pretty(exit.cause)).not.toContain('ECHOED-JOURNAL-TEXT');
    expect(JSON.stringify(failureOf(exit))).not.toContain(
      'ECHOED-JOURNAL-TEXT',
    );
  });

  it.each([
    [400, 'invalid_request_error'],
    [404, 'not_found_error'],
    [413, 'request_too_large'],
  ])('is not tried again after a %i', async (status, type) => {
    const model = fakeModel(apiError(status, type));
    const failure = failureOf(
      await generateWith(model.createMessage, '1 minute'),
    );
    expect(failure.message).toBe(requestFailedMessage);
    expect(model.requests).toHaveLength(1);
  });

  it.each([
    ['rate-limited', apiError(429, 'rate_limit_error')],
    ['overloaded', apiError(529, 'overloaded_error')],
    ['failing on the server', apiError(500, 'api_error')],
    ['unreachable', new Anthropic.APIConnectionError({ message: echoedText })],
    ['timed out in the SDK', new Anthropic.APIConnectionTimeoutError()],
  ])('is tried twice more when %s, then fails', async (_case, error) => {
    const model = fakeModel(error);
    const failure = failureOf(
      await generateWith(model.createMessage, '1 minute'),
    );
    expect(failure.message).toBe(requestFailedMessage);
    expect(failure.cause).toMatchObject({ name: error.name });
    expect(model.requests).toHaveLength(3);
  });

  it('writes the note when a retry succeeds', async () => {
    const model = fakeModel(
      apiError(503, 'api_error'),
      answer('Ein ruhiger Tag.'),
    );
    const exit = await generateWith(model.createMessage, '1 minute');
    expect(Exit.isSuccess(exit)).toBe(true);
    expect(model.requests).toHaveLength(2);
  });

  it('gives up on an attempt after two minutes and aborts it', async () => {
    const model = silentModel();
    const failure = failureOf(
      await generateWith(model.createMessage, '10 minutes'),
    );
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
  it('fails as not configured without a key, and never calls the model', async () => {
    const model = fakeModel(answer('Ein ruhiger Tag.'));
    const exit = await Effect.runPromiseExit(
      agentNoteGeneratorFor(undefined, () => model.createMessage).generate(
        agentNoteInput(),
      ),
    );
    expect(failureOf(exit).message).toBe(notConfiguredMessage);
    expect(model.requests).toHaveLength(0);
  });

  it('calls the model with the key', async () => {
    const model = fakeModel(answer('Ein ruhiger Tag.'));
    let given: string | undefined;
    const exit = await Effect.runPromiseExit(
      agentNoteGeneratorFor(Redacted.make(testKey), (apiKey) => {
        given = Redacted.value(apiKey);
        return model.createMessage;
      }).generate(agentNoteInput()),
    );
    expect(Exit.isSuccess(exit)).toBe(true);
    expect(given).toBe(testKey);
  });
});
