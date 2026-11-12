import type * as playwright from '@playwright/test';
import { expect, test as it, test } from '@playwright/test';

import {
  figureOf,
  openReport,
  scrollsSideways,
  slotOf,
  spanOf,
  widen,
} from './day-report-document-test-support.ts';
import { mountEvening } from './evening-flow-test-support.ts';
import {
  type Sample,
  type Span,
  startRecording,
  stopRecording,
} from './frame-recording-test-support.ts';

/** The room the wide timeline leaves at each side of the window: the page's 2rem. */
const marginPx = 32;
/** The widths David reads the report at, and the device scale factors of his screens. */
const screenWidths = [1280, 1400, 1728, 2560] as const;
const deviceScaleFactors = [1, 1.5, 5 / 3] as const;

/** Where the text column's parts are, which widening must leave in place. */
const columnPartsOf = (page: playwright.Page): Promise<ReadonlyArray<Span>> =>
  Promise.all(
    [
      page.getByRole('group', { name: 'The day in numbers' }),
      page.getByRole('heading', { name: 'The day in parts', exact: true }),
      page.getByRole('heading', { name: 'Timeline', exact: true }),
      page.getByRole('button', widen),
      slotOf(page),
      page.getByRole('heading', { name: 'How the day went', exact: true }),
    ].map(spanOf),
  );

/** Chromium lays boxes out in 64ths of a CSS pixel, and paints them snapped to device pixels. */
const layoutUnitsPerPx = 64;

/**
 * Whether a length in CSS pixels falls on a whole device pixel, as near as
 * layout can put it: at a scale factor of 5/3 a device pixel is 0.6 CSS
 * pixels, which no 64th of one meets, so an edge set on one lands up to a
 * 64th off it.
 */
const onDevicePixel = (px: number, ratio: number): boolean =>
  Math.abs(px * ratio - Math.round(px * ratio)) <=
  ratio / layoutUnitsPerPx + Number.EPSILON;

const expectInColumn = async (page: playwright.Page): Promise<void> => {
  const slot = await spanOf(slotOf(page));
  const figure = await spanOf(figureOf(page));
  expect(figure.left).toBeCloseTo(slot.left, 1);
  expect(figure.right).toBeCloseTo(slot.right, 1);
};

/** The figure reaches from the margin at the window's left to the one at its right, on whole device pixels. */
const expectWide = async (
  page: playwright.Page,
  ratio: number,
): Promise<void> => {
  const window = await page.evaluate(
    () => document.documentElement.clientWidth,
  );
  const figure = await spanOf(figureOf(page));
  expect(Math.abs(figure.left - marginPx)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(window - marginPx - figure.right)).toBeLessThanOrEqual(0.5);
  expect(onDevicePixel(figure.left, ratio)).toBe(true);
  expect(onDevicePixel(figure.right, ratio)).toBe(true);
  expect(await scrollsSideways(page)).toBe(false);
};

for (const deviceScaleFactor of deviceScaleFactors) {
  test.describe(`at a device scale factor of ${deviceScaleFactor.toFixed(2)}`, () => {
    it.use({ deviceScaleFactor });

    it('the timeline widens to the window less an even margin, from the control beside its heading, while the text column keeps still', async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.setViewportSize({ width: 1280, height: 900 });
      await mountEvening(page, 'report');
      await openReport(page);
      const control = page.getByRole('button', widen);

      for (const width of screenWidths) {
        await page.setViewportSize({ width, height: 900 });
        await expect(control).toHaveAttribute('aria-pressed', 'false');
        await expectInColumn(page);
        const column = await columnPartsOf(page);

        // An ordinary toggle button, pressed from the keyboard, that keeps the focus.
        await control.focus();
        await page.keyboard.press('Enter');
        await expect(control).toHaveAttribute('aria-pressed', 'true');
        await expect(control).toBeFocused();
        await expectWide(page, deviceScaleFactor);
        expect(await columnPartsOf(page)).toEqual(column);

        await page.keyboard.press('Space');
        await expect(control).toHaveAttribute('aria-pressed', 'false');
        await expectInColumn(page);
        expect(await columnPartsOf(page)).toEqual(column);
      }
    });
  });
}

test('the timeline stays wide until the page is left, and opens in the column again', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1400, height: 900 });
  await mountEvening(page, 'report');
  await openReport(page);
  const control = page.getByRole('button', widen);
  await control.click();
  await expect(control).toHaveAttribute('aria-pressed', 'true');
  const ratio = await page.evaluate(() => globalThis.devicePixelRatio);

  // A screen without room for it keeps the timeline in the column, and hides the control.
  await page.setViewportSize({ width: 1000, height: 900 });
  await expect(control).toBeHidden();
  await expectInColumn(page);
  await page.setViewportSize({ width: 1400, height: 900 });
  await expect(control).toHaveAttribute('aria-pressed', 'true');
  // Wide again by the first frame the browser paints at the new width.
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(resolve);
      }),
  );
  await expectWide(page, ratio);

  await mountEvening(page, 'report');
  await openReport(page);
  await expect(control).toHaveAttribute('aria-pressed', 'false');
  await expectInColumn(page);
});

/** Marks the text column's parts around the timeline, and its figure, for recording. */
const watch = async (page: playwright.Page): Promise<void> => {
  for (const locator of [
    page.getByRole('heading', { name: 'The day in parts', exact: true }),
    page.getByRole('heading', { name: 'Timeline', exact: true }),
    figureOf(page),
    page.getByRole('heading', { name: 'How the day went', exact: true }),
  ]) {
    await locator.evaluate((element) => {
      (element as HTMLElement).dataset.watched = '';
    });
  }
};

/** What `watch` marked, in each animation frame while the control is pressed and until it all holds still. */
const motionOfPress = async (
  page: playwright.Page,
): Promise<ReadonlyArray<Sample>> => {
  await page.evaluate(startRecording, '[data-watched]');
  await page.getByRole('button', widen).click();
  return page.evaluate(stopRecording);
};

/** In document order the figure comes third, after the two headings above it. */
const figureIn = ({ spans }: Sample): Span => {
  const [, , figure] = spans;
  if (figure === undefined) {
    throw new Error('The figure was not recorded.');
  }
  return figure;
};

const expectStillText = (samples: ReadonlyArray<Sample>): void => {
  expect(samples.length).toBeGreaterThan(4);
  const text = samples.map(({ spans }) =>
    JSON.stringify([spans[0], spans[1], spans[3]]),
  );
  expect(new Set(text).size).toBe(1);
};

const widthsOf = (samples: ReadonlyArray<Sample>): ReadonlyArray<number> => [
  ...new Set(
    samples.map((sample) => {
      const { left, right } = figureIn(sample);
      return Math.round(right - left);
    }),
  ),
];

/** Each edge only ever moves the one way, through many widths. */
const expectSteadyMotion = (
  samples: ReadonlyArray<Sample>,
  direction: 'out' | 'in',
): void => {
  const sign = direction === 'out' ? 1 : -1;
  const figures = samples.map(figureIn);
  const steps = figures.slice(1).map((span, index) => {
    const before = figures[index] ?? span;
    return Math.min(
      sign * (before.left - span.left),
      sign * (span.right - before.right),
    );
  });
  expect(Math.min(...steps)).toBeGreaterThanOrEqual(-0.01);
  expect(widthsOf(samples).length).toBeGreaterThan(4);
};

test('the timeline widens and narrows in one steady motion while the text keeps still, or at once with reduced motion', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 1400, height: 900 });
  await mountEvening(page, 'report');
  await openReport(page);
  await watch(page);
  const ratio = await page.evaluate(() => globalThis.devicePixelRatio);
  const column = await spanOf(slotOf(page));

  const widening = await motionOfPress(page);
  expectSteadyMotion(widening, 'out');
  expectStillText(widening);
  await expectWide(page, ratio);
  const wide = await spanOf(figureOf(page));

  const narrowing = await motionOfPress(page);
  expectSteadyMotion(narrowing, 'in');
  expectStillText(narrowing);
  await expectInColumn(page);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  const atOnce = await motionOfPress(page);
  expect(
    widthsOf(atOnce).filter((width) =>
      [column, wide].every(
        ({ left, right }) => Math.abs(width - (right - left)) > 1,
      ),
    ),
  ).toEqual([]);
  await expectWide(page, ratio);
});
