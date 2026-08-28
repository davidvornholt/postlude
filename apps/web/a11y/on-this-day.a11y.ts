import { expect, test } from '@playwright/test';

import {
  mountReadingPage,
  readingPageFixtureConfigs,
  scanReadingPage,
} from './reading-page-test-support.ts';

const colorSchemes = ['light', 'dark'] as const;
const newestMemoryName = /Moved the desk under the window/u;
const olderMemoryName = /A-long-unbroken-memory/u;

for (const colorScheme of colorSchemes) {
  test(`memories remain readable and operable in ${colorScheme} mode`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await mountReadingPage(page, readingPageFixtureConfigs.onThisDay);
    const nextDate = page.getByRole('link', { name: 'Next date' });
    await expect(nextDate).toHaveAttribute(
      'href',
      '/on-this-day?date=2026-08-27',
    );
    const newest = page.getByRole('link', {
      name: newestMemoryName,
    });
    const older = page.getByRole('link', {
      name: olderMemoryName,
    });
    await expect(newest).toHaveAttribute('href', '/day/2025-08-26');
    await expect(older).toHaveAttribute('href', '/day/2024-08-26');

    await newest.focus();
    await page.keyboard.press('Tab');
    await expect(older).toBeFocused();
    const focus = await older.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        outline: style.outlineStyle,
        width: Number.parseFloat(style.outlineWidth),
      };
    });
    expect(focus.outline).not.toBe('none');
    expect(focus.width).toBeGreaterThanOrEqual(2);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= globalThis.innerWidth,
      ),
    ).toBe(true);
    await scanReadingPage(page);
  });
}
