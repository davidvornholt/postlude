import { basename } from 'node:path';

import { createPool } from '@postlude/db/pool';
import { Data, Effect } from 'effect';

import { parseAnytypeJournal } from '../src/features/journal/import/anytype-import.ts';
import type {
  JournalImportIssue,
  JournalImportRecord,
} from '../src/features/journal/import/import-record.ts';
import {
  importJournalRecords,
  validateImportRecords,
} from '../src/features/journal/import/journal-import.ts';
import {
  type JournalImportSource,
  parseObsidianJournal,
} from '../src/features/journal/import/obsidian-import.ts';
import { countJournalWords } from '../src/features/journal/word-count.ts';

class JournalImportSourceError extends Data.TaggedError(
  'JournalImportSourceError',
)<{ readonly message: string; readonly cause?: unknown }> {}

const expected = {
  records: 676,
  firstDate: '2022-09-04',
  lastDate: '2026-08-22',
  journalBodies: 672,
  scriptureBodies: 27,
  references: 26,
  journalWords: 154_532,
  scriptureWords: 2576,
} as const;

const argumentValue = (name: string): string | undefined => {
  const at = Bun.argv.indexOf(name);
  return at === -1 ? undefined : Bun.argv[at + 1];
};

const obsidianDirectory = argumentValue('--obsidian-dir');
const anytypeDirectory = argumentValue('--anytype-dir');
const dryRun = Bun.argv.includes('--dry-run');
if (obsidianDirectory === undefined || anytypeDirectory === undefined) {
  throw new JournalImportSourceError({
    message:
      'Usage: bun run import:journals --obsidian-dir <dir> --anytype-dir <dir> [--dry-run]',
  });
}

const readMarkdown = (directory: string) =>
  Effect.tryPromise({
    try: async (): Promise<ReadonlyArray<JournalImportSource>> => {
      const sources: Array<JournalImportSource> = [];
      const glob = new Bun.Glob('**/*.md');
      for await (const path of glob.scan({
        cwd: directory,
        absolute: true,
        onlyFiles: true,
      })) {
        sources.push({ path, content: await Bun.file(path).text() });
      }
      return sources.sort((left, right) => left.path.localeCompare(right.path));
    },
    catch: (cause) =>
      new JournalImportSourceError({
        message: `Could not read Markdown below ${directory}.`,
        cause,
      }),
  });

const expectedIssues = (
  records: ReadonlyArray<JournalImportRecord>,
): ReadonlyArray<JournalImportIssue> => {
  const sorted = [...records].sort((left, right) =>
    left.date.localeCompare(right.date),
  );
  const actual = {
    records: records.length,
    firstDate: sorted[0]?.date,
    lastDate: sorted.at(-1)?.date,
    journalBodies: records.filter((record) => record.journalMarkdown !== '')
      .length,
    scriptureBodies: records.filter((record) => record.scriptureMarkdown !== '')
      .length,
    references: records.filter(
      (record) => record.scriptureReference !== undefined,
    ).length,
    journalWords: records.reduce(
      (sum, record) => sum + countJournalWords(record.journalMarkdown),
      0,
    ),
    scriptureWords: records.reduce(
      (sum, record) => sum + countJournalWords(record.scriptureMarkdown),
      0,
    ),
  };
  return Object.entries(expected).flatMap(([key, value]) =>
    actual[key as keyof typeof actual] === value
      ? []
      : [
          {
            source: 'combined import',
            message: `Expected ${key}=${value}, got ${actual[key as keyof typeof actual] ?? 'nothing'}.`,
          },
        ],
  );
};

const program = Effect.gen(function* () {
  const [obsidianSources, anytypeSources] = yield* Effect.all([
    readMarkdown(obsidianDirectory),
    readMarkdown(anytypeDirectory),
  ]);
  const obsidian = parseObsidianJournal(obsidianSources);
  const anytype = parseAnytypeJournal(anytypeSources);
  const records = [...obsidian.records, ...anytype.records].sort(
    (left, right) => left.date.localeCompare(right.date),
  );
  const today = new Date().toISOString().slice(0, 10);
  const issues = [
    ...obsidian.issues,
    ...anytype.issues,
    ...validateImportRecords(records, today),
    ...expectedIssues(records),
  ];
  if (issues.length > 0) {
    for (const issue of issues) {
      yield* Effect.logError(`${issue.source}: ${issue.message}`);
    }
    return yield* Effect.fail(
      new JournalImportSourceError({
        message: `Journal import refused ${issues.length} validation issue(s).`,
      }),
    );
  }

  const summary = {
    records: records.length,
    firstDate: records[0]?.date,
    lastDate: records.at(-1)?.date,
    obsidianFiles: obsidianSources.filter(
      (source) => basename(source.path) !== 'Altes Tagebuch.md',
    ).length,
    anytypeFiles: anytypeSources.length,
  };
  if (dryRun) {
    yield* Effect.logInfo('Journal import dry run passed.', summary);
    return;
  }

  const databaseUrl = Bun.env.DATABASE_URL;
  if (databaseUrl === undefined || databaseUrl === '') {
    return yield* Effect.fail(
      new JournalImportSourceError({ message: 'DATABASE_URL is not set.' }),
    );
  }
  const pool = createPool(databaseUrl);
  const imported = yield* importJournalRecords(pool, records).pipe(
    Effect.ensuring(Effect.promise(() => pool.end())),
  );
  yield* Effect.logInfo('Journal import completed.', {
    ...summary,
    ...imported,
  });
});

await Effect.runPromise(program);
