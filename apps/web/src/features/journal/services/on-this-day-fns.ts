import { createServerFn } from '@tanstack/react-start';
import { Effect } from 'effect';

import { sessionRequired } from '#/shared/auth/auth-middleware.ts';
import {
  type Anniversary,
  anniversaryLimit,
  anniversaryOf,
  isoMonthStart,
  onThisDayDate,
} from '../anniversary.ts';
import type { JournalDate } from '../journal-day.ts';
import { decodeOnThisDayQuery } from '../schemas/on-this-day-query.ts';
import { EntryRepository } from './entry-repository.ts';
import { currentJournalDate } from './journal-fns.ts';
import { runJournalEffect } from './journal-runtime.ts';

export type OnThisDayView = {
  readonly anniversaries: ReadonlyArray<Anniversary>;
  readonly date: JournalDate;
  readonly today: JournalDate;
};

export const readOnThisDayFn = createServerFn({ method: 'GET' })
  .middleware([sessionRequired])
  .validator((input: unknown) => decodeOnThisDayQuery(input ?? {}))
  .handler(({ data }): Promise<OnThisDayView> => {
    const today = currentJournalDate();
    const date = onThisDayDate(data.date, today);
    return runJournalEffect(
      Effect.gen(function* () {
        const entries = yield* EntryRepository;
        const earlier = yield* entries.readAnniversaries(
          date.slice(isoMonthStart),
          date,
          anniversaryLimit,
        );
        return {
          anniversaries: earlier.map(anniversaryOf(date)),
          date,
          today,
        };
      }),
    );
  });
