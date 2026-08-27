import type { Anniversary } from '../src/features/journal/anniversary.ts';
import type { JournalEntry } from '../src/features/journal/schemas/entry.ts';

export type SaveOutcome =
  | 'stored'
  | 'failed'
  | 'validation'
  | 'authentication'
  | 'conflict'
  | 'pending';

type FixtureTimestamp = string | null;

export type FixtureEntry = Omit<
  JournalEntry,
  'createdAt' | 'updatedAt' | 'journalFirstUsedAt' | 'scriptureFirstUsedAt'
> & {
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly journalFirstUsedAt: FixtureTimestamp;
  readonly scriptureFirstUsedAt: FixtureTimestamp;
};

export type DayPageFixtureConfig = {
  readonly anniversaries: ReadonlyArray<Anniversary>;
  readonly entry: FixtureEntry;
  readonly today: JournalEntry['date'];
  readonly saveOutcomes: ReadonlyArray<SaveOutcome>;
};

export const journalEntryFromFixture = (entry: FixtureEntry): JournalEntry => ({
  ...entry,
  createdAt: new Date(entry.createdAt),
  updatedAt: new Date(entry.updatedAt),
  journalFirstUsedAt:
    entry.journalFirstUsedAt === null
      ? null
      : new Date(entry.journalFirstUsedAt),
  scriptureFirstUsedAt:
    entry.scriptureFirstUsedAt === null
      ? null
      : new Date(entry.scriptureFirstUsedAt),
});

export type DayPageFixtureWindow = Window & {
  postludeDayPageFixture: DayPageFixtureConfig;
};
