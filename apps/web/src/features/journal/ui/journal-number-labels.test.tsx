import { expect, it } from 'bun:test';

import { renderInRouter } from '#/shared/testing/render-in-router.tsx';
import { plainText } from '#/shared/testing/rendered-html.ts';
import { activityWindow } from '../activity.ts';
import type { ArchiveView } from '../services/archive-fns.ts';
import { ArchivePage } from './archive-page.tsx';
import { EntryCounts } from './entry-counts.tsx';
import { OnThisDay } from './on-this-day.tsx';

const today = '2026-08-26';
const todayYear = 2026;
const thousand = 1000;
const million = 1_000_000;

const view: ArchiveView = {
  today,
  window: activityWindow(today),
  days: [
    {
      date: today,
      journalWords: 1,
      scriptureWords: 0,
      hasScripture: false,
      journalWrittenOnTheDay: true,
      scriptureUsedOnTheDay: false,
    },
  ],
  years: [todayYear],
  exportAvailable: true,
  journalStreak: { current: 1, longest: 1 },
  scriptureStreak: { current: 0, longest: 0 },
  totals: { daysWritten: thousand, words: million },
};

it('groups archive totals in the journal convention', async () => {
  const html = await renderInRouter(
    <ArchivePage selectedYear={undefined} view={view} />,
  );

  expect(plainText(html)).toContain(
    '1,000 days written, 1,000,000 words in all.',
  );
});

it('groups live word and character counts in the journal convention', async () => {
  const thousandWords = `${'a '.repeat(thousand - 1)}a`;
  const thousandCharacters = 'a'.repeat(thousand);

  expect(
    plainText(await renderInRouter(<EntryCounts markdown={thousandWords} />)),
  ).toContain('1,000 words · 1,999 characters');
  expect(
    plainText(
      await renderInRouter(<EntryCounts markdown={thousandCharacters} />),
    ),
  ).toContain('1 word · 1,000 characters');
});

it('groups an anniversary distance without changing its linked date', async () => {
  const html = await renderInRouter(
    <OnThisDay
      anniversaries={[
        {
          date: '1026-08-26',
          journalMarkdown: 'A distant beginning.',
          scriptureMarkdown: '',
          yearsAgo: thousand,
          words: 1,
        },
      ]}
      today={today}
    />,
  );

  expect(plainText(html)).toContain('1,000 years ago');
  expect(html).toContain('href="/day/1026-08-26"');
});
