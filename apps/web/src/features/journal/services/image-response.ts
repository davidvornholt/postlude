import { Effect } from 'effect';

import { privateResponseHeaders } from '#/shared/auth/private-response.ts';
import { JournalValidationError } from '../errors/journal-errors.ts';
import { imageContentType, maximumImageBytes } from '../images.ts';
import { JournalImages } from './journal-images.ts';

const readBoundedImage = async (request: Request): Promise<Uint8Array> => {
  const reader = request.body?.getReader();
  if (!reader) {
    throw new JournalValidationError({
      message: 'Choose an image to upload.',
    });
  }
  const chunks: Array<Uint8Array> = [];
  let length = 0;
  try {
    for (;;) {
      // biome-ignore lint/performance/noAwaitInLoops: Read sequentially to enforce the size limit before buffering.
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      length += value.byteLength;
      if (length > maximumImageBytes) {
        throw new JournalValidationError({
          message: 'Choose an image up to 10 MiB.',
        });
      }
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
};

/** Count streamed bytes before buffering so chunked uploads obey the same limit. */
export const readImageUpload = (request: Request, publicOrigin: string) =>
  Effect.tryPromise({
    try: async () => {
      if (
        // TLS terminates at the proxy; the internal request URL can use HTTP.
        request.headers.get('origin') !== publicOrigin ||
        request.headers.get('x-postlude-image-upload') !== 'true'
      ) {
        throw new JournalValidationError({
          message: 'Upload images from the journal page.',
        });
      }
      return await readBoundedImage(request);
    },
    catch: (cause) =>
      cause instanceof JournalValidationError
        ? cause
        : new JournalValidationError({
            message: 'The image upload was interrupted. Try again.',
            cause,
          }),
  });

export const uploadImageResponse = async (
  request: Request,
): Promise<Response> => {
  const { runJournalEffect } = await import('./journal-runtime.ts');
  const { env } = await import('#/shared/env.ts');
  return runJournalEffect(
    Effect.gen(function* () {
      const bytes = yield* readImageUpload(
        request,
        new URL(env.BETTER_AUTH_URL).origin,
      );
      const images = yield* JournalImages;
      const uploaded = yield* images.upload(bytes);
      return Response.json(uploaded, { headers: privateResponseHeaders });
    }),
  );
};

export const readImageResponse = async (key: string): Promise<Response> => {
  const { runJournalEffect } = await import('./journal-runtime.ts');
  return runJournalEffect(
    Effect.gen(function* () {
      const images = yield* JournalImages;
      const bytes = yield* images.read(key);
      return new Response(new Blob([new Uint8Array(bytes)]), {
        headers: {
          ...privateResponseHeaders,
          'content-type': imageContentType(key),
          'content-security-policy': "default-src 'none'; sandbox",
        },
      });
    }),
  );
};
