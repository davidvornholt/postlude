import { describe, expect, it } from 'bun:test';
import { Effect } from 'effect';

import type { JournalEntry } from '../schemas/entry.ts';
import { EntryRepository } from './entry-repository.ts';
import { makeJournalDayReader } from './journal-day-reader.ts';

const today = '2026-08-26';

const entryOn = (date: string): JournalEntry => ({
  date,
  journalMarkdown: 'The requested evening.',
  journalWordCount: 3,
  journalFirstUsedAt: new Date(0),
  scriptureMarkdown: '',
  scriptureWordCount: 0,
  revision: 0,
  scriptureFirstUsedAt: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
});

describe('dated journal day service boundary', () => {
  it('keeps today canonical while reading a future date like any other day', async () => {
    const reader = makeJournalDayReader(
      <A>() =>
        Promise.resolve({
          entry: entryOn('2026-08-27'),
          today,
        }) as Promise<A>,
    );

    await expect(reader.readDated(today, today)).resolves.toEqual({
      disposition: 'today',
    });
    await expect(reader.readDated('2026-08-27', today)).resolves.toEqual({
      disposition: 'readable',
      view: {
        entry: entryOn('2026-08-27'),
        today,
      },
    });
  });

  it('reads only the requested past day', async () => {
    const readDates: Array<string> = [];
    const repository = EntryRepository.make({
      read: (date) => {
        readDates.push(date);
        return Effect.succeed(entryOn(date));
      },
      readAnniversaries: () =>
        Effect.die('Anniversary access is outside this read.'),
      readArchive: () => Effect.die('Archive access is outside this read.'),
      readCalendar: () => Effect.die('Calendar access is outside this read.'),
      save: () => Effect.die('Write access is outside this read.'),
    });
    let acquisitions = 0;
    const reader = makeJournalDayReader(
      <A, E>(effect: Effect.Effect<A, E, EntryRepository>) => {
        acquisitions += 1;
        return Effect.runPromise(
          effect.pipe(Effect.provideService(EntryRepository, repository)),
        );
      },
    );

    await expect(reader.readDated('2026-08-25', today)).resolves.toEqual({
      disposition: 'readable',
      view: {
        entry: entryOn('2026-08-25'),
        today,
      },
    });
    expect(acquisitions).toBe(1);
    expect(readDates).toEqual(['2026-08-25']);
  });
});
