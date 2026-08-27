import { expect, it } from 'bun:test';
import { Chunk, Effect, Stream } from 'effect';
import { unzipSync } from 'fflate';

import { streamingZip } from './streaming-zip.ts';

const largeTextRepetitions = 20_000;

const bytesOf = (chunks: ReadonlyArray<Uint8Array>): Uint8Array => {
  const size = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
};

it('streams complete UTF-8 ZIP members without collecting the archive', async () => {
  const chunks = await Effect.runPromise(
    streamingZip((zip) =>
      Effect.gen(function* () {
        yield* zip.addFile({ path: 'README.md', text: 'Über den Export\n' });
        yield* zip.beginFile('entries.ndjson');
        yield* zip.writeText('{"date":"2026-03-01"}\n');
        yield* zip.writeText('{"date":"2026-03-02"}\n');
        yield* zip.endFile;
        yield* zip.addFile({
          path: 'days/2026/2026-03-01.md',
          text: 'Der frühe Morgen.\n',
        });
      }),
    ).pipe(Stream.runCollect, Effect.map(Chunk.toReadonlyArray)),
  );
  const files = unzipSync(bytesOf(chunks));
  const decoder = new TextDecoder();

  expect(decoder.decode(files['README.md'])).toBe('Über den Export\n');
  expect(decoder.decode(files['entries.ndjson'])).toBe(
    '{"date":"2026-03-01"}\n{"date":"2026-03-02"}\n',
  );
  expect(decoder.decode(files['days/2026/2026-03-01.md'])).toBe(
    'Der frühe Morgen.\n',
  );
  expect(chunks.length).toBeGreaterThan(1);
});

it('does not finish one file while its capacity-one output is unread', async () => {
  let added = false;
  const body = Stream.toReadableStream(
    streamingZip((zip) =>
      zip
        .addFile({
          path: 'large.md',
          text: 'journal '.repeat(largeTextRepetitions),
        })
        .pipe(
          Effect.tap(() =>
            Effect.sync(() => {
              added = true;
            }),
          ),
        ),
    ),
  );
  const reader = body.getReader();

  const first = await reader.read();
  expect(first.done).toBeFalse();
  expect(added).toBeFalse();

  const readUntilAdded = async (): Promise<void> => {
    if (added) {
      return;
    }
    const next = await reader.read();
    expect(next.done).toBeFalse();
    return readUntilAdded();
  };
  await readUntilAdded();
  await reader.cancel();
});

it('interrupts the ZIP producer when the response body is cancelled', async () => {
  let finalized = false;
  const body = Stream.toReadableStream(
    streamingZip((zip) =>
      zip.addFile({ path: 'day.md', text: 'One day.\n' }).pipe(
        Effect.zipRight(Effect.never),
        Effect.ensuring(
          Effect.sync(() => {
            finalized = true;
          }),
        ),
      ),
    ),
  );
  const reader = body.getReader();

  expect((await reader.read()).done).toBeFalse();
  await reader.cancel();

  expect(finalized).toBeTrue();
});
