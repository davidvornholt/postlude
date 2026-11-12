/**
 * A control's tip and a timeline mark's card show while a pointer rests on
 * them, on focus from the keyboard, and on a tap. A mouse click never leaves
 * one open, and a tap elsewhere or a scroll closes one a tap opened.
 */

import type * as playwright from '@playwright/test';
import { expect, test } from '@playwright/test';

import { mountDayPage } from './day-page-test-support.ts';
import {
  drawingOf,
  markAt,
  markCard,
  middleOf,
  openReport,
  tabToDrawing,
  widen,
} from './day-report-document-test-support.ts';
import { mountEvening } from './evening-flow-test-support.ts';

/** A corner of the window, away from every control. */
const awayPx = 4;
const scrollPx = 40;
const wideScreen = { width: 1400, height: 900 } as const;

const scrollDown = (page: playwright.Page): Promise<void> =>
  page.evaluate((by) => window.scrollBy(0, by), scrollPx);

const tap = async (
  page: playwright.Page,
  locator: playwright.Locator,
): Promise<void> => {
  const { x, y } = await middleOf(locator);
  await page.touchscreen.tap(x, y);
};

/** A click on the widen control hides its tip at once, and it shows again only on the next visit. */
const clickTheControl = async (
  page: playwright.Page,
): Promise<playwright.Locator> => {
  await page.setViewportSize(wideScreen);
  await mountEvening(page, 'report');
  await openReport(page);
  const control = page.getByRole('button', widen);
  const tip = page.getByRole('tooltip').filter({ hasText: widen.name });

  await control.hover();
  await expect(tip).toBeVisible();
  await control.click();
  await expect(control).toHaveAttribute('aria-pressed', 'true');
  await expect(control).toBeFocused();
  await expect(tip).toBeHidden();
  await page.mouse.move(awayPx, awayPx);
  await expect(tip).toBeHidden();
  await control.hover();
  await expect(tip).toBeVisible();
  await page.mouse.move(awayPx, awayPx);
  await expect(tip).toBeHidden();

  // From the keyboard the tip shows on focus, and Escape or leaving hides it.
  await tabToDrawing(page);
  await page.keyboard.press('Shift+Tab');
  await expect(control).toBeFocused();
  await expect(tip).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(tip).toBeHidden();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(tip).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(drawingOf(page)).toBeFocused();
  return tip;
};

/** A tap shows a writing tool's tip, and a second tap, one elsewhere or a scroll hides it. */
const tapTheControl = async (
  page: playwright.Page,
): Promise<playwright.Locator> => {
  await mountDayPage(page, ['stored']);
  const evening = page.getByRole('textbox', { name: 'Evening journal' });
  await evening.fill('Keep writing.');
  const bold = page
    .getByRole('region', { name: 'Evening', exact: true })
    .getByRole('toolbar')
    .getByRole('button', { name: 'Bold', exact: true });
  const tip = page.getByRole('tooltip').filter({ hasText: 'Bold' });

  await tap(page, bold);
  await expect(tip).toBeVisible();
  await tap(page, bold);
  await expect(tip).toBeHidden();
  await tap(page, bold);
  await expect(tip).toBeVisible();
  await tap(page, evening);
  await expect(tip).toBeHidden();
  await tap(page, bold);
  await expect(tip).toBeVisible();
  await scrollDown(page);
  return tip;
};

test("a control's tip shows for a resting pointer, keyboard focus or a tap, and a click never leaves it open", async ({
  page,
  hasTouch,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const tip = await (hasTouch ? tapTheControl(page) : clickTheControl(page));
  await expect(tip).toBeHidden();
});

/** A click on a mark keeps its card only while the pointer stays, though the drawing now has focus. */
const clickAMark = async (page: playwright.Page): Promise<void> => {
  const card = markCard(page);
  const mark = markAt(page, 0, 1);
  await mark.scrollIntoViewIfNeeded();
  const { x, y } = await middleOf(mark);
  await page.mouse.click(x, y);
  await expect(drawingOf(page)).toBeFocused();
  await expect(card).toContainText('Part 2 · Into the work');
  await page.mouse.move(awayPx, awayPx);
  await expect(drawingOf(page)).toBeFocused();
};

/** A tapped mark's card goes when the page scrolls. */
const tapAMarkAndScroll = async (page: playwright.Page): Promise<void> => {
  const card = markCard(page);
  const mark = markAt(page, 0, 1);
  await mark.scrollIntoViewIfNeeded();
  await tap(page, mark);
  await expect(card).toContainText('Part 2 · Into the work');
  await scrollDown(page);
};

test("a mark's card never stays after a click, and a tapped one goes on scroll", async ({
  page,
  hasTouch,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mountEvening(page, 'report');
  await openReport(page);
  await (hasTouch ? tapAMarkAndScroll(page) : clickAMark(page));
  await expect(markCard(page)).toBeHidden();
});
