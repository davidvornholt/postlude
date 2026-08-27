import { expect, it } from 'bun:test';

import { parseObsidianJournal } from './obsidian-import.ts';

it('imports daily files, skips empty days, and recovers only the missing old day', () => {
  const result = parseObsidianJournal([
    {
      path: '/notes/2024-11-15.md',
      content: 'Friday, November 15, 2024\n\nLater copy',
    },
    { path: '/notes/2024-11-17.md', content: '' },
    {
      path: '/notes/Altes Tagebuch.md',
      content:
        'Friday, November 15, 2024\n\nOld duplicate\n\nSaturday, November 16 2024\n\nRecovered\n\nSunday, November 17, 2024\n\nOld empty-day prose',
    },
  ]);

  expect(result.issues).toEqual([]);
  expect(result.records).toEqual([
    {
      date: '2024-11-15',
      journalMarkdown: 'Later copy',
      scriptureMarkdown: '',
      source: '/notes/2024-11-15.md',
    },
    {
      date: '2024-11-16',
      journalMarkdown: 'Recovered',
      scriptureMarkdown: '',
      source: '/notes/Altes Tagebuch.md',
    },
  ]);
});

it('preserves a first line when its date does not match the filename', () => {
  const result = parseObsidianJournal([
    {
      path: '/notes/2024-11-15.md',
      content: 'Thursday, November 14, 2024\n\nKeep this label',
    },
    {
      path: '/notes/Altes Tagebuch.md',
      content: 'Saturday, November 16 2024\nRecovered',
    },
  ]);
  expect(result.records[0]?.journalMarkdown).toStartWith(
    'Thursday, November 14, 2024',
  );
});
