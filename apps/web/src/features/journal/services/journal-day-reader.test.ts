import { describe, expect, it } from 'bun:test';
import { Effect } from 'effect';

import { anniversaryLimit } from '../anniversary.ts';
import type { AnniversaryEntry } from '../schemas/anniversary-entry.ts';
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
  it('classifies today and future dates without acquiring the repository', async () => {
    let acquisitions = 0;
    const reader = makeJournalDayReader(<A>() => {
      acquisitions += 1;
      return Promise.reject(
        new Error('The repository was acquired.'),
      ) as Promise<A>;
    });

    await expect(reader.readDated(today, today)).resolves.toEqual({
      disposition: 'today',
    });
    await expect(reader.readDated('2026-08-27', today)).resolves.toEqual({
      disposition: 'future',
    });
    expect(acquisitions).toBe(0);
  });

  it('reads the requested past day and its bounded memories in repository order', async () => {
    const readDates: Array<string> = [];
    const anniversaryReads: Array<{
      readonly before: string;
      readonly limit: number;
      readonly monthDay: string;
    }> = [];
    const earlier: ReadonlyArray<AnniversaryEntry> = [
      {
        date: '2025-08-25',
        journalMarkdown: '## Last year\n\nA clear opening.',
        journalWordCount: 5,
        revision: 4,
        scriptureMarkdown: '',
        scriptureWordCount: 7,
      },
      {
        date: '2023-08-25',
        journalMarkdown: 'Three years back.',
        journalWordCount: 3,
        revision: 2,
        scriptureMarkdown: '',
        scriptureWordCount: 2,
      },
    ];
    const repository = EntryRepository.make({
      read: (date) => {
        readDates.push(date);
        return Effect.succeed(entryOn(date));
      },
      readAnniversaries: (monthDay, before, limit) => {
        anniversaryReads.push({ before, limit, monthDay });
        return Effect.succeed(earlier);
      },
      readArchive: () => Effect.die('Archive access is outside this read.'),
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
        anniversaries: [
          {
            date: '2025-08-25',
            snippet: 'Last year A clear opening.',
            words: 12,
            yearsAgo: 1,
          },
          {
            date: '2023-08-25',
            snippet: 'Three years back.',
            words: 5,
            yearsAgo: 3,
          },
        ],
        anniversaryRevisions: [
          { date: '2025-08-25', revision: 4 },
          { date: '2023-08-25', revision: 2 },
        ],
      },
    });
    expect(acquisitions).toBe(1);
    expect(readDates).toEqual(['2026-08-25']);
    expect(anniversaryReads).toEqual([
      {
        before: '2026-08-25',
        limit: anniversaryLimit,
        monthDay: '08-25',
      },
    ]);
  });
});
