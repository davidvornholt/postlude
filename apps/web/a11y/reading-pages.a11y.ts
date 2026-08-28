import { expect, test } from '@playwright/test';

import {
  mountReadingPage,
  readingPageFixtureConfigs,
  scanReadingPage,
} from './reading-page-test-support.ts';

for (const colorScheme of ['light', 'dark'] as const) {
  for (const [name, config] of Object.entries(readingPageFixtureConfigs)) {
    test(`${name} passes WCAG 2.2 AA in ${colorScheme} mode`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await mountReadingPage(page, config);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await scanReadingPage(page);
    });
  }
}
