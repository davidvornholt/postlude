import type * as playwright from '@playwright/test';
import { expect, test } from '@playwright/test';

import { choose, mountEvening, scanPage } from './evening-flow-test-support.ts';

const frameSelector = 'iframe[title="Day report"]';
const widen = { name: 'Widen the report' } as const;
const narrow = { name: 'Narrow the report' } as const;

/** The report's widest page, 1480px, and the frame's border at each side. */
const widestFrame = 1482;
/** The page's frame, 56rem, less the report's text column, 720px. */
const pageLessText = 896 - 720;
/** Half the report's text column, which the wide frame's middle sits beyond the page's column edge. */
const halfText = 360;

type Box = { readonly left: number; readonly width: number };

const openReport = async (page: playwright.Page): Promise<void> => {
  await choose(page, 'Energy', 'Okay');
  await choose(page, 'Progress', 'Solid');
  await page.getByRole('button', { name: 'Show the report' }).click();
  await expect(page.locator(frameSelector)).toHaveCount(1);
};

const boxOf = async (locator: playwright.Locator): Promise<Box> => {
  const box = await locator.boundingBox();
  if (box === null) {
    throw new Error('The element has no box.');
  }
  return { left: box.x, width: box.width };
};

/** Where the text column starts, and how wide it is: the narrow frame's box. */
const columnOf = async (page: playwright.Page): Promise<Box> => {
  const heading = await boxOf(
    page.getByRole('heading', { level: 2, name: 'Rate the day' }),
  );
  const frame = await boxOf(page.locator(frameSelector));
  expect(frame.left).toBeCloseTo(heading.left, 1);
  return frame;
};

const expectWide = async (
  page: playwright.Page,
  column: Box,
  viewportWidth: number,
): Promise<void> => {
  const frame = await boxOf(page.locator(frameSelector));
  const width = Math.min(widestFrame, viewportWidth - pageLessText);
  expect(frame.width).toBeCloseTo(width, 0);
  // The report's text column sits at the middle of its frame, so it starts
  // where the page's column does.
  expect(frame.left + frame.width / 2 - halfText).toBeCloseTo(column.left, 0);
  expect(frame.left).toBeGreaterThanOrEqual(32 - 0.5);
  expect(frame.left + frame.width).toBeLessThanOrEqual(viewportWidth - 32);
};

const expectInColumn = async (
  page: playwright.Page,
  column: Box,
): Promise<void> => {
  const frame = await boxOf(page.locator(frameSelector));
  expect(frame.left).toBeCloseTo(column.left, 1);
  expect(frame.width).toBeCloseTo(column.width, 1);
};

/**
 * The frame's left and right edge in each animation frame, from the press of
 * the width control until the motion has had time to end.
 */
const edgesWhilePressing = (
  page: playwright.Page,
  label: string,
): Promise<ReadonlyArray<{ readonly left: number; readonly right: number }>> =>
  page.evaluate(
    async ({ frameSelector: selector, label: name }) => {
      const frame = document.querySelector(selector);
      const control = [...document.querySelectorAll('button')].find(
        (button) => button.textContent === name,
      );
      if (frame === null || control === undefined) {
        throw new Error('The frame or its width control is missing.');
      }
      const edges: Array<{ left: number; right: number }> = [];
      control.click();
      const end = performance.now() + 800;
      while (performance.now() < end) {
        const { left, right } = frame.getBoundingClientRect();
        edges.push({ left, right });
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
      return edges;
    },
    { frameSelector, label },
  );

const expectSteadyMotion = (
  edges: ReadonlyArray<{ readonly left: number; readonly right: number }>,
  direction: 'out' | 'in',
): void => {
  const sign = direction === 'out' ? 1 : -1;
  // How far each edge moved the right way from one animation frame to the
  // next, at the least; it never moves back.
  const steps = edges.slice(1).map((edge, index) => {
    const before = edges[index] ?? edge;
    return Math.min(
      sign * (before.left - edge.left),
      sign * (edge.right - before.right),
    );
  });
  expect(Math.min(...steps)).toBeGreaterThanOrEqual(-0.01);
  // It passes through widths between the two, rather than jumping.
  const widths = new Set(edges.map(({ left, right }) => right - left));
  expect(widths.size).toBeGreaterThan(4);
};

test('where the screen has room, the report widens to line its text up with the page, and narrows again', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1280, height: 800 });
  await mountEvening(page, 'report');
  await openReport(page);

  for (const width of [1024, 1280, 1400, 1920]) {
    await page.setViewportSize({ width, height: 800 });
    const column = await columnOf(page);

    // The control is an ordinary button, pressed from the keyboard.
    const control = page.getByRole('button', widen);
    await control.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', narrow)).toBeFocused();
    await expectWide(page, column, width);
    if (width === 1280) {
      await scanPage(page);
    }

    await page.keyboard.press('Space');
    await expect(page.getByRole('button', widen)).toBeFocused();
    await expectInColumn(page, column);
  }
});

test('where widening would gain the report little, there is no control and the report stays in the column', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1280, height: 800 });
  await mountEvening(page, 'report');
  await openReport(page);
  await page.getByRole('button', widen).click();

  for (const width of [1023, 768, 390]) {
    await page.setViewportSize({ width, height: 800 });
    await expect(page.getByRole('button', narrow)).toBeHidden();
    await expectInColumn(page, await columnOf(page));
  }
});

test('the report widens and narrows in one steady motion, or at once with reduced motion', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 1400, height: 800 });
  await mountEvening(page, 'report');
  await openReport(page);
  const column = await columnOf(page);

  expectSteadyMotion(await edgesWhilePressing(page, widen.name), 'out');
  await expectWide(page, column, 1400);
  expectSteadyMotion(await edgesWhilePressing(page, narrow.name), 'in');
  await expectInColumn(page, column);

  // With reduced motion, the frame is wide from the first frame after the press.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const [, ...afterPress] = await edgesWhilePressing(page, widen.name);
  await expectWide(page, column, 1400);
  const frame = await boxOf(page.locator(frameSelector));
  for (const edge of afterPress) {
    expect(edge.left).toBeCloseTo(frame.left, 1);
    expect(edge.right).toBeCloseTo(frame.left + frame.width, 1);
  }
});

test('the report never shows a scrollbar of its own, which would take width from it', async ({
  page,
}) => {
  await mountEvening(page, 'report');
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

test('the browser remembers the width, so the next report opens as wide as the last', async ({
  page,
}) => {
  // The fixture goes into a page of the app's own origin, which has storage.
  const fixtureDocument = '**/__postlude-report-width-fixture';
  await page.route(fixtureDocument, (route) =>
    route.fulfill({ body: '<!doctype html><html></html>', status: 200 }),
  );
  await page.goto('/__postlude-report-width-fixture');
  await page.unroute(fixtureDocument);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1400, height: 800 });

  await mountEvening(page, 'report');
  await openReport(page);
  const column = await columnOf(page);
  await page.getByRole('button', widen).click();
  await expectWide(page, column, 1400);

  await mountEvening(page, 'report');
  await openReport(page);
  await expect(page.getByRole('button', narrow)).toBeVisible();
  await expectWide(page, column, 1400);

  await page.getByRole('button', narrow).click();
  await mountEvening(page, 'report');
  await openReport(page);
  await expect(page.getByRole('button', widen)).toBeVisible();
  await expectInColumn(page, column);
});
