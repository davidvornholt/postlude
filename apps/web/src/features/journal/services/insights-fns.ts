/**
 * The Insights server function: everything the page draws for one range, read
 * in one round trip.
 *
 * It carries `sessionRequired` like every other function here. Insights is a
 * map of the whole journal — when it was written, how much, and how the days
 * felt — so an unguarded one would leak the shape of a private journal to
 * anyone who found the address.
 *
 * The streaks are counted over the whole history rather than over the range,
 * because a run that started before the range is still the run the writer is
 * on. The longest entry and the same range a year earlier come from that
 * history too, so a record is measured against the whole journal and last
 * year's writing needs no second read. Whether each section was first used on the day it is about is decided
 * here rather than in the browser, because the comparison needs the configured
 * zone — and the browser's zone is whatever a phone was carried into last week.
 *
 * The day metrics are cut down to the numbers the page adds up before they
 * leave, and the categories are added up here, so a year or more of reports
 * does not travel to the browser to become one bar chart.
 */

import { createServerFn } from '@tanstack/react-start';
import { Effect } from 'effect';

import { sessionRequired } from '#/shared/auth/auth-middleware.ts';
import { env } from '#/shared/env.ts';
import { activityDayOf } from '../activity.ts';
import { categoryTotals, comparableDays, measuresOf } from '../day-measures.ts';
import { rangeOfSearch } from '../insights-address.ts';
import { rangeDates } from '../insights-range.ts';
import {
  longestEntry,
  writtenOutside,
  yearAgoOf,
} from '../insights-records.ts';
import type { InsightsDay, InsightsView } from '../insights-view.ts';
import type { JournalDate } from '../journal-day.ts';
import { type DayOverview, dayRangeLimit } from '../schemas/day-overview.ts';
import type { EntrySummary } from '../schemas/entry-summary.ts';
import { decodeInsightsQuery } from '../schemas/insights-query.ts';
import { journalStreak, scriptureStreak } from '../streaks.ts';
import { AgentAreaRepository } from './agent-area-repository.ts';
import { EntryRepository } from './entry-repository.ts';
import { currentJournalDate } from './journal-fns.ts';
import { runJournalEffect } from './journal-runtime.ts';

/** The range's dates in pieces the day listing accepts in one call. */
const chunksOf = (
  dates: ReadonlyArray<JournalDate>,
): ReadonlyArray<readonly [JournalDate, JournalDate]> => {
  const chunks: Array<readonly [JournalDate, JournalDate]> = [];
  for (let start = 0; start < dates.length; start += dayRangeLimit) {
    const piece = dates.slice(start, start + dayRangeLimit);
    const [from] = piece;
    const to = piece.at(-1);
    if (from !== undefined && to !== undefined) {
      chunks.push([from, to]);
    }
  }
  return chunks;
};

const insightsDayOf = (
  overview: DayOverview,
  summary: EntrySummary | undefined,
): InsightsDay => ({
  date: overview.date,
  // The summary holds only days with something to show, so a day without one
  // counts nothing even if a cleared row is still stored for it.
  journalWords: summary?.journalWordCount ?? 0,
  scriptureWords: summary?.scriptureWordCount ?? 0,
  hasScripture: summary?.hasScripture ?? false,
  scriptureBook: summary?.scriptureBook ?? null,
  energy: overview.rating.energy,
  progress: overview.rating.progress,
  repeatDay: overview.rating.repeatDay,
  closed: overview.closedAt !== null,
  metrics:
    overview.dayMetrics === null ? null : measuresOf(overview.dayMetrics),
});

export const readInsightsFn = createServerFn({ method: 'GET' })
  .middleware([sessionRequired])
  .validator((input: unknown) => decodeInsightsQuery(input ?? {}))
  .handler(({ data }): Promise<InsightsView> => {
    const today = currentJournalDate();
    return runJournalEffect(
      Effect.gen(function* () {
        const entries = yield* EntryRepository;
        const areas = yield* AgentAreaRepository;
        const {
          earliest: firstWritten,
          summaries,
          exportAvailable,
        } = yield* entries.readHistory({ today });
        // Ratings and /wrap reports count as much as writing: a day that holds
        // only those is still a day Insights can show.
        const firstRatedOrMeasured =
          yield* areas.earliestRatedOrMeasured(today);
        const earliest =
          firstRatedOrMeasured !== undefined &&
          (firstWritten === undefined || firstRatedOrMeasured < firstWritten)
            ? firstRatedOrMeasured
            : firstWritten;
        const range = rangeOfSearch(data, today, earliest);
        const overviews = (yield* Effect.forEach(
          chunksOf(rangeDates(range)),
          ([from, to]) => areas.listDays(from, to),
        )).flat();
        const summaryByDate = new Map(
          summaries.map((summary) => [summary.date, summary]),
        );
        const history = summaries.map(activityDayOf(env.JOURNAL_TIME_ZONE));

        return {
          range,
          today,
          earliest,
          days: overviews.map((overview) =>
            insightsDayOf(overview, summaryByDate.get(overview.date)),
          ),
          categories: categoryTotals(
            comparableDays(
              overviews.map((overview) => ({ metrics: overview.dayMetrics })),
            ),
          ),
          journalStreak: journalStreak(history, today),
          scriptureStreak: scriptureStreak(history, today),
          longestEntry: longestEntry(history, today),
          writtenOutside: writtenOutside(range, history, today),
          yearAgo: yearAgoOf(range, history, today),
          exportAvailable,
        };
      }),
    );
  });
