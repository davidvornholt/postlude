import { expect, it } from 'bun:test';
import { Chunk, Effect, Stream } from 'effect';
import { unzipSync } from 'fflate';

import { journalReadError } from '../errors/journal-errors.ts';
import { parseEntriesDocument } from '../export-format.ts';
import { EntryExport, type ExportEntry } from './entry-export.ts';
import { exportArchiveStream } from './export-stream.ts';

const separatedBacktickRunCount = 1_000_000;
const timestamp = '2026-03-01T20:00:00.000000Z';

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

const exportsOf = (entry: ExportEntry): EntryExport =>
  EntryExport.make({
    visit: (visitor) =>
      Effect.gen(function* () {
        yield* visitor.onCount(1);
        for (const pass of visitor.passes) {
          yield* pass.before;
          yield* pass.onEntry(entry);
          yield* pass.after;
        }
      }).pipe(Effect.mapError(journalReadError)),
  });

it('streams a million separated backtick runs without losing source or joining sections', async () => {
  const morning = '`x'.repeat(separatedBacktickRunCount);
  const evening = 'Evening exact.\n```still source';
  const entry: ExportEntry = {
    date: '2026-03-01',
    journalMarkdown: evening,
    scriptureMarkdown: morning,
    scriptureReference: null,
    journalFirstUsedAt: timestamp,
    scriptureFirstUsedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const chunks = await Effect.runPromise(
    exportArchiveStream(exportsOf(entry), {
      exportedAt: new Date('2026-08-26T20:00:00.000Z'),
      journalDate: '2026-08-26',
      timeZone: 'Europe/Berlin',
    }).pipe(Stream.runCollect, Effect.map(Chunk.toReadonlyArray)),
  );
  const files = unzipSync(bytesOf(chunks));
  const decoder = new TextDecoder();

  expect(parseEntriesDocument(decoder.decode(files['entries.ndjson']))).toEqual(
    [entry],
  );
  expect(decoder.decode(files['days/2026/2026-03-01.md'])).toBe(
    `---\ndate: "2026-03-01"\n---\n\n## Morning\n\n\`\`\`markdown\n${morning}\n\`\`\`\n\n## Evening\n\n\`\`\`\`markdown\n${evening}\n\`\`\`\`\n`,
  );
});
