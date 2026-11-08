import { beforeAll, describe, expect, it } from 'bun:test';
import { Effect } from 'effect';
import type { SqlClient } from 'effect/sql';

import { activityDayOf } from '../activity.ts';
import { anniversaryLimit, anniversaryMonthDays } from '../anniversary.ts';
import { journalDateAt, shiftJournalDate } from '../journal-day.ts';
import { parseScriptureReference } from '../scripture-reference.ts';
import { searchDocumentOf } from '../search-document.ts';
import { searchTerms } from '../search-query.ts';
import { storedSearchEvidence } from '../search-stored-evidence.ts';
import { journalStreak, scriptureStreak } from '../streaks.ts';
import { journalDatabase } from '../testing/database-harness.ts';
import { samplePlan } from './sample-plan.ts';
import { seedSampleJournal } from './sample-seed.ts';

const { withEveryService } = journalDatabase();

const berlin = 'Europe/Berlin';
const now = new Date('2026-11-07T19:30:00Z');
const plan = samplePlan({ now, timeZone: berlin });
const { today } = plan;
const daysAgo = (count: number) => shiftJournalDate(today, -count);
/** Storing three years through the app's own save takes a few seconds. */
const seedTimeout = 120_000;

/**
 * Starts from no journal, whatever earlier tests left committed, inside the
 * transaction the harness rolls back.
 */
const emptyJournal = (sql: SqlClient.SqlClient) =>
  Effect.gen(function* () {
    yield* sql`delete from agent_area`;
    yield* sql`delete from day_rating`;
    yield* sql`delete from entry_search_evidence`;
    yield* sql`delete from entry`;
  });

const countEntries = (sql: SqlClient.SqlClient) =>
  sql<{ readonly entries: number }>`
    select count(*)::integer as entries from entry
  `;

const evidenceOf = (sql: SqlClient.SqlClient, date: string) =>
  sql<{
    readonly kind: string;
    readonly token: string;
    readonly position: number;
    readonly excerpt: string;
    readonly matchStart: number;
    readonly matchLength: number;
    readonly anchorLength: number;
  }>`
    select kind, token, position, excerpt, match_start as "matchStart",
      match_length as "matchLength", anchor_length as "anchorLength"
    from entry_search_evidence
    where entry_date = ${date}
    order by kind, position, token
  `;

/** Seeds an empty journal and reads it back the way each page does. */
const readSeededJournal = () =>
  withEveryService(({ sql, entries, search, ratings, areas }) =>
    Effect.gen(function* () {
      yield* emptyJournal(sql);
      yield* seedSampleJournal(plan);
      return {
        evidence: yield* evidenceOf(sql, daysAgo(2)),
        entry: yield* entries.read(daysAgo(2)),
        found: yield* search.search(searchTerms('Sauerteig'), 50),
        history: yield* entries.readHistory({ today }),
        calendar: yield* entries.readCalendar({
          from: daysAgo(30),
          to: today,
          today,
        }),
        anniversaries: yield* entries.readAnniversaries(
          anniversaryMonthDays(today),
          today,
          anniversaryLimit,
        ),
        closed: yield* ratings.read(daysAgo(1)),
        partly: yield* ratings.read(daysAgo(4)),
        ready: yield* areas.readNote(daysAgo(1)),
        stale: yield* areas.readNote(daysAgo(2)),
        failed: yield* areas.readNote(daysAgo(3)),
        wrap: yield* areas.readWrap(daysAgo(1)),
        recent: yield* areas.listDays(daysAgo(13), today),
      };
    }),
  );

describe('seedSampleJournal', () => {
  it(
    'stores the sample once and leaves a journal it finds alone',
    async () => {
      const outcomes = await withEveryService(({ sql }) =>
        Effect.gen(function* () {
          yield* emptyJournal(sql);
          const first = yield* seedSampleJournal(plan);
          const counted = yield* countEntries(sql);
          const second = yield* seedSampleJournal(
            samplePlan({ now, timeZone: berlin, seed: 2 }),
          );
          const after = yield* countEntries(sql);
          return { first, second, counted, after };
        }),
      );
      expect(outcomes.first).toEqual({
        seeded: true,
        today,
        entries: plan.days.filter(({ entry }) => entry !== undefined).length,
        ratings: plan.days.filter(({ rating }) => rating !== undefined).length,
        agentAreas: plan.days.filter(
          ({ wrap, note }) => wrap !== undefined || note !== undefined,
        ).length,
      });
      expect(outcomes.second).toEqual({ seeded: false });
      expect(outcomes.after).toEqual(outcomes.counted);
    },
    seedTimeout,
  );
});

describe('a seeded journal', () => {
  let read: Awaited<ReturnType<typeof readSeededJournal>>;
  beforeAll(async () => {
    read = await readSeededJournal();
  }, seedTimeout);

  it('holds the search evidence the app writes for the same text', () => {
    const stale = plan.days.find(({ date }) => date === daysAgo(2))?.entry;
    const expected = [
      ...storedSearchEvidence(
        searchDocumentOf({
          journalMarkdown: stale?.laterJournalMarkdown ?? '',
          scriptureMarkdown: stale?.scriptureMarkdown ?? '',
          scriptureReference: parseScriptureReference(
            stale?.scriptureReference ?? '',
          ),
        }),
      ),
    ].sort(
      (left, right) =>
        left.kind.localeCompare(right.kind) ||
        left.position - right.position ||
        left.token.localeCompare(right.token),
    );
    expect(read.evidence).toEqual(expected);
    expect(read.entry?.revision).toBe(2);
    expect(read.found.length).toBeGreaterThan(0);
  });

  it('has streaks, a calendar and earlier years on this day', () => {
    const history = read.history.summaries.map(activityDayOf(berlin));
    expect(read.history.earliest).toBe(plan.days.at(-1)?.date ?? '');
    expect(journalStreak(history, today).current).toBe(5);
    expect(scriptureStreak(history, today).current).toBe(4);
    expect(journalStreak(history, today).longest).toBeGreaterThan(5);
    expect(read.calendar.entries.length).toBeGreaterThan(10);
    expect(read.anniversaries.map(({ date }) => date)).toEqual([
      '2025-11-07',
      '2024-11-07',
      '2023-11-07',
    ]);
  });

  it('has closed and partly rated days', () => {
    expect(read.closed.closedAt).not.toBeNull();
    expect(read.partly).toMatchObject({
      energy: 'okay',
      progress: null,
      closedAt: null,
    });
  });

  it('has notes ready, stale and failed, and /wrap on the days before', () => {
    expect(read.ready).toMatchObject({ status: 'ready', basedOnRevision: 1 });
    expect(read.stale).toMatchObject({
      status: 'ready',
      basedOnRevision: 1,
      entryRevision: 2,
    });
    expect(read.failed).toMatchObject({ status: 'failed' });
    expect(read.wrap?.dayMetrics?.day).toBe(daysAgo(1));
    expect(read.recent).toHaveLength(14);
    expect(journalDateAt(read.wrap?.reportGeneratedAt ?? now, berlin)).toBe(
      daysAgo(1),
    );
  });
});
