import { expect, test } from '@playwright/test';

import type { ReadingPageFixtureConfig } from './reading-page-fixture-contract.ts';
import {
  mountReadingPage,
  scanReadingPage,
} from './reading-page-test-support.ts';

const colorSchemes = ['light', 'dark'] as const;
const today = '2027-02-28';
const leapDayMemoryName = /3 years ago · Thursday, February 29, 2024/u;
const leapDayNote =
  'Written on a leap day, and shown on February 28 because this year has no February 29.';

const leapDayOnFebruary28 = {
  kind: 'on-this-day',
  view: {
    anniversaries: [
      {
        date: '2024-02-29',
        journalMarkdown: 'The extra day went to the garden.',
        leapDayOnFebruary28: true,
        scriptureMarkdown: '',
        yearsAgo: 3,
        words: 6,
      },
      {
        date: '2024-02-28',
        journalMarkdown: 'The usual last day of February.',
        scriptureMarkdown: '',
        yearsAgo: 3,
        words: 6,
      },
    ],
    date: today,
    today,
  },
} satisfies ReadingPageFixtureConfig;

for (const colorScheme of colorSchemes) {
  test(`a leap day read on February 28 explains itself in ${colorScheme} mode`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await mountReadingPage(page, leapDayOnFebruary28);

    await expect(
      page.getByRole('link', { name: leapDayMemoryName }),
    ).toHaveAttribute('href', '/day/2024-02-29');
    await expect(
      page.getByRole('article', { name: leapDayMemoryName }),
    ).toHaveAccessibleDescription(leapDayNote);
    await expect(page.getByText(leapDayNote)).toHaveCount(1);
    await scanReadingPage(page);
  });
}
