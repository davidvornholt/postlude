import { expect, test } from '@playwright/test';

import {
  mountReadingPage,
  mountUnhydratedReadingPage,
  readingPageFixtureConfigs,
  scanReadingPage,
} from './reading-page-test-support.ts';

const colorSchemes = ['light', 'dark'] as const;
const nativeDateUrl = /\/on-this-day\?date=2026-12-24$/u;
const newestMemoryName = /1 year ago/u;
const olderMemoryName = /2 years ago/u;
const scriptureLinkName = /Read James 5:7-8/u;

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
    await expect(
      page.getByRole('link', { name: scriptureLinkName }),
    ).toBeFocused();
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

  test(`the heading opens the native no-script form in ${colorScheme} mode`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await page.route('**/on-this-day?date=2026-12-24', (route) =>
      route.fulfill({
        body: '<!doctype html><title>Opened date</title><p>Native date opened</p>',
        contentType: 'text/html',
      }),
    );
    await mountUnhydratedReadingPage(page, readingPageFixtureConfigs.onThisDay);
    const field = page.getByLabel(
      'Go to a date. Showing Wednesday, August 26, 2026.',
    );

    await page
      .getByRole('heading', { level: 1, name: 'Wednesday, August 26, 2026' })
      .click();
    await expect(field).toBeFocused();
    await expect(field).toBeVisible();
    await field.fill('2026-12-24');
    await scanReadingPage(page);
    await page.getByRole('button', { name: 'Open' }).click();

    await expect(page).toHaveURL(nativeDateUrl);
    await expect(page.getByText('Native date opened')).toBeVisible();
  });
}
