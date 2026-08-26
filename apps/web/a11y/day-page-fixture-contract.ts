import type { JournalEntry } from '../src/features/journal/schemas/entry.ts';

export type SaveOutcome =
  | 'stored'
  | 'failed'
  | 'validation'
  | 'authentication'
  | 'pending';

export type FixtureEntry = Omit<JournalEntry, 'createdAt' | 'updatedAt'> & {
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type DayPageFixtureConfig = {
  readonly entry: FixtureEntry;
  readonly today: JournalEntry['date'];
  readonly saveOutcomes: ReadonlyArray<SaveOutcome>;
};

export const journalEntryFromFixture = (entry: FixtureEntry): JournalEntry => ({
  ...entry,
  createdAt: new Date(entry.createdAt),
  updatedAt: new Date(entry.updatedAt),
});

export type DayPageFixtureWindow = Window & {
  postludeDayPageFixture: DayPageFixtureConfig;
};
