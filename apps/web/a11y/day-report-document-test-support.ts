/**
 * Ways into the day report Postlude draws from a document, shared by the tests
 * of its drawing and of its timeline's width: the drawing, a mark's card and
 * what it reads out, the figure that widens, and where things are.
 */

import type * as playwright from '@playwright/test';
import { expect } from '@playwright/test';

import {
  cardOf,
  cardText,
} from '../src/features/journal/day-report-timeline-cards.ts';
import { walkOrderOf } from '../src/features/journal/day-report-timeline-layout.ts';
import type {
  TimelineMark,
  TimelineRow,
} from '../src/features/journal/schemas/day-report-timeline.ts';
import { choose, reportTimeline } from './evening-flow-test-support.ts';
import type { Span } from './frame-recording-test-support.ts';

export const widen = { name: 'Widen the timeline' } as const;

/** The report document's timeline rows, in the order the drawing shows them. */
export const rows: ReadonlyArray<TimelineRow> = reportTimeline().groups.flatMap(
  (group) => group.rows,
);

/** The marks of a row in the order the arrow keys walk them. */
export const walkOf = (rowIndex: number): ReadonlyArray<TimelineMark> => {
  const row = rows[rowIndex];
  if (row === undefined) {
    throw new Error(`There is no row ${rowIndex}.`);
  }
  return walkOrderOf(row.marks).flatMap((index) => {
    const mark = row.marks[index];
    return mark === undefined ? [] : [mark];
  });
};

/** The mark the arrow keys reach at a place in a row's walk, the first by default. */
export const walkedMark = (rowIndex: number, place = 0): TimelineMark => {
  const mark = walkOf(rowIndex)[place];
  if (mark === undefined) {
    throw new Error(`Row ${rowIndex} has no mark ${place}.`);
  }
  return mark;
};

/** What the live region reads out for a mark of a row. */
export const cardTextOf = (rowIndex: number, mark: TimelineMark): string => {
  const row = rows[rowIndex];
  if (row === undefined) {
    throw new Error(`There is no row ${rowIndex}.`);
  }
  return cardText(cardOf(mark, row));
};

export const drawingOf = (page: playwright.Page): playwright.Locator =>
  page.getByRole('group', {
    name: 'Timeline: a drawing of the day by the hour',
  });

/** The card a mark shows, beside the drawing. */
export const markCard = (page: playwright.Page): playwright.Locator =>
  drawingOf(page).locator('xpath=following-sibling::div[1]');

/** The live region that reads out the mark a reader reached. */
export const liveRegion = (page: playwright.Page): playwright.Locator =>
  drawingOf(page).locator('xpath=following-sibling::p[@aria-live]');

/** The figure that holds the drawing and its legend, which widens. */
export const figureOf = (page: playwright.Page): playwright.Locator =>
  drawingOf(page).locator('xpath=../..');

/** The figure's place in the text column, which never moves. */
export const slotOf = (page: playwright.Page): playwright.Locator =>
  drawingOf(page).locator('xpath=../../..');

export const markAt = (
  page: playwright.Page,
  row: number,
  mark: number,
): playwright.Locator => page.locator(`[data-mark="${row}:${mark}"]`);

export const openReport = async (page: playwright.Page): Promise<void> => {
  await choose(page, 'Energy', 'Okay');
  await choose(page, 'Progress', 'Solid');
  await page.getByRole('button', { name: 'Show the report' }).click();
  await expect(drawingOf(page)).toBeVisible();
};

const boxOf = async (
  locator: playwright.Locator,
): Promise<{ x: number; y: number; width: number; height: number }> => {
  const box = await locator.boundingBox();
  if (box === null) {
    throw new Error('The element has no box.');
  }
  return box;
};

export const spanOf = async (locator: playwright.Locator): Promise<Span> => {
  const box = await boxOf(locator);
  return { left: box.x, right: box.x + box.width };
};

export const middleOf = async (
  locator: playwright.Locator,
): Promise<{ x: number; y: number }> => {
  const box = await boxOf(locator);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

/** Tabs from the report's own button to the drawing, past the widen control where there is one. */
export const tabToDrawing = async (page: playwright.Page): Promise<void> => {
  await page.getByRole('button', { name: 'Hide the report' }).focus();
  const drawing = drawingOf(page);
  for (const _ of [1, 2, 3]) {
    if (
      await drawing.evaluate((element) => element === document.activeElement)
    ) {
      return;
    }
    await page.keyboard.press('Tab');
  }
  await expect(drawing).toBeFocused();
};

export const scrollsSideways = (page: playwright.Page): Promise<boolean> =>
  page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
