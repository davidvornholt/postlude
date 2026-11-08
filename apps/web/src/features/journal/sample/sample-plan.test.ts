import { describe, expect, it } from 'bun:test';
import { Schema } from 'effect';

import { agentNoteTextOf } from '../agent-note-text.ts';
import { journalDateAt, shiftJournalDate } from '../journal-day.ts';
import {
  parseJournalMarkdown,
  serializeJournalMarkdown,
} from '../journal-markdown.ts';
import { DayMetricsSchema } from '../schemas/day-metrics.ts';
import {
  formatScriptureReference,
  parseScriptureReference,
} from '../scripture-reference.ts';
import { sampleReferences } from './sample-morning.ts';
import { historyDays, samplePlan } from './sample-plan.ts';

const berlin = 'Europe/Berlin';
// A Saturday evening in Berlin, so the plan's today is 2026-11-07.
const now = new Date('2026-11-07T19:30:00Z');
const plan = samplePlan({ now, timeZone: berlin });
const day = (daysAgo: number) =>
  plan.days.find(
    (stored) => stored.date === shiftJournalDate(plan.today, -daysAgo),
  );
const entries = plan.days.flatMap((stored) =>
  stored.entry === undefined ? [] : [{ date: stored.date, ...stored.entry }],
);
const onTheDay = (instant: Date | null, date: string) =>
  instant !== null && journalDateAt(instant, berlin) === date;

const measured = plan.days.flatMap(({ date, wrap }) =>
  wrap === undefined ? [] : [{ date, wrap }],
);
const readyNotes = plan.days.flatMap(({ note }) =>
  note?.status === 'ready' ? [note.note] : [],
);

describe('the sample journal', () => {
  it('ends on the journal day it is drawn on and reaches back three years', () => {
    expect(plan.today).toBe('2026-11-07');
    expect(plan.days[0]?.date).toBe('2026-11-07');
    expect(plan.days.at(-1)?.date).toBe(
      shiftJournalDate(plan.today, -(historyDays - 1)),
    );
    expect(entries.length).toBeGreaterThan(365);
  });

  it('has today written in each of the three years before it', () => {
    expect(
      entries
        .filter(({ date }) => date.endsWith('-11-07'))
        .map(({ date }) => date),
    ).toEqual(['2026-11-07', '2025-11-07', '2024-11-07', '2023-11-07']);
  });

  it('leaves recent days empty or partly filled', () => {
    expect(day(7)).toBeUndefined();
    expect(day(4)?.rating).toMatchObject({ progress: null, closedAt: null });
    expect(day(5)?.entry?.journalMarkdown).toBe('');
    expect(day(8)?.entry).toBeUndefined();
    expect(day(9)?.entry).toMatchObject({
      journalMarkdown: '',
      scriptureMarkdown: '',
    });
    expect(day(0)?.rating).toBeUndefined();
  });

  it('shows a note that is ready, one gone stale, and one that failed', () => {
    expect(day(1)?.note?.status).toBe('ready');
    expect(day(2)?.entry?.laterJournalMarkdown).toBeDefined();
    expect(day(2)?.rating?.closedAt).toBeNull();
    expect(day(3)?.note?.status).toBe('failed');
  });

  it('draws the same journal again from the same day', () => {
    expect(samplePlan({ now, timeZone: berlin })).toEqual(plan);
  });
});

describe('when the sample journal says things happened', () => {
  it('stores nothing dated after now', () => {
    const times = plan.days.flatMap(({ entry, rating, wrap, note }) => [
      entry?.updatedAt,
      rating?.updatedAt,
      wrap?.generatedAt,
      note?.requestedAt,
      note?.status === 'ready' ? note.generatedAt : undefined,
    ]);
    expect(times.filter((time) => time !== undefined && time > now)).toEqual(
      [],
    );
  });

  it('starts each morning on its own day and nearly every evening too', () => {
    expect(
      entries
        .filter(({ scriptureFirstUsedAt }) => scriptureFirstUsedAt !== null)
        .filter(
          ({ scriptureFirstUsedAt, date }) =>
            !onTheDay(scriptureFirstUsedAt, date),
        ),
    ).toEqual([]);
    const evenings = entries.filter(
      ({ journalFirstUsedAt }) => journalFirstUsedAt !== null,
    );
    const onTime = evenings.filter(({ journalFirstUsedAt, date }) =>
      onTheDay(journalFirstUsedAt, date),
    );
    expect(onTime.length).toBeGreaterThan(evenings.length * 0.9);
    expect(onTime.length).toBeLessThan(evenings.length);
  });

  it('closes a day only after it was written', () => {
    expect(
      plan.days.filter(
        ({ entry, rating }) =>
          entry !== undefined &&
          rating !== undefined &&
          rating.closedAt !== null &&
          rating.closedAt < entry.updatedAt,
      ),
    ).toEqual([]);
  });

  it.each([
    ['across the spring clock change', '2027-03-28T01:30:00Z', berlin],
    ['before four in the morning', '2026-11-07T02:30:00Z', berlin],
    ['on a leap day', '2028-02-29T12:00:00Z', berlin],
    ['in another zone', '2026-11-07T12:00:00Z', 'Pacific/Auckland'],
  ])('draws a journal %s', (_label, instant, timeZone) => {
    const drawnAt = new Date(instant);
    const drawn = samplePlan({ now: drawnAt, timeZone });
    expect(drawn.today).toBe(journalDateAt(drawnAt, timeZone));
    expect(drawn.days[0]?.date).toBe(drawn.today);
    expect(
      drawn.days.filter(
        ({ date, entry }) =>
          entry !== undefined &&
          entry.scriptureFirstUsedAt !== null &&
          journalDateAt(entry.scriptureFirstUsedAt, timeZone) !== date,
      ),
    ).toEqual([]);
  });
});

describe('what the sample journal stores', () => {
  it('writes Markdown the editor writes back unchanged', () => {
    const markdown = entries.flatMap(
      ({ journalMarkdown, scriptureMarkdown, laterJournalMarkdown }) => [
        journalMarkdown,
        scriptureMarkdown,
        laterJournalMarkdown ?? '',
      ],
    );
    expect(
      markdown.map((text) =>
        serializeJournalMarkdown(parseJournalMarkdown(text)),
      ),
    ).toEqual(markdown);
  });

  it('notes passages in the house style', () => {
    expect(
      sampleReferences.map((reference) => {
        const parsed = parseScriptureReference(reference);
        return parsed && formatScriptureReference(parsed);
      }),
    ).toEqual([...sampleReferences]);
  });

  it('stores metrics /wrap could have stored for the same day', () => {
    const decode = Schema.decodeUnknownSync(DayMetricsSchema);
    expect(measured.length).toBeGreaterThan(0);
    expect(
      measured.map(({ wrap }) => {
        const metrics = decode(JSON.parse(JSON.stringify(wrap.dayMetrics)));
        return [
          metrics.day,
          journalDateAt(new Date(metrics.firstActivityAt ?? ''), berlin),
          journalDateAt(new Date(metrics.lastActivityAt ?? ''), berlin),
        ];
      }),
    ).toEqual(measured.map(({ date }) => [date, date, date]));
  });

  it('keeps every note as the app would store it', () => {
    expect(readyNotes.length).toBeGreaterThan(0);
    expect(readyNotes.map(agentNoteTextOf)).toEqual(readyNotes);
  });
});
