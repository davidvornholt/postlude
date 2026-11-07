import { expect, it } from 'bun:test';

import { renderInRouter } from '#/shared/testing/render-in-router.tsx';
import { plainText } from '#/shared/testing/rendered-html.ts';
import { shiftJournalDate } from '../journal-day.ts';
import {
  allTimeOf,
  blankDay,
  sampleInsightsView,
} from '../testing/insights-view.ts';
import { EntryCounts } from './entry-counts.tsx';
import { InsightsLead } from './insights-lead.tsx';
import { OnThisDay } from './on-this-day.tsx';

const today = '2026-08-26';
const thousand = 1000;
const million = 1_000_000;

it('groups the Insights totals in the journal convention', async () => {
  const journal = [
    { ...blankDay(shiftJournalDate(today, 1 - thousand)), journalWords: 1 },
    { ...blankDay(today), journalWords: million - 1 },
  ];
  const html = await renderInRouter(
    <InsightsLead
      view={sampleInsightsView(journal, allTimeOf(journal, today), today)}
    />,
  );

  expect(plainText(html)).toContain(
    'You have written on 2 of 1,000 days, 1,000,000 words in all.',
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
      date={today}
      today={today}
    />,
  );

  expect(plainText(html)).toContain('1,000 years ago');
  expect(html).toContain('href="/day/1026-08-26"');
});
