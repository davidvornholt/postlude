import { expect, test } from '@playwright/test';

import { mountMemoryDayPage, scan } from './day-page-test-support.ts';

const colorSchemes = ['light', 'dark'] as const;
const newestMemoryName = /Moved the desk under the window/u;
const olderMemoryName = /A-long-unbroken-memory/u;

for (const colorScheme of colorSchemes) {
  test(`memories remain readable and operable in ${colorScheme} mode`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await mountMemoryDayPage(page);

    const section = page
      .getByRole('heading', { name: 'On this day' })
      .locator('..');
    const newest = page.getByRole('link', {
      name: newestMemoryName,
    });
    const older = page.getByRole('link', {
      name: olderMemoryName,
    });
    await expect(newest).toHaveAttribute('href', '/day/2025-08-26');
    await expect(older).toHaveAttribute('href', '/day/2024-08-26');

    const eveningBox = await page
      .getByRole('heading', { name: 'Evening' })
      .locator('..')
      .boundingBox();
    const memoryBox = await section.boundingBox();
    expect(eveningBox).not.toBeNull();
    expect(memoryBox).not.toBeNull();
    expect(memoryBox?.y ?? 0).toBeGreaterThanOrEqual(
      (eveningBox?.y ?? 0) + (eveningBox?.height ?? 0),
    );

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
    await scan(page);
  });
}
