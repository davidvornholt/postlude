import { renderInRouter } from '#/shared/testing/render-in-router.tsx';
import type { JournalEntry } from '../schemas/entry.ts';
import { DayPage } from './day-page.tsx';

export const today = '2026-08-26';

export const entryOn = (
  overrides: Partial<JournalEntry> = {},
): JournalEntry => ({
  date: today,
  journalMarkdown: '',
  journalWordCount: 0,
  journalFirstUsedAt: null,
  scriptureMarkdown: '',
  scriptureWordCount: 0,
  revision: 0,
  scriptureFirstUsedAt: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  ...overrides,
});

const neverSaves = () => new Promise<never>(() => undefined);

export const renderDay = (entry: JournalEntry): Promise<string> =>
  renderInRouter(<DayPage entry={entry} save={neverSaves} today={today} />);
