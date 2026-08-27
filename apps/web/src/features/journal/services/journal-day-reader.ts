import { Effect } from 'effect';

import {
  type Anniversary,
  anniversaryLimit,
  anniversaryOf,
  isoMonthStart,
} from '../anniversary.ts';
import type { JournalDate } from '../journal-day.ts';
import { emptyJournalEntry, type JournalEntry } from '../schemas/entry.ts';
import { EntryRepository } from './entry-repository.ts';

export type JournalDayView = {
  readonly entry: JournalEntry;
  readonly today: JournalDate;
  readonly anniversaries: ReadonlyArray<Anniversary>;
};

export type DatedJournalDay =
  | { readonly disposition: 'today' }
  | { readonly disposition: 'future' }
  | { readonly disposition: 'readable'; readonly view: JournalDayView };

type RunJournalReadEffect = <A, E>(
  effect: Effect.Effect<A, E, EntryRepository>,
) => Promise<A>;

export const makeJournalDayReader = (run: RunJournalReadEffect) => {
  const readJournalDay = (
    date: JournalDate,
    today: JournalDate,
  ): Promise<JournalDayView> =>
    run(
      Effect.gen(function* () {
        const entries = yield* EntryRepository;
        const entry = yield* entries.read(date);
        const earlier = yield* entries.readAnniversaries(
          date.slice(isoMonthStart),
          date,
          anniversaryLimit,
        );
        return {
          entry: entry ?? emptyJournalEntry(date),
          today,
          anniversaries: earlier.map(anniversaryOf(date)),
        };
      }),
    );

  const readToday = (today: JournalDate): Promise<JournalDayView> =>
    readJournalDay(today, today);

  const readDated = (
    date: JournalDate,
    today: JournalDate,
  ): Promise<DatedJournalDay> => {
    if (date === today) {
      return Promise.resolve({ disposition: 'today' });
    }
    if (date > today) {
      return Promise.resolve({ disposition: 'future' });
    }
    return readJournalDay(date, today).then((view) => ({
      disposition: 'readable',
      view,
    }));
  };

  return { readDated, readToday } as const;
};
