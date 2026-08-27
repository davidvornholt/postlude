import { expect, test } from '@playwright/test';

import {
  archiveFixtureConfigs,
  mountArchivePageWithoutJavaScript,
  scanArchive,
} from './archive-page-test-support.ts';

const colorSchemes = ['light', 'dark'] as const;

for (const colorScheme of colorSchemes) {
  test(`recoverable source stays exportable without activity in ${colorScheme} mode`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await mountArchivePageWithoutJavaScript(
      page,
      archiveFixtureConfigs.sourceOnly,
    );
    await expect(page.getByText('No writing activity yet')).toBeVisible();
    const form = page.locator('form[action="/archive/export"]');
    const button = form.getByRole('button', { name: 'Download the journal' });
    await expect(button).toBeVisible();
    await expect(form).toHaveAttribute('method', 'post');
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await scanArchive(page);
  });
}
