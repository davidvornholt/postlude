import { expect, it } from 'bun:test';
import { SqlClient } from '@effect/sql';
import { Deferred, Effect, Fiber } from 'effect';
import { inArchiveSnapshot } from './archive-snapshot.ts';
import {
  draft,
  withCommittedRepository,
  withRepository,
} from './entry-repository-test-support.ts';

/** As many earlier years as the archive asks for; the page shows four. */
const anniversaryLimit = 4;
const isoMonthStart = 5;
const archiveRequest = (today: string) => ({
  today,
  anniversaryMonthDay: today.slice(isoMonthStart),
  anniversaryLimit,
});
it('reads nothing for a day that was never written', async () => {
  const entry = await withRepository((entries) => entries.read('2019-04-02'));
  expect(entry).toBeUndefined();
});
it('gives back the day it stored, counted by the server', async () => {
  const prose = 'A quiet evening, and the rain finally stopped.';
  const words = 8;
  const entry = await withRepository((entries) =>
    entries.save(draft('2026-08-25', prose)),
  );
  expect(entry.date).toBe('2026-08-25');
  expect(entry.journalMarkdown).toBe(prose);
  expect(entry.journalWordCount).toBe(words);
  expect(entry.scriptureWordCount).toBe(0);
  expect(entry.scriptureReference).toBeUndefined();
});
it('keeps the date a calendar date rather than an instant', async () => {
  const entry = await withRepository((entries) =>
    Effect.gen(function* () {
      yield* entries.save(draft('2026-01-01', 'The first day.'));
      return yield* entries.read('2026-01-01');
    }),
  );
  expect(entry?.date).toBe('2026-01-01');
});
it('replaces a day rather than failing on the second save', async () => {
  const words = 3;
  const entry = await withRepository((entries) =>
    Effect.gen(function* () {
      const first = yield* entries.save(
        draft('2026-08-25', 'A first pass at the evening.'),
      );
      return yield* entries.save(
        draft('2026-08-25', 'Rewritten, and shorter.', '', first.revision),
      );
    }),
  );
  expect(entry.journalMarkdown).toBe('Rewritten, and shorter.');
  expect(entry.journalWordCount).toBe(words);
});
it('keeps the creation stamp of the day it is rewriting', async () => {
  const [first, second] = await withRepository((entries) =>
    Effect.gen(function* () {
      const created = yield* entries.save(draft('2026-08-25', 'First.'));
      const rewritten = yield* entries.save(
        draft('2026-08-25', 'Second.', '', created.revision),
      );
      return [created, rewritten] as const;
    }),
  );
  expect(second.createdAt.getTime()).toBe(first.createdAt.getTime());
  expect(second.updatedAt.getTime()).toBe(first.updatedAt.getTime());
  expect([first.revision, second.revision]).toEqual([1, 2]);
});

it('sets each first-use stamp independently and never rewrites it', async () => {
  const entries = await withRepository((repository) =>
    Effect.gen(function* () {
      const blank = yield* repository.save(draft('2026-08-25', ''));
      const journal = yield* repository.save(
        draft('2026-08-25', 'An evening.', '', blank.revision),
      );
      const both = yield* repository.save(
        draft('2026-08-25', 'An evening.', 'Psalms 23', journal.revision),
      );
      const cleared = yield* repository.save(
        draft('2026-08-25', '', '', both.revision),
      );
      const restored = yield* repository.save(
        draft('2026-08-25', 'Another evening.', 'Psalms 24', cleared.revision),
      );
      return { blank, journal, both, cleared, restored };
    }),
  );

  expect(entries.blank.journalFirstUsedAt).toBeNull();
  expect(entries.blank.scriptureFirstUsedAt).toBeNull();
  expect(entries.journal.journalFirstUsedAt).toBeInstanceOf(Date);
  expect(entries.journal.scriptureFirstUsedAt).toBeNull();
  expect(entries.both.scriptureFirstUsedAt).toBeInstanceOf(Date);
  expect(entries.cleared.journalFirstUsedAt).toEqual(
    entries.journal.journalFirstUsedAt,
  );
  expect(entries.cleared.scriptureFirstUsedAt).toEqual(
    entries.both.scriptureFirstUsedAt,
  );
  expect(entries.restored.journalFirstUsedAt).toEqual(
    entries.journal.journalFirstUsedAt,
  );
  expect(entries.restored.scriptureFirstUsedAt).toEqual(
    entries.both.scriptureFirstUsedAt,
  );
});

it('stores a verse range as the four columns the archive reads', async () => {
  const entry = await withRepository((entries) =>
    entries.save(draft('2026-08-25', 'Read it slowly.', 'Sprüche 12,5-13')),
  );
  expect(entry.scriptureReference).toEqual({
    book: 'Proverbs',
    chapter: 12,
    verseStart: 5,
    verseEnd: 13,
  });
});
it('accepts a whole chapter, which has no verse at all', async () => {
  const entry = await withRepository((entries) =>
    entries.save(draft('2026-08-25', 'The whole psalm.', 'Psalms 23')),
  );
  expect(entry.scriptureReference).toEqual({ book: 'Psalms', chapter: 23 });
});
it('drops a reference the writer removed', async () => {
  const entry = await withRepository((entries) =>
    Effect.gen(function* () {
      const withReference = yield* entries.save(
        draft('2026-08-25', 'With one.', 'Psalms 23'),
      );
      return yield* entries.save(
        draft('2026-08-25', 'Without one.', '', withReference.revision),
      );
    }),
  );
  expect(entry.scriptureReference).toBeUndefined();
});
it('explains an invalid reference without changing the stored entry', async () => {
  const outcome = await withRepository((entries) =>
    Effect.gen(function* () {
      const storedReference = yield* entries.save(
        draft('2026-08-25', 'With one.', 'Psalms 23'),
      );
      const failure = yield* Effect.flip(
        entries.save(
          draft(
            '2026-08-25',
            'Still editing.',
            'Proverbs 12:',
            storedReference.revision,
          ),
        ),
      );
      const stored = yield* entries.read('2026-08-25');
      return { failure, stored } as const;
    }),
  );

  expect(outcome.failure._tag).toBe('JournalValidationError');
  expect(outcome.failure.message).toContain('scripture reference');
  expect(outcome.stored?.journalMarkdown).toBe('With one.');
  expect(outcome.stored?.scriptureReference).toEqual({
    book: 'Psalms',
    chapter: 23,
  });
});
it('lists a range inclusively and in calendar order', async () => {
  const summaries = await withRepository((entries) =>
    Effect.gen(function* () {
      yield* entries.save(draft('2026-03-01', 'One.'));
      yield* entries.save(draft('2026-03-15', 'Two words here.', 'Psalms 23'));
      yield* entries.save(draft('2026-03-31', 'Three.'));
      yield* entries.save(draft('2026-04-01', 'Outside the range.'));
      return yield* entries.readArchive(archiveRequest('2026-03-31'));
    }),
  );
  expect(summaries.summaries.map((summary) => summary.date)).toEqual([
    '2026-03-01',
    '2026-03-15',
    '2026-03-31',
  ]);
  expect(
    summaries.summaries.map((summary) => summary.hasScriptureReference),
  ).toEqual([false, true, false]);
});

it('finds the same day of the month in earlier years, newest first', async () => {
  const anniversaries = await withRepository((entries) =>
    Effect.gen(function* () {
      yield* entries.save(draft('2024-08-26', 'Two years back.'));
      yield* entries.save(draft('2025-08-26', 'One year back.'));
      yield* entries.save(draft('2025-08-25', 'The day before, once.'));
      yield* entries.save(draft('2026-08-26', 'Today itself.'));
      return yield* entries.readArchive(archiveRequest('2026-08-26'));
    }),
  );
  expect(anniversaries.anniversaries.map((entry) => entry.date)).toEqual([
    '2025-08-26',
    '2024-08-26',
  ]);
});
/*
 * A day whose morning holds a passage and whose evening holds nothing has
 * nothing to show in a list of openings, so it is left out rather than listed
 * as a blank line.
 */
it('leaves out an anniversary with no evening prose', async () => {
  const anniversaries = await withRepository((entries) =>
    Effect.gen(function* () {
      yield* entries.save({
        date: '2025-08-26',
        journalMarkdown: '',
        scriptureMarkdown: '',
        scriptureReference: 'Psalms 23',
        baseRevision: 0,
      });
      return yield* entries.readArchive(archiveRequest('2026-08-26'));
    }),
  );
  expect(anniversaries.anniversaries).toEqual([]);
});

it('reports no archive coverage while the journal is empty', async () => {
  const archive = await withRepository((entries) =>
    entries.readArchive(archiveRequest('2026-08-26')),
  );
  expect(archive.earliest).toBeUndefined();
});

it('reports the oldest written day as where the archive starts', async () => {
  const earliest = await withRepository((entries) =>
    Effect.gen(function* () {
      yield* entries.save(draft('2026-03-15', 'Later.'));
      yield* entries.save(draft('2025-11-02', 'Earlier.'));
      return yield* entries.readArchive(archiveRequest('2026-08-26'));
    }),
  );
  expect(earliest.earliest).toBe('2025-11-02');
});

it('keeps an empty historical row without extending archive coverage', async () => {
  const archive = await withRepository((entries) =>
    Effect.gen(function* () {
      yield* entries.save(draft('2024-01-01', ''));
      yield* entries.save(draft('2025-11-02', 'Meaningful.'));
      return yield* entries.readArchive(archiveRequest('2026-08-26'));
    }),
  );

  expect(archive.earliest).toBe('2025-11-02');
  expect(archive.summaries.map((summary) => summary.date)).toEqual([
    '2025-11-02',
  ]);
});

it('removes a cleared journal section from archive coverage', async () => {
  const archive = await withRepository((entries) =>
    Effect.gen(function* () {
      const written = yield* entries.save(
        draft('2024-01-01', 'Once meaningful.'),
      );
      yield* entries.save(draft('2024-01-01', '', '', written.revision));
      yield* entries.save(draft('2025-11-02', '', 'Psalms 23'));
      return yield* entries.readArchive(archiveRequest('2026-08-26'));
    }),
  );

  expect(archive.earliest).toBe('2025-11-02');
  expect(archive.summaries.map((summary) => summary.date)).toEqual([
    '2025-11-02',
  ]);
});

it('removes a cleared scripture section from archive coverage', async () => {
  const archive = await withRepository((entries) =>
    Effect.gen(function* () {
      const written = yield* entries.save({
        ...draft('2024-01-01', ''),
        scriptureMarkdown: 'Once meaningful.',
      });
      yield* entries.save(draft('2024-01-01', '', '', written.revision));
      yield* entries.save(draft('2025-11-02', 'Still here.'));
      return yield* entries.readArchive(archiveRequest('2026-08-26'));
    }),
  );

  expect(archive.earliest).toBe('2025-11-02');
  expect(archive.summaries.map((summary) => summary.date)).toEqual([
    '2025-11-02',
  ]);
});

it('reports a truly empty archive after every meaningful section is cleared', async () => {
  const archive = await withRepository((entries) =>
    Effect.gen(function* () {
      const journal = yield* entries.save(
        draft('2024-01-01', 'Once meaningful.'),
      );
      const scripture = yield* entries.save(
        draft('2025-11-02', '', 'Psalms 23'),
      );
      yield* entries.save(draft('2024-01-01', '', '', journal.revision));
      yield* entries.save(draft('2025-11-02', '', '', scripture.revision));
      return yield* entries.readArchive(archiveRequest('2026-08-26'));
    }),
  );

  expect(archive.earliest).toBeUndefined();
  expect(archive.summaries).toEqual([]);
  expect(archive.anniversaries).toEqual([]);
});

it('holds one snapshot while a concurrent archive-visible row commits', async () => {
  const tableName = `archive_snapshot_test_${crypto.randomUUID().replaceAll('-', '')}`;
  const observed = await withCommittedRepository(() =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      const table = sql(tableName);
      const rowExists = () =>
        sql<{ readonly present: boolean }>`
          select exists(
            select 1 from ${table}
          ) as present
        `.pipe(Effect.map((rows) => rows[0]?.present ?? false));

      yield* sql`create table ${table} (marker integer primary key)`;
      return yield* Effect.gen(function* () {
        const firstReadDone = yield* Deferred.make<void>();
        const continueRead = yield* Deferred.make<void>();
        const reader = yield* inArchiveSnapshot(
          sql,
          Effect.gen(function* () {
            const before = yield* rowExists();
            yield* Deferred.succeed(firstReadDone, undefined);
            yield* Deferred.await(continueRead);
            const after = yield* rowExists();
            return { before, after };
          }),
        ).pipe(Effect.fork);

        yield* Deferred.await(firstReadDone);
        yield* sql`insert into ${table} (marker) values (1)`;
        yield* Deferred.succeed(continueRead, undefined);
        const snapshot = yield* Fiber.join(reader);
        const visibleAfterCommit = yield* rowExists();
        return { snapshot, visibleAfterCommit };
      }).pipe(Effect.ensuring(sql`drop table ${table}`.pipe(Effect.orDie)));
    }),
  );

  expect(observed.snapshot).toEqual({ before: false, after: false });
  expect(observed.visibleAfterCommit).toBe(true);
});
