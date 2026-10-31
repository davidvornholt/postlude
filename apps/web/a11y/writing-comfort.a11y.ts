import type * as playwright from '@playwright/test';
import { expect, test } from '@playwright/test';

import { journalLanguage } from '../src/features/journal/journal-language.ts';
import {
  mountDayPage,
  mountUnhydratedDayPage,
  scan,
} from './day-page-test-support.ts';

const shortViewportHeight = 560;
const paragraphs = 30;
const stepsUp = 20;
const readingSize = '18px';
const readingLeading = '28px';
// In page order, which is the order their settings are read in.
const writingAreas = [
  { label: 'Morning scripture notes', minHeight: '96px' },
  { label: 'Evening journal', minHeight: '192px' },
] as const;

const caretGeometry = (page: playwright.Page) =>
  page.evaluate(() => {
    const range = getSelection()?.getRangeAt(0);
    const caret = range?.getClientRects()[0] ?? range?.getBoundingClientRect();
    const bar = document
      .querySelector('[data-formatting-toolbar]')
      ?.getBoundingClientRect();
    return {
      barBottom: bar?.bottom ?? Number.NaN,
      caretBottom: caret?.bottom ?? Number.NaN,
      caretTop: caret?.top ?? Number.NaN,
      viewportHeight: globalThis.innerHeight,
    };
  });

test('the caret stays clear of the pinned writing tools in a long entry', async ({
  page,
}) => {
  const { width } = page.viewportSize() ?? { width: 0 };
  await page.setViewportSize({ width, height: shortViewportHeight });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mountDayPage(page, ['stored']);
  const evening = page.getByRole('textbox', { name: 'Evening journal' });
  await evening.focus();
  for (let paragraph = 1; paragraph <= paragraphs; paragraph += 1) {
    await page.keyboard.type(`Paragraph ${paragraph} of a long evening.`);
    await page.keyboard.press('Enter');
  }

  const afterTyping = await caretGeometry(page);
  expect(afterTyping.caretBottom).toBeLessThanOrEqual(
    afterTyping.viewportHeight,
  );

  // Arrow keys move the native caret, and the browser alone would scroll only
  // until it reaches the top of the window, under the pinned toolbar.
  for (let step = 0; step < stepsUp; step += 1) {
    await page.keyboard.press('ArrowUp');
  }
  await expect
    .poll(async () => {
      const geometry = await caretGeometry(page);
      return geometry.caretTop >= geometry.barBottom;
    })
    .toBe(true);
  expect(await page.evaluate(() => globalThis.scrollY)).toBeGreaterThan(0);
});

test('the pinned writing tools stay one row on every screen', async ({
  page,
}) => {
  await mountDayPage(page, ['stored']);
  const bar = page.locator('[data-formatting-toolbar]');
  const tools = page.getByRole('toolbar');
  const [barBox, toolsBox] = await Promise.all([
    bar.boundingBox(),
    tools.boundingBox(),
  ]);
  // The bar is the row of tools plus its padding and rules. On a phone the
  // name of the area they act on would be a second row above them, and the
  // bar would cover that much more of the writing it is pinned over.
  const toolsHeight = toolsBox?.height ?? 0;
  expect(toolsHeight).toBeGreaterThan(0);
  expect((barBox?.height ?? 0) - toolsHeight).toBeLessThan(toolsHeight / 2);
  await page.getByRole('textbox', { name: 'Evening journal' }).focus();
  await expect(tools).toHaveAccessibleName('Formatting Evening journal');
});

const writingSettings = (areas: playwright.Locator) =>
  areas.evaluateAll((elements) =>
    elements.map((element) => {
      const style = getComputedStyle(element);
      return {
        fontSize: style.fontSize,
        lang: element.getAttribute('lang'),
        lineHeight: style.lineHeight,
        minHeight: style.minHeight,
        whiteSpace: style.whiteSpace,
      };
    }),
  );

const expectedSettings = writingAreas.map(({ minHeight }) => ({
  fontSize: readingSize,
  lang: journalLanguage,
  lineHeight: readingLeading,
  minHeight,
  whiteSpace: 'pre-wrap',
}));

test('the writing is set in its own language, at reading size, before and after hydration', async ({
  page,
}) => {
  await mountUnhydratedDayPage(page);
  expect(await writingSettings(page.locator('.journal-prose'))).toEqual(
    expectedSettings,
  );

  await mountDayPage(page, ['stored']);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  const editors = page.locator(
    writingAreas
      .map(({ label }) => `[role="textbox"][aria-label="${label}"]`)
      .join(', '),
  );
  await expect(editors).toHaveCount(writingAreas.length);
  expect(await writingSettings(editors)).toEqual(expectedSettings);
  await scan(page);
});
