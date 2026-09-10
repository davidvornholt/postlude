import { expect, it } from 'bun:test';
import { Effect } from 'effect';

import { readImageUpload } from './image-response.ts';

const publicOrigin = 'https://journal.example';
const bytes = new TextEncoder().encode('GIF89a');

it('accepts the public HTTPS origin over an internal HTTP connection', async () => {
  const request = new Request('http://journal.example/api/journal-images/', {
    method: 'POST',
    headers: {
      origin: publicOrigin,
      'x-postlude-image-upload': 'true',
      'x-forwarded-proto': 'https',
    },
    body: bytes,
  });

  expect(
    await Effect.runPromise(readImageUpload(request, publicOrigin)),
  ).toEqual(bytes);
});

it.each([
  { origin: 'https://evil.example', marker: 'true' },
  { origin: 'http://journal.example', marker: 'true' },
  { origin: 'null', marker: 'true' },
  { origin: undefined, marker: 'true' },
  { origin: publicOrigin, marker: undefined },
  { origin: publicOrigin, marker: 'false' },
])(
  'rejects untrusted origins or missing upload intent: %j',
  async ({ origin, marker }) => {
    const headers = new Headers({
      host: 'evil.example',
      'x-forwarded-host': 'evil.example',
      'x-forwarded-proto': 'https',
      forwarded: 'host=evil.example;proto=https',
    });
    if (origin !== undefined) {
      headers.set('origin', origin);
    }
    if (marker !== undefined) {
      headers.set('x-postlude-image-upload', marker);
    }
    const request = new Request('https://evil.example/api/journal-images/', {
      method: 'POST',
      headers,
      body: bytes,
    });

    const result = await Effect.runPromise(
      readImageUpload(request, publicOrigin).pipe(Effect.either),
    );
    expect(result).toMatchObject({
      _tag: 'Left',
      left: { _tag: 'JournalValidationError' },
    });
    expect(request.bodyUsed).toBeFalse();
  },
);
