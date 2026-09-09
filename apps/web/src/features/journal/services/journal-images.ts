import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Effect } from 'effect';
import { JournalValidationError } from '../errors/journal-errors.ts';
import {
  imageContentType,
  imageExtension,
  imageRoute,
  isImageKey,
  maximumImageBytes,
} from '../images.ts';
import { JournalImageError } from './journal-image-error.ts';

export class JournalImages extends Effect.Service<JournalImages>()(
  'JournalImages',
  {
    sync: () => {
      // Lazy configuration keeps text-only journaling and isolated PR previews usable.
      // A partially configured store fails here instead of falling back to another bucket.
      const client = async () => {
        const { env } = await import('#/shared/env.ts');
        if (
          !(
            env.R2_ENDPOINT &&
            env.R2_BUCKET &&
            env.R2_ACCESS_KEY_ID &&
            env.R2_SECRET_ACCESS_KEY
          )
        ) {
          throw new JournalImageError({
            message:
              'Image storage is not configured. Ask the operator to configure it, then try again.',
          });
        }
        return {
          bucket: env.R2_BUCKET,
          storage: new S3Client({
            endpoint: env.R2_ENDPOINT,
            region: 'auto',
            credentials: {
              accessKeyId: env.R2_ACCESS_KEY_ID,
              secretAccessKey: env.R2_SECRET_ACCESS_KEY,
            },
            requestHandler: { requestTimeout: 30_000 },
            maxAttempts: 2,
          }),
        };
      };
      const failure = (cause: unknown) =>
        cause instanceof JournalImageError
          ? cause
          : new JournalImageError({
              message:
                'The image could not be stored or read. Check your connection and try again.',
              cause,
            });
      return {
        upload: (bytes: Uint8Array) =>
          Effect.gen(function* () {
            const extension = imageExtension(bytes);
            if (
              bytes.byteLength === 0 ||
              bytes.byteLength > maximumImageBytes ||
              extension === undefined
            ) {
              return yield* new JournalValidationError({
                message: 'Choose a JPEG, PNG, GIF, or WebP image up to 10 MiB.',
              });
            }
            const key = `${crypto.randomUUID()}.${extension}`;
            yield* Effect.tryPromise({
              try: async (abortSignal) => {
                const { storage, bucket } = await client();
                try {
                  await storage.send(
                    new PutObjectCommand({
                      Bucket: bucket,
                      Key: key,
                      Body: bytes,
                      ContentType: imageContentType(key),
                    }),
                    { abortSignal },
                  );
                } finally {
                  storage.destroy();
                }
              },
              catch: failure,
            });
            return { src: `${imageRoute}${key}` };
          }),
        read: (key: string) =>
          Effect.gen(function* () {
            if (!isImageKey(key)) {
              return yield* new JournalValidationError({
                message: 'The image address is invalid.',
              });
            }
            return yield* Effect.tryPromise({
              try: async (abortSignal) => {
                const { storage, bucket } = await client();
                try {
                  const result = await storage.send(
                    new GetObjectCommand({ Bucket: bucket, Key: key }),
                    { abortSignal },
                  );
                  if (
                    !result.Body ||
                    result.ContentLength === undefined ||
                    result.ContentLength > maximumImageBytes
                  ) {
                    throw new JournalImageError({
                      message:
                        'The stored image is missing or too large to read.',
                    });
                  }
                  return await result.Body.transformToByteArray();
                } finally {
                  storage.destroy();
                }
              },
              catch: failure,
            });
          }),
      };
    },
  },
) {}
