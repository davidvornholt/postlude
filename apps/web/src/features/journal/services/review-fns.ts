import { createServerFn } from '@tanstack/react-start';
import { Effect } from 'effect';

import { sessionRequired } from '#/shared/auth/auth-middleware.ts';
import { journalMonthOf } from '../calendar.ts';
import {
  periodDates,
  type ReviewPeriod,
  weekStartOf,
} from '../review-period.ts';
import type { ReviewDay, ReviewView } from '../review-view.ts';
import type { DayOverview } from '../schemas/day-overview.ts';
import { decodeReviewQuery } from '../schemas/review-query.ts';
import { AgentAreaRepository } from './agent-area-repository.ts';
import { currentJournalDate } from './journal-fns.ts';
import { runJournalEffect } from './journal-runtime.ts';

/** The ratings and the numbers, leaving the word counts behind. */
const reviewDayOf = (day: DayOverview): ReviewDay => ({
  date: day.date,
  energy: day.rating.energy,
  progress: day.rating.progress,
  repeatDay: day.rating.repeatDay,
  closed: day.closedAt !== null,
  metrics: day.dayMetrics,
});

export const readReviewFn = createServerFn({ method: 'GET' })
  .middleware([sessionRequired])
  .validator((input: unknown) => decodeReviewQuery(input))
  .handler(({ data }): Promise<ReviewView> => {
    const today = currentJournalDate();
    const period: ReviewPeriod =
      data.kind === 'week'
        ? { kind: 'week', start: weekStartOf(data.week ?? today) }
        : { kind: 'month', month: data.month ?? journalMonthOf(today) };
    const dates = periodDates(period);
    const [from] = dates;
    const to = dates.at(-1);
    if (from === undefined || to === undefined) {
      throw new Error('The review period has no days.');
    }

    return runJournalEffect(
      Effect.gen(function* () {
        const areas = yield* AgentAreaRepository;
        const days = yield* areas.listDays(from, to);
        return { period, today, days: days.map(reviewDayOf) };
      }),
    );
  });
