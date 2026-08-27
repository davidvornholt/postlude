import { expect, it } from 'bun:test';
import { Chunk, Effect, Stream } from 'effect';
import { unzipSync } from 'fflate';

import {
  parseEntriesDocument,
  parseManifestDocument,
} from '../export-format.ts';
import { draft, journalDatabase } from '../testing/database-harness.ts';
import { exportArchiveStream } from './export-stream.ts';

const { withJournal } = journalDatabase();
const exportedSourceCount = 5;

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

it('exports every non-empty stored source exactly, even when it has no prose', async () => {
  const codeOnly = '```\n\n```';
  const imageOnly = '![](https://example.com/image.png)';
  const structuralOnly = '##\n\n> \n';
  const whitespaceOnly = ' \t\r\n';
  const result = await withJournal(({ entries, exports }) =>
    Effect.gen(function* () {
      yield* entries.save(draft('2026-03-01', codeOnly));
      yield* entries.save({
        ...draft('2026-03-02', ''),
        scriptureMarkdown: imageOnly,
      });
      yield* entries.save(draft('2026-03-03', structuralOnly));
      yield* entries.save({
        ...draft('2026-03-04', ''),
        scriptureMarkdown: whitespaceOnly,
      });
      yield* entries.save(draft('2026-03-05', '', 'Psalms 23'));
      const onceUsed = yield* entries.save(
        draft('2026-03-06', 'Cleared but provenance remains.'),
      );
      yield* entries.save(draft('2026-03-06', '', '', onceUsed.revision));
      yield* entries.save(draft('2026-03-07', ''));

      return yield* exportArchiveStream(
        exports,
        'Europe/Berlin',
        () => undefined,
      ).pipe(Stream.runCollect, Effect.map(Chunk.toReadonlyArray));
    }),
  );
  const files = unzipSync(bytesOf(result));
  const decoder = new TextDecoder();
  const manifest = parseManifestDocument(
    decoder.decode(files['manifest.json']),
  );
  const records = parseEntriesDocument(decoder.decode(files['entries.ndjson']));

  expect(manifest.entries.count).toBe(exportedSourceCount);
  expect(
    records.map(({ date, journalMarkdown, scriptureMarkdown }) => ({
      date,
      journalMarkdown,
      scriptureMarkdown,
    })),
  ).toEqual([
    {
      date: '2026-03-01',
      journalMarkdown: codeOnly,
      scriptureMarkdown: '',
    },
    {
      date: '2026-03-02',
      journalMarkdown: '',
      scriptureMarkdown: imageOnly,
    },
    {
      date: '2026-03-03',
      journalMarkdown: structuralOnly,
      scriptureMarkdown: '',
    },
    {
      date: '2026-03-04',
      journalMarkdown: '',
      scriptureMarkdown: whitespaceOnly,
    },
    { date: '2026-03-05', journalMarkdown: '', scriptureMarkdown: '' },
  ]);
  expect(records.map(({ date }) => date)).not.toContain('2026-03-06');
  expect(records.map(({ date }) => date)).not.toContain('2026-03-07');
});
