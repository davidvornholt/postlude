import { expect, test } from '@playwright/test';

import {
  insightsFixtureConfigs,
  mountInsightsPageWithoutJavaScript,
  scanInsights,
} from './insights-page-test-support.ts';

const colorSchemes = ['light', 'dark'] as const;

for (const colorScheme of colorSchemes) {
  test(`recoverable source stays exportable without activity in ${colorScheme} mode`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await mountInsightsPageWithoutJavaScript(
      page,
      insightsFixtureConfigs.sourceOnly,
    );
    await expect(
      page.getByText('Nothing written yet. Insights fill in as the days do.'),
    ).toBeVisible();
    const form = page.locator('form[action="/insights/export"]');
    const button = form.getByRole('button', { name: 'Download the journal' });
    await expect(button).toBeVisible();
    await expect(form).toHaveAttribute('method', 'post');
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await scanInsights(page);
  });
}
