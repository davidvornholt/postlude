import type * as playwright from '@playwright/test';
import { expect, test } from '@playwright/test';

import {
  archiveFixtureConfigs,
  mountArchivePage,
  scanArchive,
} from './archive-page-test-support.ts';
import { mountDayPage, scan } from './day-page-test-support.ts';
import { mountSearchPage, scanSearch } from './search-page-test-support.ts';

const colorSchemes = ['light', 'dark'] as const;
const pageFrameMaximumRem = 56;
const readingMeasureCharacters = 65;
const geometryTolerance = 1;
const deepGround = /^oklch\(0\.[0-4]/u;
const writtenSummary = /days written, .* words in all/u;

const expectPageGeometry = async (
  page: playwright.Page,
  frame: playwright.Locator,
  readingMeasure: playwright.Locator,
) => {
  const frameGeometry = await frame.evaluate((element, maximumRem) => {
    const rectangle = element.getBoundingClientRect();
    const rootSize = Number.parseFloat(
      getComputedStyle(document.documentElement).fontSize,
    );
    return {
      expectedWidth: Math.min(globalThis.innerWidth, maximumRem * rootSize),
      left: rectangle.left,
      right: globalThis.innerWidth - rectangle.right,
      width: rectangle.width,
    };
  }, pageFrameMaximumRem);
  expect(frameGeometry.width).toBeCloseTo(frameGeometry.expectedWidth, 0);
  expect(
    Math.abs(frameGeometry.left - frameGeometry.right),
  ).toBeLessThanOrEqual(geometryTolerance);

  const measure = await readingMeasure.evaluate((element, characters) => {
    const style = getComputedStyle(element);
    const probe = document.createElement('span');
    probe.style.cssText = [
      'position:fixed',
      'visibility:hidden',
      `font-family:${style.fontFamily}`,
      `font-size:${style.fontSize}`,
      `font-stretch:${style.fontStretch}`,
      `font-style:${style.fontStyle}`,
      `font-weight:${style.fontWeight}`,
      `width:${characters}ch`,
    ].join(';');
    document.body.append(probe);
    const expectedMaxWidth = probe.getBoundingClientRect().width;
    probe.remove();
    return {
      expectedMaxWidth,
      maxWidth: Number.parseFloat(style.maxWidth),
    };
  }, readingMeasureCharacters);
  expect(measure.maxWidth).toBeCloseTo(measure.expectedMaxWidth, 0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= globalThis.innerWidth,
    ),
  ).toBe(true);
};

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
    await expectPageGeometry(
      page,
      date.locator('..'),
      evening.locator('xpath=../..'),
    );
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
    await expectPageGeometry(
      page,
      heading.locator('..'),
      page.getByText(writtenSummary),
    );
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
    await expect(heading).toBeVisible();
    await expectPageGeometry(
      page,
      heading.locator('..'),
      page.getByText('Every evening you have written is searchable'),
    );
    await expectKeyboardFocus(
      page,
      page.getByRole('searchbox', { name: 'Words to find' }),
    );
    await scanSearch(page);
  });
}
