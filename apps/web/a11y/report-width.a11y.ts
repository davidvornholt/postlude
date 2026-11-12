import type * as playwright from '@playwright/test';
import { expect, test } from '@playwright/test';

import { reportRoomOf } from '../src/features/journal/ui/report-frame-width.ts';
import { choose, mountEvening, scanPage } from './evening-flow-test-support.ts';
import {
  type Sample,
  type Span,
  startRecording,
  stopRecording,
} from './frame-recording-test-support.ts';

const frameSelector = 'iframe[title="Day report"]';
/** The frame and the two covers beside it, in that order. */
const boxSelector = `${frameSelector}, ${frameSelector} ~ div`;
const widen = { name: 'Widen the timeline' } as const;
const narrow = { name: 'Narrow the timeline' } as const;
/** Any control that widens, such as the one Postlude's own row once had. */
const widenAnything = /widen/iu;

/** The page's frame, 56rem, which the wide frame leaves of the screen. */
const pageFrame = 896;
/** The synthetic report's margin at the left of its page, and the frame's border. */
const reportInset = 21;

/** The report's own width control, inside its frame. */
const control = (
  page: playwright.Page,
  name: { readonly name: string },
): playwright.Locator =>
  page.frameLocator(frameSelector).getByRole('button', name);

const openReport = async (page: playwright.Page): Promise<void> => {
  await choose(page, 'Energy', 'Okay');
  await choose(page, 'Progress', 'Solid');
  await page.getByRole('button', { name: 'Show the report' }).click();
  await expect(page.locator(frameSelector)).toHaveCount(1);
};

const spanOf = async (locator: playwright.Locator): Promise<Span> => {
  const box = await locator.boundingBox();
  if (box === null) {
    throw new Error('The element has no box.');
  }
  return { left: box.x, right: box.x + box.width };
};

const widthOf = ({ left, right }: Span): number => right - left;

/** The text column: what holds the frame's box, where the page's headings start. */
const columnOf = async (page: playwright.Page): Promise<Span> => {
  const heading = await spanOf(
    page.getByRole('heading', { level: 2, name: 'Rate the day' }),
  );
  const column = await spanOf(
    page.locator(frameSelector).locator('xpath=../..'),
  );
  expect(column.left).toBeCloseTo(heading.left, 1);
  return column;
};

/** How far the frame reaches out of the column on each side, at the page's pixel ratio. */
const roomAt = async (
  page: playwright.Page,
  viewportWidth: number,
  column: Span,
): Promise<number> =>
  reportRoomOf({
    column: widthOf(column),
    screen: viewportWidth,
    pageFrame,
    pixelRatio: await page.evaluate(() => globalThis.devicePixelRatio),
  });

/** The frame's box, and the part of it the covers leave shown. */
const shownOf = (selector: string): { frame: Span; shown: Span } => {
  const [frame, left, right] = [...document.querySelectorAll(selector)].map(
    (element) => element.getBoundingClientRect(),
  );
  if (frame === undefined) {
    throw new Error('There is no frame.');
  }
  return {
    frame: { left: frame.left, right: frame.right },
    shown:
      left === undefined || right === undefined
        ? { left: frame.left, right: frame.right }
        : { left: left.right, right: right.left },
  };
};

/** The report's heading, the track that stands in for its timeline, and where they are on the page. */
const reportPartsOf = async (
  page: playwright.Page,
): Promise<{ heading: Span; track: Span }> => {
  const report = page.frameLocator(frameSelector);
  return {
    heading: await spanOf(report.getByRole('heading', { level: 1 })),
    track: await spanOf(report.locator('.track')),
  };
};

/** The report's text starts where it would in a frame the column's width. */
const expectTextInPlace = (heading: Span, column: Span): void => {
  expect(heading.left).toBeCloseTo(column.left + reportInset, 1);
};

const expectWide = async (
  page: playwright.Page,
  column: Span,
  viewportWidth: number,
): Promise<void> => {
  const room = await roomAt(page, viewportWidth, column);
  const { frame, shown } = await page.evaluate(shownOf, boxSelector);
  // The frame reaches out of the column equally to both sides, and the covers
  // leave all of it shown.
  for (const span of [frame, shown]) {
    expect(span.left).toBeCloseTo(column.left - room, 1);
    expect(span.right).toBeCloseTo(column.right + room, 1);
  }
  expect(frame.left).toBeGreaterThanOrEqual(32 - 0.5);
  expect(frame.right).toBeLessThanOrEqual(viewportWidth - 32);
  const { heading, track } = await reportPartsOf(page);
  expectTextInPlace(heading, column);
  expect(track.left).toBeCloseTo(frame.left + reportInset, 1);
  // The report's widths are whole pixels, and the column's need not be.
  expect(track.right).toBeCloseTo(frame.right - reportInset, 0);
};

/** Only the column is shown, and the report's timeline keeps to it; the frame reaches out of it equally to both sides, if at all. */
const expectInColumn = async (
  page: playwright.Page,
  column: Span,
): Promise<void> => {
  const { frame, shown } = await page.evaluate(shownOf, boxSelector);
  expect(shown.left).toBeCloseTo(column.left, 1);
  expect(shown.right).toBeCloseTo(column.right, 1);
  expect(column.left - frame.left).toBeCloseTo(frame.right - column.right, 1);
  const { heading, track } = await reportPartsOf(page);
  expectTextInPlace(heading, column);
  expect(track.left).toBeCloseTo(column.left + reportInset, 1);
  expect(track.right).toBeCloseTo(column.right - reportInset, 0);
};

/**
 * The frame and the covers in each animation frame while `act` runs and
 * until they hold still after it, and the report's heading in each animation
 * frame of the report's own. The report's window is of another origin, so the
 * press is made from outside the page's own script, while both record.
 */
const motionWhile = async (
  page: playwright.Page,
  act: () => Promise<void>,
): Promise<{
  readonly box: ReadonlyArray<Sample>;
  readonly text: ReadonlyArray<Sample>;
}> => {
  const report = await (
    await page.locator(frameSelector).elementHandle()
  )?.contentFrame();
  if (report === null || report === undefined) {
    throw new Error('The frame has no report.');
  }
  await report.evaluate(startRecording, 'h1');
  await page.evaluate(startRecording, boxSelector);
  await act();
  const box = await page.evaluate(stopRecording);
  return { box, text: await report.evaluate(stopRecording) };
};

/** The part of the frame the covers leave shown in a sample: all of it where there are none, and nothing before the frame is there. */
const shownIn = ({
  spans: [frame, left, right],
}: Sample): ReadonlyArray<Span> => {
  if (left === undefined || right === undefined) {
    return frame === undefined ? [] : [frame];
  }
  return [{ left: left.right, right: right.left }];
};

const widthsOf = (spans: ReadonlyArray<Span>): ReadonlyArray<number> => [
  ...new Set(spans.map((span) => Math.round(widthOf(span)))),
];

/** Nothing in the report, nor its window, moves while the covers do. */
const expectStillText = (text: ReadonlyArray<Sample>): void => {
  expect(text.length).toBeGreaterThan(4);
  expect(new Set(text.map((sample) => JSON.stringify(sample))).size).toBe(1);
};

/** The frame keeps its box, and the covers slide the shown part steadily to the other width: each edge only ever moves the one way, through widths between the two, about the same middle. */
const expectSteadyMotion = (
  samples: ReadonlyArray<Sample>,
  direction: 'out' | 'in',
): void => {
  const frames = samples.map(({ spans: [frame] }) => JSON.stringify(frame));
  expect(new Set(frames).size).toBe(1);
  expect(samples.every(({ spans }) => spans.length === 3)).toBe(true);
  const shown = samples.flatMap(shownIn);
  const sign = direction === 'out' ? 1 : -1;
  const steps = shown.slice(1).map((span, index) => {
    const before = shown[index] ?? span;
    return Math.min(
      sign * (before.left - span.left),
      sign * (span.right - before.right),
    );
  });
  expect(Math.min(...steps)).toBeGreaterThanOrEqual(-0.01);
  expect(widthsOf(shown).length).toBeGreaterThan(4);
  const middles = shown.map(({ left, right }) => (left + right) / 2);
  expect(Math.max(...middles) - Math.min(...middles)).toBeLessThan(0.05);
};

/** The shown part is only ever one of `widths`, and nothing between. */
const expectOnlyWidths = (
  samples: ReadonlyArray<Sample>,
  widths: ReadonlyArray<number>,
): void => {
  expect(
    widthsOf(samples.flatMap(shownIn)).filter((width) =>
      widths.every((allowed) => Math.abs(width - allowed) > 1),
    ),
  ).toEqual([]);
};

test("where the screen has room, the report's own control widens its timeline equally to both sides of the column, and narrows it again", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1280, height: 800 });
  await mountEvening(page, 'legacyWidthReport');
  await openReport(page);

  for (const width of [1024, 1280, 1400, 1920]) {
    await page.setViewportSize({ width, height: 800 });
    const column = await columnOf(page);
    await expectInColumn(page, column);

    // The control is an ordinary button, pressed from the keyboard, and it
    // keeps the focus while its name follows the width.
    await control(page, widen).focus();
    await page.keyboard.press('Enter');
    await expect(control(page, narrow)).toBeFocused();
    await expectWide(page, column, width);
    if (width === 1280) {
      await scanPage(page);
    }

    await page.keyboard.press('Space');
    await expect(control(page, widen)).toBeFocused();
    await expectInColumn(page, column);
  }
});

test('where widening would gain the report little, its control is hidden and the report keeps to the column', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1280, height: 800 });
  await mountEvening(page, 'legacyWidthReport');
  await openReport(page);
  const column = await columnOf(page);
  await control(page, widen).click();
  await expect(control(page, narrow)).toBeVisible();

  for (const width of [1023, 768, 390]) {
    await page.setViewportSize({ width, height: 800 });
    await expect(control(page, narrow)).toBeHidden();
    await expect(control(page, widen)).toBeHidden();
    const narrowColumn = await columnOf(page);
    await expectInColumn(page, narrowColumn);
    // The frame keeps to the column, and has no covers.
    const { frame } = await page.evaluate(shownOf, boxSelector);
    expect(widthOf(frame)).toBeCloseTo(widthOf(narrowColumn), 1);
    await expect(page.locator(`${frameSelector} ~ div`)).toHaveCount(0);
  }

  // Back on a wide screen, the timeline is as wide as it was left.
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(control(page, narrow)).toBeVisible();
  await expectWide(page, column, 1280);
});

test('the covers slide in one steady motion while the frame and the text keep still, or move at once with reduced motion', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 1400, height: 800 });
  await mountEvening(page, 'legacyWidthReport');
  await openReport(page);
  const column = await columnOf(page);
  await expectInColumn(page, column);

  const widening = await motionWhile(page, () => control(page, widen).click());
  expectSteadyMotion(widening.box, 'out');
  expectStillText(widening.text);
  await expectWide(page, column, 1400);
  await expect(control(page, narrow)).toBeFocused();
  const narrowing = await motionWhile(page, () =>
    control(page, narrow).click(),
  );
  expectSteadyMotion(narrowing.box, 'in');
  expectStillText(narrowing.text);
  await expectInColumn(page, column);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  const atOnce = await motionWhile(page, () => control(page, widen).click());
  expectOnlyWidths(atOnce.box, [
    widthOf(column),
    widthOf(column) + 2 * (await roomAt(page, 1400, column)),
  ]);
  await expectWide(page, column, 1400);
});

test('the report never shows a scrollbar of its own, which would take width from it', async ({
  page,
}) => {
  await mountEvening(page, 'legacyReport');
  await openReport(page);
  const content = await (
    await page.locator(frameSelector).elementHandle()
  )?.contentFrame();
  expect(
    await content?.evaluate(
      () => getComputedStyle(document.documentElement).scrollbarWidth,
    ),
  ).toBe('none');
});

test('every report opens with its timeline in the column, and shows only the column while it opens', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1400, height: 800 });

  await mountEvening(page, 'legacyWidthReport');
  await openReport(page);
  const column = await columnOf(page);
  await control(page, widen).click();
  await expect(control(page, narrow)).toBeVisible();
  await expectWide(page, column, 1400);

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await mountEvening(page, 'legacyWidthReport');
  await choose(page, 'Energy', 'Okay');
  await choose(page, 'Progress', 'Solid');
  await page.evaluate(startRecording, boxSelector);
  await page.getByRole('button', { name: 'Show the report' }).click();
  await expect(control(page, widen)).toBeVisible();
  expectOnlyWidths(await page.evaluate(stopRecording), [widthOf(column)]);
  await expectInColumn(page, column);
});

test('a report without a control of its own keeps to the column', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1400, height: 800 });

  await mountEvening(page, 'legacyReport');
  await openReport(page);
  const column = await columnOf(page);
  const { frame } = await page.evaluate(shownOf, boxSelector);
  expect(frame.left).toBeCloseTo(column.left, 1);
  expect(frame.right).toBeCloseTo(column.right, 1);
  await expect(page.locator(`${frameSelector} ~ div`)).toHaveCount(0);
  await expect(page.getByRole('button', { name: widenAnything })).toHaveCount(
    0,
  );
});
