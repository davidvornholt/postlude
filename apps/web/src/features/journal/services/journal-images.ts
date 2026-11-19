import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { FetchHttpHandler } from '@smithy/fetch-http-handler';
import { Context, Effect, Layer } from 'effect';
import { JournalValidationError } from '../errors/journal-errors.ts';
import {
  imageContentType,
  imageExtension,
  imageRoute,
  isImageKey,
  maximumImageBytes,
} from '../images.ts';
import { JournalImageError } from './journal-image-error.ts';

export type ImageStorage = {
  readonly endpoint: string;
  readonly bucket: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  /** How long a request may take until the store's response headers arrive. */
  readonly requestTimeout: number;
};

const imageStorageClient = (storage: ImageStorage) =>
  new S3Client({
    endpoint: storage.endpoint,
    region: 'auto',
    credentials: {
      accessKeyId: storage.accessKeyId,
      secretAccessKey: storage.secretAccessKey,
    },
    // Production reaches R2 only through the egress proxy in HTTPS_PROXY. Bun's
    // fetch honours that variable and its node:https, under the SDK's default
    // handler, does not.
    requestHandler: new FetchHttpHandler({
      requestTimeout: storage.requestTimeout,
    }),
    maxAttempts: 2,
  });

/** Stores journal images in the S3-compatible bucket that `storage` resolves to. */
export const makeJournalImages = (
  resolveStorage: () => Promise<ImageStorage>,
) => {
  const client = async () => {
    const settings = await resolveStorage();
    return {
      bucket: settings.bucket,
      storage: imageStorageClient(settings),
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
            // FetchHttpHandler neither aborts a request whose timeout passed nor
            // closes connections on destroy(), so each operation aborts its own
            // requests once it ends.
            const operation = new AbortController();
            try {
              await storage.send(
                new PutObjectCommand({
                  Bucket: bucket,
                  Key: key,
                  Body: bytes,
                  ContentType: imageContentType(key),
                }),
                {
                  abortSignal: AbortSignal.any([abortSignal, operation.signal]),
                },
              );
            } finally {
              operation.abort();
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
            // Aborts the requests once the read ends, as in upload. A successful
            // read has consumed the whole body by then.
            const operation = new AbortController();
            try {
              const result = await storage.send(
                new GetObjectCommand({ Bucket: bucket, Key: key }),
                {
                  abortSignal: AbortSignal.any([abortSignal, operation.signal]),
                },
              );
              if (
                !result.Body ||
                result.ContentLength === undefined ||
                result.ContentLength > maximumImageBytes
              ) {
                throw new JournalImageError({
                  message: 'The stored image is missing or too large to read.',
                });
              }
              return await result.Body.transformToByteArray();
            } finally {
              operation.abort();
              storage.destroy();
            }
          },
          catch: failure,
        });
      }),
  };
};

export class JournalImages extends Context.Service<JournalImages>()(
  'JournalImages',
  {
    make: Effect.sync(() =>
      // Lazy configuration keeps text-only journaling and isolated PR previews usable.
      // A partially configured store fails here instead of falling back to another bucket.
      makeJournalImages(async () => {
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
          endpoint: env.R2_ENDPOINT,
          bucket: env.R2_BUCKET,
          accessKeyId: env.R2_ACCESS_KEY_ID,
          secretAccessKey: env.R2_SECRET_ACCESS_KEY,
          requestTimeout: 30_000,
        };
      }),
    ),
  },
) {
  static readonly layer = Layer.effect(JournalImages, JournalImages.make);
}
