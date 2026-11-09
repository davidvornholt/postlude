/**
 * The day log /wrap stores beside its report, against a real Postgres: search
 * finds it when asked and says each window is the agent's, a new log replaces
 * the old one's index, the database refuses a log that breaks the contract,
 * and the export never carries it.
 */

import { expect, it } from 'bun:test';
import { Effect, Stream } from 'effect';
import { unzipSync } from 'fflate';

import type { WrapPut } from '../schemas/agent-area.ts';
import { searchHitOf } from '../search-contract.ts';
import { searchTerms } from '../search-query.ts';
import { dayMetricsFor } from '../testing/agent-note-input.ts';
import { draft, journalDatabase } from '../testing/database-harness.ts';
import { refusalOf } from '../testing/sql-refusal.ts';
import { type SearchMatch, writingOnly } from './entry-search.ts';
import { exportArchiveStream } from './export-stream.ts';
import { JournalImages } from './journal-images.ts';

const { withEveryService } = journalDatabase();

const day = '2026-10-30';
const plenty = 20;
const withDayLog = { dayLog: true } as const;
const checkViolation = '23514';

const wrapWith = (dayLog: string, date = day): WrapPut => ({
  dayMetrics: dayMetricsFor(date),
  metricsVersion: 2,
  reportHtml: '<p>The day.</p>',
  reportModel: 'wrap-model',
  dayLog,
});

/** The one day a search found, as the page shows it. */
const onlyHit = (matches: ReadonlyArray<SearchMatch>) => {
  const [match] = matches;
  if (match === undefined || matches.length !== 1) {
    throw new TypeError(`Expected one day, found ${matches.length}.`);
  }
  return searchHitOf(match);
};

const joined = (excerpt: ReadonlyArray<{ readonly text: string }>) =>
  excerpt.map((segment) => segment.text).join('');

it('finds a day by its log alone, only when asked, and marks it as the agent’s', async () => {
  const outcome = await withEveryService(({ areas, search }) =>
    Effect.gen(function* () {
      yield* areas.putWrap(
        day,
        wrapWith(
          '09:10–11:45 Rewrote the kestrel importer.\n\n14:00–15:30 Answered mail.',
        ),
      );
      return {
        everything: yield* search.search(
          searchTerms('kestrel'),
          plenty,
          withDayLog,
        ),
        writing: yield* search.search(
          searchTerms('kestrel'),
          plenty,
          writingOnly,
        ),
      };
    }),
  );
  expect(outcome.writing).toEqual([]);
  expect(outcome.everything.map(({ date }) => date)).toEqual([day]);
  expect(outcome.everything[0]?.words).toBe(0);
  const hit = onlyHit(outcome.everything);
  expect(hit.sources.map(({ kind }) => kind)).toEqual(['day-log']);
  expect(joined(hit.sources[0]?.excerpts[0] ?? [])).toBe(
    '09:10–11:45 Rewrote the kestrel importer.',
  );
});

it('matches a day whose words are split between the writing and the log', async () => {
  const outcome = await withEveryService(({ areas, entries, search }) =>
    Effect.gen(function* () {
      yield* entries.save(draft(day, 'Rain all evening.'));
      yield* entries.save(draft('2026-10-29', 'Rain again.'));
      yield* areas.putWrap(day, wrapWith('10:00–12:00 Kestrel parser.'));
      return {
        everything: yield* search.search(
          searchTerms('rain kestrel'),
          plenty,
          withDayLog,
        ),
        writing: yield* search.search(
          searchTerms('rain kestrel'),
          plenty,
          writingOnly,
        ),
      };
    }),
  );
  expect(outcome.writing).toEqual([]);
  expect(outcome.everything.map(({ date }) => date)).toEqual([day]);
  expect(outcome.everything[0]?.words).toBe(3);
  const hit = onlyHit(outcome.everything);
  expect(hit.sources.map(({ kind }) => kind)).toEqual(['evening', 'day-log']);
});

it('keeps a log window inside its paragraph', async () => {
  const found = await withEveryService(({ areas, search }) =>
    Effect.gen(function* () {
      yield* areas.putWrap(
        day,
        wrapWith(
          '08:00–09:00 Opened the editor.\n\n09:00–10:00 Fixed the kestrel  \n  build.\n\n10:00–11:00 Lunch.',
        ),
      );
      return yield* search.search(searchTerms('kestrel'), plenty, withDayLog);
    }),
  );
  const excerpt = joined(onlyHit(found).sources[0]?.excerpts[0] ?? []);
  expect(excerpt).toBe('09:00–10:00 Fixed the kestrel build.');
});

it('replaces the log’s search index when /wrap stores the day again', async () => {
  const outcome = await withEveryService(({ areas, search }) =>
    Effect.gen(function* () {
      yield* areas.putWrap(day, wrapWith('09:00–10:00 Kestrel.'));
      yield* areas.putWrap(day, wrapWith('09:00–10:00 Falcon.'));
      return {
        old: yield* search.search(searchTerms('kestrel'), plenty, withDayLog),
        current: yield* search.search(
          searchTerms('falcon'),
          plenty,
          withDayLog,
        ),
        stored: yield* areas.readWrapWithDayLog(day),
      };
    }),
  );
  expect(outcome.old).toEqual([]);
  expect(outcome.current.map(({ date }) => date)).toEqual([day]);
  expect(outcome.stored.dayLog).toBe('09:00–10:00 Falcon.');
});

it('reads no day log for a day /wrap has not written, and none in the page’s read', async () => {
  const outcome = await withEveryService(({ areas }) =>
    Effect.gen(function* () {
      const unwritten = yield* areas.readWrapWithDayLog(day);
      yield* areas.putWrap(day, wrapWith('09:00–10:00 Kestrel.'));
      return { unwritten, page: yield* areas.readWrap(day) };
    }),
  );
  expect(outcome.unwritten.dayLog).toBeNull();
  expect(outcome.unwritten.reportHtml).toBeNull();
  expect(Object.keys(outcome.page)).not.toContain('dayLog');
  expect(JSON.stringify(outcome.page)).not.toContain('Kestrel');
});

it('refuses a log the contract does not allow, whoever writes it', async () => {
  const refusals = await withEveryService(({ areas, sql }) =>
    Effect.gen(function* () {
      yield* areas.putWrap(day, wrapWith('09:00–10:00 Kestrel.'));
      return yield* Effect.all({
        withoutReport: refusalOf(
          sql,
          sql`
            insert into agent_area (entry_date, day_log, day_log_search_token_text)
            values ('2026-10-29', 'A log.', 'a log')
          `,
        ),
        tooLong: refusalOf(
          sql,
          sql`update agent_area set day_log = repeat('x', 20001) where entry_date = ${day}`,
        ),
        blank: refusalOf(
          sql,
          sql`update agent_area set day_log = ' \n ' where entry_date = ${day}`,
        ),
        unindexed: refusalOf(
          sql,
          sql`update agent_area set day_log_search_token_text = null where entry_date = ${day}`,
        ),
      });
    }),
  );
  expect(refusals).toEqual({
    withoutReport: {
      code: checkViolation,
      constraint: 'agent_area_day_log_with_wrap',
    },
    tooLong: { code: checkViolation, constraint: 'agent_area_day_log_bounded' },
    blank: { code: checkViolation, constraint: 'agent_area_day_log_bounded' },
    unindexed: {
      code: checkViolation,
      constraint: 'agent_area_day_log_indexed',
    },
  });
});

it('leaves the log out of the export', async () => {
  const marker = 'Daylogmarker';
  const files = await withEveryService(({ areas, entries, exports }) =>
    Effect.gen(function* () {
      yield* entries.save(draft(day, 'A quiet evening.'));
      yield* areas.putWrap(day, wrapWith(`09:00–10:00 ${marker}.`));
      const chunks = yield* exportArchiveStream(
        exports,
        'Europe/Berlin',
        () => undefined,
      ).pipe(Stream.provide(JournalImages.layer), Stream.runCollect);
      return unzipSync(new Uint8Array(Buffer.concat([...chunks])));
    }),
  );
  const decoder = new TextDecoder();
  const texts = Object.values(files).map((bytes) => decoder.decode(bytes));
  expect(texts.some((text) => text.includes('A quiet evening.'))).toBe(true);
  for (const text of texts) {
    expect(text).not.toContain(marker);
  }
});
