import { Data, Effect, Queue, Stream, Take } from 'effect';
import { Zip, ZipDeflate } from 'fflate';

export type ArchiveFile = {
  readonly path: string;
  readonly text: string;
};

export class ZipStreamError extends Data.TaggedError('ZipStreamError')<{
  readonly message: string;
  readonly cause: unknown;
}> {}

const zipStreamError = (cause: unknown): ZipStreamError =>
  new ZipStreamError({
    message: 'The journal export could not be compressed.',
    cause,
  });

export type StreamingZip = {
  readonly addFile: (file: ArchiveFile) => Effect.Effect<void, ZipStreamError>;
  readonly beginFile: (path: string) => Effect.Effect<void, ZipStreamError>;
  readonly writeText: (
    text: string,
    final?: boolean,
  ) => Effect.Effect<void, ZipStreamError>;
  readonly endFile: Effect.Effect<void, ZipStreamError>;
};

const encoder = new TextEncoder();

const acquireZip = (offer: (chunk: Uint8Array) => Effect.Effect<void>) =>
  Effect.sync(() => {
    const chunks: Array<Uint8Array> = [];
    let failure: unknown;
    let active: ZipDeflate | undefined;
    const zip = new Zip((error, data) => {
      if (error !== null) {
        failure = error;
        return;
      }
      chunks.push(data);
    });

    const flush = Effect.suspend(() => {
      if (failure !== undefined) {
        return Effect.fail(zipStreamError(failure));
      }
      return Effect.forEach(chunks.splice(0), offer, { discard: true });
    });

    const mutate = (operation: () => void) =>
      Effect.try({ try: operation, catch: zipStreamError }).pipe(
        Effect.zipRight(flush),
      );

    const beginFile = (path: string) =>
      mutate(() => {
        if (active !== undefined) {
          throw new Error('A ZIP member is already open.');
        }
        active = new ZipDeflate(path);
        zip.add(active);
      });

    const writeText = (text: string, final = false) =>
      mutate(() => {
        const file = active;
        if (file === undefined) {
          throw new Error('No ZIP member is open.');
        }
        file.push(encoder.encode(text), final);
        if (final) {
          active = undefined;
        }
      });

    const writer: StreamingZip = {
      beginFile,
      writeText,
      endFile: writeText('', true),
      addFile: (file) =>
        beginFile(file.path).pipe(Effect.zipRight(writeText(file.text, true))),
    };

    const finish = mutate(() => {
      if (active !== undefined) {
        throw new Error('A ZIP member was left open.');
      }
      zip.end();
    });

    return { finish, writer, zip } as const;
  });

const zipProducer = <E, R>(
  produce: (zip: StreamingZip) => Effect.Effect<void, E, R>,
  offer: (chunk: Uint8Array) => Effect.Effect<void>,
): Effect.Effect<void, E | ZipStreamError, R> =>
  Effect.acquireUseRelease(
    acquireZip(offer),
    ({ finish, writer }) => produce(writer).pipe(Effect.zipRight(finish)),
    ({ zip }) => Effect.sync(() => zip.terminate()),
  );

/**
 * A ZIP whose only buffer between its producer and the response consumer is
 * one output chunk. Closing the stream interrupts the scoped producer.
 */
export const streamingZip = <E, R>(
  produce: (zip: StreamingZip) => Effect.Effect<void, E, R>,
): Stream.Stream<Uint8Array, E | ZipStreamError, R> =>
  Stream.unwrapScoped(
    Effect.gen(function* () {
      const queue = yield* Effect.acquireRelease(
        Queue.bounded<Take.Take<Uint8Array, E | ZipStreamError>>(1),
        Queue.shutdown,
      );
      const offer = (chunk: Uint8Array) =>
        Queue.offer(queue, Take.of(chunk)).pipe(Effect.asVoid);
      yield* zipProducer(produce, offer).pipe(
        Effect.matchCauseEffect({
          onFailure: (cause) =>
            Queue.offer(queue, Take.failCause(cause)).pipe(Effect.asVoid),
          onSuccess: () => Queue.offer(queue, Take.end).pipe(Effect.asVoid),
        }),
        Effect.forkScoped,
      );
      return Stream.fromQueue(queue).pipe(Stream.flattenTake);
    }),
  );
