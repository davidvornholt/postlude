import { describe, expect, it, spyOn } from 'bun:test';
import Anthropic from '@anthropic-ai/sdk';
import { env, listen } from 'bun';
import { Effect, Exit, Redacted } from 'effect';
import { agentNoteInput } from '../testing/agent-note-input.ts';
import { answer, testKey } from '../testing/claude-message.ts';
import {
  claudeAgentNoteGenerator,
  claudeCreateMessage,
  type MessageRequest,
} from './claude-agent-note-generator.ts';

type Sent = { readonly url: string; readonly init: RequestInit | undefined };

/** A network that answers every request with `status` and `body`. */
const network = (status: number, body: unknown) => {
  const sent: Array<Sent> = [];
  const fetch = ((input: string | URL | Request, init?: RequestInit) => {
    sent.push({ url: String(input), init });
    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: {
          'content-type': 'application/json',
          'request-id': 'request-http',
        },
      }),
    );
  }) as typeof globalThis.fetch;
  return { fetch, sent };
};

/**
 * A local HTTP server that answers each connection with a 200 and `body`, but
 * on the first connection drops the socket partway through the body. `fetch`
 * sends the Claude API's requests to it.
 */
const serverThatDropsTheFirstAnswer = (body: string) => {
  let connections = 0;
  const server = listen({
    hostname: '127.0.0.1',
    port: 0,
    socket: {
      open: () => {
        connections += 1;
      },
      data: (socket) => {
        const head = [
          'HTTP/1.1 200 OK',
          'content-type: application/json',
          `content-length: ${Buffer.byteLength(body)}`,
          `request-id: request-${connections}`,
          '',
          '',
        ].join('\r\n');
        if (connections === 1) {
          socket.write(head + body.slice(0, body.length / 2));
          socket.terminate();
        } else {
          socket.end(head + body);
        }
      },
    },
  });
  const fetch = ((input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    return globalThis.fetch(
      `http://127.0.0.1:${server.port}${url.pathname}${url.search}`,
      init,
    );
  }) as typeof globalThis.fetch;
  return {
    fetch,
    connections: () => connections,
    stop: () => server.stop(true),
  };
};

/** Runs `body` with these environment variables set, then restores them. */
const withEnv = async <A>(
  variables: Readonly<Record<string, string>>,
  body: () => Promise<A>,
) => {
  const before = Object.fromEntries(
    Object.keys(variables).map((name) => [name, env[name]]),
  );
  Object.assign(env, variables);
  try {
    return await body();
  } finally {
    for (const [name, value] of Object.entries(before)) {
      if (value === undefined) {
        delete env[name];
      } else {
        env[name] = value;
      }
    }
  }
};

describe('the API client', () => {
  it('sends the note to the Claude API, not to a configured base URL, and logs no request', async () => {
    const http = network(200, answer('Ein ruhiger Tag.'));
    const debug = spyOn(console, 'debug').mockImplementation(() => undefined);
    const info = spyOn(console, 'info').mockImplementation(() => undefined);
    try {
      const exit = await withEnv(
        {
          ANTHROPIC_BASE_URL: 'https://outside.example.test',
          ANTHROPIC_LOG: 'debug',
        },
        () =>
          Effect.runPromiseExit(
            claudeAgentNoteGenerator(
              claudeCreateMessage(Redacted.make(testKey), http.fetch),
            ).generate(agentNoteInput()),
          ),
      );
      expect(exit).toEqual(
        Exit.succeed({ note: 'Ein ruhiger Tag.', model: 'Claude Sonnet 5.5' }),
      );
      expect(debug).not.toHaveBeenCalled();
      expect(info).not.toHaveBeenCalled();
    } finally {
      debug.mockRestore();
      info.mockRestore();
    }
    expect(http.sent).toHaveLength(1);
    const [sent] = http.sent;
    const url = new URL(sent?.url ?? '');
    expect(url.origin).toBe('https://api.anthropic.com');
    expect(url.pathname).toBe('/v1/messages');
    const headers = new Headers(sent?.init?.headers);
    expect(headers.get('authorization')).toBe(`Bearer ${testKey}`);
    expect(headers.get('anthropic-beta')).toBe(
      'server-side-fallback-2026-07-01',
    );
    expect(JSON.parse(String(sent?.init?.body))).toMatchObject({
      model: 'claude-sonnet-5-5',
      max_tokens: 8192,
      fallbacks: 'default',
    });
  });

  it('makes one attempt per call, leaving retries to the generator', async () => {
    const http = network(529, {
      type: 'error',
      error: { type: 'overloaded_error', message: 'Overloaded' },
    });
    const createMessage = claudeCreateMessage(
      Redacted.make(testKey),
      http.fetch,
    );
    const request: MessageRequest = {
      model: 'claude-sonnet-5-5',
      max_tokens: 16,
      messages: [{ role: 'user', content: 'Hallo' }],
    };
    const failure = await createMessage(
      request,
      new AbortController().signal,
    ).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(Anthropic.OverloadedError);
    expect(http.sent).toHaveLength(1);
  });

  // The generator waits two seconds before it tries again.
  it('tries again when the connection drops while the answer is read, and writes the note', async () => {
    const server = serverThatDropsTheFirstAnswer(
      JSON.stringify(answer('Ein ruhiger Tag.')),
    );
    try {
      const exit = await Effect.runPromiseExit(
        claudeAgentNoteGenerator(
          claudeCreateMessage(Redacted.make(testKey), server.fetch),
        ).generate(agentNoteInput()),
      );
      expect(exit).toEqual(
        Exit.succeed({
          note: 'Ein ruhiger Tag.',
          model: 'Claude Sonnet 5.5',
        }),
      );
      expect(server.connections()).toBe(2);
    } finally {
      server.stop();
    }
  }, 10_000);
});
