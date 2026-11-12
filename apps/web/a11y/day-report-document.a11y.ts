import type * as playwright from '@playwright/test';
import { expect, test } from '@playwright/test';

import {
  cardTextOf,
  drawingOf,
  liveRegion,
  markAt,
  markCard,
  middleOf,
  openReport,
  rows,
  scrollsSideways,
  spanOf,
  tabToDrawing,
  walkedMark,
  widen,
} from './day-report-document-test-support.ts';
import {
  mountEvening,
  scanPage,
  unknownBlockText,
} from './evening-flow-test-support.ts';

const colorSchemes = ['light', 'dark'] as const;
const sourcesHeading = /^Sources/u;
const firstPartHeading = /^Part 1: A slow start/u;
const landedPullRequest = /Landed postlude #\d+: /u;
/** Longer than a card stays once the pointer has left it and its mark. */
const pastHideDelayMs = 600;

for (const colorScheme of colorSchemes) {
  test(`a report document is drawn by Postlude itself, with its parts in words and a block it doesn't know as words, in ${colorScheme} mode`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await mountEvening(page, 'report');
    await openReport(page);

    await expect(page.locator('iframe')).toHaveCount(0);
    await expect(
      page.getByRole('group', { name: 'The day in numbers' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'The day in parts', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: firstPartHeading }),
    ).toBeVisible();
    await expect(drawingOf(page)).toHaveAccessibleDescription(
      "The day in parts describes the day in words. Use the arrow keys to read the timeline's marks one at a time.",
    );
    await expect(page.getByText(unknownBlockText)).toBeVisible();
    await scanPage(page);

    // A section /wrap folded away opens from its heading.
    const sources = page.getByRole('button', { name: sourcesHeading });
    await expect(sources).toHaveAttribute('aria-expanded', 'false');
    const regionId = await sources.getAttribute('aria-controls');
    await sources.click();
    await expect(sources).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator(`[id="${regionId}"]`)).toBeVisible();

    // A mark's card and its ring, reached from the keyboard.
    await tabToDrawing(page);
    await expect(markCard(page)).toBeVisible();
    await scanPage(page);
  });
}

test("the timeline's marks are read one at a time from the keyboard, each row's first mark from Home", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mountEvening(page, 'report');
  await openReport(page);

  await tabToDrawing(page);
  const live = liveRegion(page);
  const card = markCard(page);
  await expect(live).toHaveText(cardTextOf(0, walkedMark(0)));
  await expect(card).toBeVisible();
  await expect(card).toContainText('Part 1 · A slow start');
  await page.keyboard.press('ArrowRight');
  await expect(live).toHaveText(cardTextOf(0, walkedMark(0, 1)));

  // Down reaches each row in turn, and Home its first mark in time.
  const kinds = new Set<string>();
  const laterRows = [...rows.keys()].filter(
    (index) => index > 0 && (rows[index]?.marks.length ?? 0) > 0,
  );
  for (const index of laterRows) {
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Home');
    const mark = walkedMark(index);
    await expect(live).toHaveText(cardTextOf(index, mark));
    kinds.add(mark.kind);
  }
  expect([...kinds].sort()).toEqual([
    'appointment',
    'mail',
    'pullRequest',
    'run',
    'screen',
  ]);
  // The first run landed a pull request, and its card says which.
  const firstRun = rows.findIndex((row) =>
    row.marks.some((mark) => mark.kind === 'run'),
  );
  expect(cardTextOf(firstRun, walkedMark(firstRun))).toMatch(landedPullRequest);

  await page.keyboard.press('Escape');
  await expect(card).toBeHidden();
  await expect(live).toHaveText('');
  await expect(drawingOf(page)).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(card).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(card).toBeHidden();
});

/** A mouse shows the nearest mark's card, which stays while the pointer is on it, and goes once it leaves or on Escape. */
const pointAtMarks = async (page: playwright.Page): Promise<void> => {
  const card = markCard(page);
  await markAt(page, 0, 1).scrollIntoViewIfNeeded();
  const mark = await middleOf(markAt(page, 0, 1));
  await page.mouse.move(mark.x, mark.y);
  await expect(card).toBeVisible();
  await expect(card).toContainText('Part 2 · Into the work');
  // A pointer's card is not read out: the keyboard reaches the same marks.
  await expect(liveRegion(page)).toHaveText('');

  const onCard = await middleOf(card);
  await page.mouse.move(onCard.x, onCard.y);
  // The card has to be seen to stay, so the test waits out its delay.
  await page.evaluate(
    (ms) =>
      new Promise((resolve) => {
        setTimeout(resolve, ms);
      }),
    pastHideDelayMs,
  );
  await expect(card).toBeVisible();
  await page.mouse.move(4, 4);
  await expect(card).toBeHidden();

  await page.mouse.move(mark.x, mark.y);
  await expect(card).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(card).toBeHidden();
};

/** A tap shows a mark's card, and a second tap or one elsewhere hides it. */
const tapMarks = async (page: playwright.Page): Promise<void> => {
  const card = markCard(page);
  await markAt(page, 0, 0).scrollIntoViewIfNeeded();
  const first = await middleOf(markAt(page, 0, 0));
  await page.touchscreen.tap(first.x, first.y);
  await expect(card).toBeVisible();
  await expect(card).toContainText('Part 1 · A slow start');
  await expect(liveRegion(page)).toHaveText(cardTextOf(0, walkedMark(0)));
  await page.touchscreen.tap(first.x, first.y);
  await expect(card).toBeHidden();

  const second = await middleOf(markAt(page, 0, 1));
  await page.touchscreen.tap(second.x, second.y);
  await expect(card).toContainText('Part 2 · Into the work');
  const heading = await middleOf(
    page.getByRole('heading', { name: 'Timeline', exact: true }),
  );
  await page.touchscreen.tap(heading.x, heading.y);
  await expect(card).toBeHidden();
};

test("a mark's card shows for a pointer or a tap, and goes again", async ({
  page,
  hasTouch,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mountEvening(page, 'report');
  await openReport(page);
  await (hasTouch ? tapMarks(page) : pointAtMarks(page));
  await expect(markCard(page)).toBeHidden();
});

/** The first stretch of screen time, whose card is the widest a timeline shows. */
const screenRow = rows.findIndex((row) =>
  row.marks.some((mark) => mark.kind === 'screen'),
);
const screenMark =
  rows[screenRow]?.marks.findIndex((mark) => mark.kind === 'screen') ?? 0;

/** Shows the widest card by pointer or tap, and gives its left and right edges. */
const widestCardOf = async (
  page: playwright.Page,
  hasTouch: boolean,
): Promise<{ readonly left: number; readonly right: number }> => {
  const mark = markAt(page, screenRow, screenMark);
  await mark.scrollIntoViewIfNeeded();
  const { x, y } = await middleOf(mark);
  await (hasTouch ? page.touchscreen.tap(x, y) : page.mouse.move(x, y));
  await expect(markCard(page)).toContainText('Screen time');
  const box = await markCard(page).boundingBox();
  return { left: box?.x ?? -1, right: (box?.x ?? 0) + (box?.width ?? 0) };
};

for (const width of [320, 390]) {
  test(`at ${width}px the hour labels keep apart, and the report keeps to the screen`, async ({
    page,
    hasTouch,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await mountEvening(page, 'report');
    await openReport(page);

    await expect(page.getByRole('button', widen)).toBeHidden();
    const labels = drawingOf(page).locator(
      'xpath=./div[@aria-hidden]/div[1]/span[2]/span',
    );
    expect(await labels.count()).toBeGreaterThan(1);
    const spans = (await Promise.all((await labels.all()).map(spanOf))).sort(
      (a, b) => a.left - b.left,
    );
    for (const [index, span] of spans.entries()) {
      const next = spans[index + 1];
      expect(next === undefined || next.left - span.right >= 4).toBe(true);
      expect(span.right).toBeLessThanOrEqual(width);
    }
    // An area's total leaves its label room for a word or so.
    const labelWidths = await drawingOf(page).evaluate((drawing) =>
      [...drawing.querySelectorAll('span.truncate')]
        .filter((label) => label.nextElementSibling !== null)
        .map((label) => label.getBoundingClientRect().width),
    );
    expect(labelWidths.length).toBeGreaterThan(0);
    expect(Math.min(...labelWidths)).toBeGreaterThanOrEqual(40);
    expect(await scrollsSideways(page)).toBe(false);

    // So does the widest card, a stretch of screen time with its focus line.
    const card = await widestCardOf(page, hasTouch);
    expect(card.left).toBeGreaterThanOrEqual(0);
    expect(card.right).toBeLessThanOrEqual(width);
    expect(await scrollsSideways(page)).toBe(false);
    await scanPage(page);
  });
}
