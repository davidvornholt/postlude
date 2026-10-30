import { expect, it } from 'bun:test';
import { Effect } from 'effect';

import type { WrapPut } from '../schemas/agent-area.ts';
import type { DayMetrics } from '../schemas/day-metrics.ts';
import { draft, journalDatabase } from '../testing/database-harness.ts';
import { refusalOf } from '../testing/sql-refusal.ts';
import {
  dayRangeMessage,
  metricsDayMismatchMessage,
} from './agent-area-repository.ts';

const { withEvening } = journalDatabase();

const day = '2026-10-30';

const metricsFor = (date: string, activeMinutes: number): DayMetrics => ({
  metricsVersion: 1,
  day: date,
  activeMinutes,
  firstActivityAt: `${date}T07:12:00+01:00`,
  lastActivityAt: `${date}T22:40:00+01:00`,
  focusMinutes: 190,
  scatteredMinutes: 60,
  categories: [{ id: 'code', label: 'Code', minutes: 150 }],
  offComputerMinutes: null,
  appointmentMinutes: 45,
  appointmentOffScreenMinutes: 30,
  landedPrs: 3,
  sentMails: [{ mailbox: 'personal', count: 2 }],
  coverage: [{ source: 'activitywatch', status: 'complete' }],
});

const wrapFor = (date: string, activeMinutes = 312): WrapPut => ({
  dayMetrics: metricsFor(date, activeMinutes),
  metricsVersion: 1,
  reportHtml: `<!doctype html><p>${activeMinutes} minutes.</p>`,
  reportModel: 'test-model',
});

it('reads a day /wrap has not written as empty', async () => {
  const wrap = await withEvening(({ areas }) => areas.readWrap(day));
  expect(wrap).toEqual({
    date: day,
    dayMetrics: null,
    metricsVersion: null,
    reportHtml: null,
    reportModel: null,
    reportGeneratedAt: null,
  });
});

it('stores the /wrap columns with the database clock, and replaces them', async () => {
  const outcome = await withEvening(({ areas, sql }) =>
    Effect.gen(function* () {
      const [{ now }] = yield* sql<{ readonly now: Date }>`select now() as now`;
      const first = yield* areas.putWrap(day, wrapFor(day, 100));
      const second = yield* areas.putWrap(day, wrapFor(day, 200));
      return { now, first, second, read: yield* areas.readWrap(day) };
    }),
  );
  expect(outcome.first.reportGeneratedAt).toEqual(outcome.now);
  expect(outcome.first.dayMetrics?.activeMinutes).toBe(100);
  expect(outcome.read).toEqual(outcome.second);
  expect(outcome.read.dayMetrics).toEqual(metricsFor(day, 200));
  expect(outcome.read.reportHtml).toBe('<!doctype html><p>200 minutes.</p>');
});

it('refuses metrics measured for another day', async () => {
  const error = await withEvening(({ areas }) =>
    Effect.flip(areas.putWrap(day, wrapFor('2026-10-29'))),
  );
  expect(error.message).toBe(metricsDayMismatchMessage);
});

it('leaves the agent note alone when /wrap runs again', async () => {
  const note = await withEvening(({ areas }) =>
    Effect.gen(function* () {
      const requestedAt = yield* areas.markNotePending(day);
      yield* areas.recordNote(day, requestedAt, {
        note: 'A full day.',
        model: 'note-model',
        basedOnRevision: 0,
      });
      yield* areas.putWrap(day, wrapFor(day));
      return yield* areas.readNote(day);
    }),
  );
  expect(note.status).toBe('ready');
  expect(note.note).toBe('A full day.');
});

it('lists every day of a range, written or not', async () => {
  const days = await withEvening(({ areas, entries, ratings }) =>
    Effect.gen(function* () {
      yield* entries.save(draft('2026-10-28', 'Three short words.'));
      yield* ratings.save({
        date: '2026-10-29',
        energy: 'okay',
        progress: 'solid',
      });
      yield* ratings.close('2026-10-29');
      yield* areas.putWrap('2026-10-30', wrapFor('2026-10-30'));
      return yield* areas.listDays('2026-10-28', '2026-10-31');
    }),
  );
  expect(days.map(({ date }) => date)).toEqual([
    '2026-10-28',
    '2026-10-29',
    '2026-10-30',
    '2026-10-31',
  ]);
  const [written, rated, wrapped, empty] = days;
  expect(written?.journalWordCount).toBe(3);
  expect(rated?.rating).toEqual({
    energy: 'okay',
    progress: 'solid',
    repeatDay: null,
    ratingVersion: 1,
  });
  expect(rated?.closedAt).toBeInstanceOf(Date);
  expect(wrapped?.dayMetrics).toEqual(metricsFor('2026-10-30', 312));
  expect(wrapped?.metricsVersion).toBe(1);
  expect(empty).toEqual({
    date: '2026-10-31',
    journalWordCount: 0,
    scriptureWordCount: 0,
    rating: {
      energy: null,
      progress: null,
      repeatDay: null,
      ratingVersion: null,
    },
    closedAt: null,
    dayMetrics: null,
    metricsVersion: null,
  });
});

it('lists a range across a daylight-saving change one day per date', async () => {
  const days = await withEvening(({ areas }) =>
    areas.listDays('2026-10-24', '2026-10-26'),
  );
  expect(days.map(({ date }) => date)).toEqual([
    '2026-10-24',
    '2026-10-25',
    '2026-10-26',
  ]);
});

it('lists at most a leap year at once, and never backwards', async () => {
  const outcome = await withEvening(({ areas }) =>
    Effect.gen(function* () {
      const year = yield* areas.listDays('2024-01-01', '2024-12-31');
      const tooLong = yield* Effect.flip(
        areas.listDays('2024-01-01', '2025-01-01'),
      );
      const backwards = yield* Effect.flip(
        areas.listDays('2026-10-02', '2026-10-01'),
      );
      return { year, tooLong, backwards };
    }),
  );
  expect(outcome.year).toHaveLength(366);
  expect(outcome.tooLong.message).toBe(dayRangeMessage);
  expect(outcome.backwards.message).toBe(dayRangeMessage);
});

it('reads no note for a day without one, with the entry revision', async () => {
  const note = await withEvening(({ areas, entries }) =>
    Effect.gen(function* () {
      yield* entries.save(draft(day, 'An evening.'));
      return yield* areas.readNote(day);
    }),
  );
  expect(note.status).toBeNull();
  expect(note.entryRevision).toBe(1);
});

it('keeps the previous note while a new one is pending, and drops a superseded result', async () => {
  const outcome = await withEvening(({ areas }) =>
    Effect.gen(function* () {
      const first = yield* areas.markNotePending(day);
      yield* areas.recordNote(day, first, {
        note: 'The first note.',
        model: 'note-model',
        basedOnRevision: 0,
      });
      const second = yield* areas.markNotePending(day);
      const pending = yield* areas.readNote(day);
      const third = yield* areas.markNotePending(day);
      const lateSecond = yield* areas.recordNote(day, second, {
        note: 'A late note.',
        model: 'note-model',
        basedOnRevision: 0,
      });
      const lateFailure = yield* areas.recordNoteFailure(day, second, 'Late.');
      const stored = yield* areas.recordNoteFailure(day, third, 'It broke.');
      return {
        pending,
        lateSecond,
        lateFailure,
        stored,
        final: yield* areas.readNote(day),
      };
    }),
  );
  expect(outcome.pending.status).toBe('pending');
  expect(outcome.pending.note).toBe('The first note.');
  expect(outcome.lateSecond).toBe(false);
  expect(outcome.lateFailure).toBe(false);
  expect(outcome.stored).toBe(true);
  expect(outcome.final.status).toBe('failed');
  expect(outcome.final.error).toBe('It broke.');
  expect(outcome.final.note).toBe('The first note.');
});

it('lets the database refuse an incoherent agent area', async () => {
  const refusals = await withEvening(({ sql }) =>
    Effect.all([
      refusalOf(
        sql,
        sql`insert into agent_area (entry_date, metrics_version) values (${day}, 1)`,
      ),
      refusalOf(
        sql,
        sql`insert into agent_area (entry_date, day_metrics, metrics_version, report_html, report_model, report_generated_at) values (${day}, '[]'::jsonb, 1, 'x', 'm', now())`,
      ),
      refusalOf(
        sql,
        sql`insert into agent_area (entry_date, agent_note_status, agent_note_requested_at) values (${day}, 'done', now())`,
      ),
      refusalOf(
        sql,
        sql`insert into agent_area (entry_date, agent_note_status) values (${day}, 'ready')`,
      ),
      refusalOf(
        sql,
        sql`insert into agent_area (entry_date, agent_note_status, agent_note_requested_at) values (${day}, 'failed', now())`,
      ),
      refusalOf(
        sql,
        sql`insert into agent_area (entry_date, agent_note) values (${day}, 'orphan')`,
      ),
    ]),
  );
  expect(refusals.map(({ constraint }) => constraint)).toEqual([
    'agent_area_wrap_complete',
    'agent_area_day_metrics_object',
    'agent_area_note_status',
    'agent_area_note_ready',
    'agent_area_note_failed',
    'agent_area_note_without_status',
  ]);
});
