import type * as playwright from '@playwright/test';
import { expect, test } from '@playwright/test';

import {
  archiveFixtureConfigs,
  mountArchivePage,
  scanArchive,
} from './archive-page-test-support.ts';
import { mountDayPage, scan } from './day-page-test-support.ts';
import {
  expectContainedGeometry,
  expectPageFrameGeometry,
  expectReadingMeasureGeometry,
  expectViewportBandGeometry,
} from './reading-comfort-test-support.ts';
import { mountSearchPage, scanSearch } from './search-page-test-support.ts';

const colorSchemes = ['light', 'dark'] as const;
const deepGround = /^oklch\(0\.[0-4]/u;
const writtenSummary = /days written, .* words in all/u;

const expectKeyboardFocus = async (
  page: playwright.Page,
  control: playwright.Locator,
) => {
  await page.keyboard.press('Tab');
  await expect(control).toBeFocused();
  const focus = await control.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      style: style.outlineStyle,
      width: Number.parseFloat(style.outlineWidth),
    };
  });
  expect(focus.style).not.toBe('none');
  expect(focus.width).toBeGreaterThanOrEqual(2);
};

for (const colorScheme of colorSchemes) {
  test(`the writing frame and register preserve reading comfort in ${colorScheme} mode`, async ({
    page,
  }, testInfo) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await mountDayPage(page, ['stored']);

    const date = page.getByRole('heading', { level: 1 });
    const evening = page.getByRole('textbox', { name: 'Evening journal' });
    await expectPageFrameGeometry(date.locator('..'));
    await expectReadingMeasureGeometry(page, evening.locator('xpath=../..'));
    await expectKeyboardFocus(
      page,
      page.getByRole('link', { name: 'Previous day' }),
    );

    const dateLayout = await date.evaluate((element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      const lines = new Set(
        Array.from(range.getClientRects(), (rectangle) =>
          Math.round(rectangle.top),
        ),
      );
      const style = getComputedStyle(element);
      return {
        lines: lines.size,
        wrapping: style.textWrapStyle || style.textWrap,
      };
    });
    expect(dateLayout.wrapping).toContain('balance');
    expect(dateLayout.lines).toBe(
      testInfo.project.name.includes('mobile') ? 2 : 1,
    );

    const register = page
      .getByRole('heading', {
        name: 'Morning scripture',
      })
      .locator('xpath=../..');
    await expectViewportBandGeometry(register);
    await expectPageFrameGeometry(
      page.getByRole('heading', { name: 'Morning scripture' }).locator('..'),
    );
    const registerColors = await register.evaluate((element) => ({
      ground: getComputedStyle(element).backgroundColor,
      page: getComputedStyle(document.body).backgroundColor,
    }));
    expect(registerColors.ground).not.toBe(registerColors.page);
    expect(registerColors.ground).toMatch(deepGround);
    await scan(page);
  });

  test(`the archive keeps the shared frame and reading measure in ${colorScheme} mode`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await mountArchivePage(page, archiveFixtureConfigs.filled);
    const heading = page.getByRole('heading', { name: 'Archive' });
    await expect(heading).toBeVisible();
    await expectPageFrameGeometry(heading.locator('..'));
    await expectReadingMeasureGeometry(page, page.getByText(writtenSummary));
    await expectKeyboardFocus(
      page,
      page.getByRole('link', { name: 'Past year' }),
    );
    await scanArchive(page);
  });

  test(`search keeps the shared frame and reading measure in ${colorScheme} mode`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await mountSearchPage(page, 'populated');
    const heading = page.getByRole('heading', { name: 'Search' });
    const searchbox = page.getByRole('searchbox', { name: 'Words to find' });
    const form = searchbox.locator('xpath=ancestor::form');
    await expect(heading).toBeVisible();
    await expectPageFrameGeometry(heading.locator('..'));
    await expectReadingMeasureGeometry(
      page,
      page.getByText('Every evening you have written is searchable'),
    );
    await expectReadingMeasureGeometry(page, form);
    await expectContainedGeometry(searchbox, form);
    await expectKeyboardFocus(page, searchbox);
    await scanSearch(page);
  });
}
