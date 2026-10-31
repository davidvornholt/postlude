import type {
  AgentNoteView,
  WrapArea,
} from '../src/features/journal/schemas/agent-area.ts';
import type { DayRating } from '../src/features/journal/schemas/day-rating.ts';
import type { JournalEntry } from '../src/features/journal/schemas/entry.ts';
import type { EveningView } from '../src/features/journal/services/evening-fns.ts';
import { emptyEvening } from '../src/features/journal/testing/evening-view.ts';

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

/** An agent note with its instants as strings, so it survives `evaluate`. */
export type FixtureAgentNote = Omit<
  AgentNoteView,
  'requestedAt' | 'generatedAt'
> & {
  readonly requestedAt: FixtureTimestamp;
  readonly generatedAt: FixtureTimestamp;
};

export type FixtureEvening = {
  readonly rating: Omit<DayRating, 'closedAt'> & {
    readonly closedAt: FixtureTimestamp;
  };
  readonly wrap: Omit<WrapArea, 'reportGeneratedAt'> & {
    readonly reportGeneratedAt: FixtureTimestamp;
  };
  readonly agentNote: FixtureAgentNote;
  /** What a pending note has become by the time the page looks again. */
  readonly settledNote?: FixtureAgentNote;
  /** Whether saving a rating reaches the server. */
  readonly ratingSaves?: 'stored' | 'failed';
};

export type DayPageFixtureConfig = {
  readonly entry: FixtureEntry;
  readonly today: JournalEntry['date'];
  readonly saveOutcomes: ReadonlyArray<SaveOutcome>;
  /** The day's evening; an empty one when absent. */
  readonly evening?: FixtureEvening | 'unavailable';
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

const dateOf = (instant: FixtureTimestamp): Date | null =>
  instant === null ? null : new Date(instant);

export const agentNoteFromFixture = (
  note: FixtureAgentNote,
): AgentNoteView => ({
  ...note,
  requestedAt: dateOf(note.requestedAt),
  generatedAt: dateOf(note.generatedAt),
});

export const eveningFromFixture = (
  config: DayPageFixtureConfig,
): EveningView | undefined => {
  const { evening, entry } = config;
  if (evening === 'unavailable') {
    return;
  }
  if (evening === undefined) {
    return emptyEvening(entry.date, entry.revision);
  }
  return {
    date: entry.date,
    rating: { ...evening.rating, closedAt: dateOf(evening.rating.closedAt) },
    wrap: {
      ...evening.wrap,
      reportGeneratedAt: dateOf(evening.wrap.reportGeneratedAt),
    },
    agentNote: agentNoteFromFixture(evening.agentNote),
  };
};

export type DayPageFixtureWindow = Window & {
  postludeDayPageFixture: DayPageFixtureConfig;
  /** Holds back the answers to evening calls recorded under this name. */
  postludeHoldEveningCalls: (call: string) => void;
  /** Sends the answers held back under this name, and holds no more. */
  postludeReleaseEveningCalls: (call: string) => void;
  /** Leaves the day and opens it again, reading its evening anew. */
  postludeRevisitDay: () => Promise<void>;
};
