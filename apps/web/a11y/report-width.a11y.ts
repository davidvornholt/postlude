import type * as playwright from '@playwright/test';
import { expect, test } from '@playwright/test';

import { choose, mountEvening, scanPage } from './evening-flow-test-support.ts';

const frameSelector = 'iframe[title="Day report"]';
const widen = { name: 'Widen the timeline' } as const;
const narrow = { name: 'Narrow the timeline' } as const;
/** Any control that widens, such as the one Postlude's own row once had. */
const widenAnything = /widen/iu;

/** The report's widest page, 1480px, and the frame's border at each side. */
const widestFrame = 1482;
/** The page's frame, 56rem, less the report's text column, 720px. */
const pageLessText = 896 - 720;
/** Half the report's text column, which the wide frame's middle sits beyond the page's column edge. */
const halfText = 360;

type Box = { readonly left: number; readonly width: number };
type Edges = ReadonlyArray<{ readonly left: number; readonly right: number }>;
/** What `edgesWhile` keeps on the page's window while it records. */
type EdgeRecorder = {
  postludeActed?: boolean;
  postludeEdges?: Promise<Edges>;
};

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

/** Makes the page one of the app's own origin, which has storage. */
const withStorage = async (page: playwright.Page): Promise<void> => {
  const fixtureDocument = '**/__postlude-report-width-fixture';
  await page.route(fixtureDocument, (route) =>
    route.fulfill({ body: '<!doctype html><html></html>', status: 200 }),
  );
  await page.goto('/__postlude-report-width-fixture');
  await page.unroute(fixtureDocument);
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

const wideWidthAt = (viewportWidth: number): number =>
  Math.min(widestFrame, viewportWidth - pageLessText);

const expectWide = async (
  page: playwright.Page,
  column: Box,
  viewportWidth: number,
): Promise<void> => {
  const frame = await boxOf(page.locator(frameSelector));
  expect(frame.width).toBeCloseTo(wideWidthAt(viewportWidth), 0);
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
 * Records the frame's left and right edge in each animation frame on the
 * page, until the frame has held still for a while after `postludeActed` is
 * set. It runs in the page, so it uses nothing from outside itself.
 */
const startRecording = (selector: string): void => {
  const recorder = globalThis as unknown as EdgeRecorder;
  const edges: Array<{ left: number; right: number }> = [];
  let stillSince = performance.now();
  const sample = (): void => {
    const box = document.querySelector(selector)?.getBoundingClientRect();
    if (box === undefined) {
      return;
    }
    const last = edges.at(-1);
    if (last?.left !== box.left || last.right !== box.right) {
      stillSince = performance.now();
    }
    edges.push({ left: box.left, right: box.right });
  };
  const settled = (): boolean =>
    recorder.postludeActed === true &&
    edges.length > 0 &&
    performance.now() - stillSince > 600;
  const record = async (): Promise<Edges> => {
    const end = performance.now() + 4000;
    while (performance.now() < end && !settled()) {
      sample();
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    return edges;
  };
  recorder.postludeActed = false;
  recorder.postludeEdges = record();
};

/**
 * The frame's edges in each animation frame while `act` runs, and until the
 * frame has held still after it. The report's window is of another origin, so
 * the press is made from outside the page's own script, while the page
 * records.
 */
const edgesWhile = async (
  page: playwright.Page,
  act: () => Promise<void>,
): Promise<Edges> => {
  await page.evaluate(startRecording, frameSelector);
  await act();
  return page.evaluate(() => {
    const recorder = globalThis as unknown as EdgeRecorder;
    recorder.postludeActed = true;
    return recorder.postludeEdges ?? [];
  });
};

const widthsOf = (edges: Edges): ReadonlyArray<number> => [
  ...new Set(edges.map(({ left, right }) => Math.round(right - left))),
];

const expectSteadyMotion = (edges: Edges, direction: 'out' | 'in'): void => {
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
  expect(widthsOf(edges).length).toBeGreaterThan(4);
};

/** Only ever the column's width or the wide one, and nothing between. */
const expectNoMotion = (
  edges: Edges,
  column: Box,
  viewportWidth: number,
): void => {
  expect(
    widthsOf(edges).filter(
      (width) =>
        Math.abs(width - column.width) > 1 &&
        Math.abs(width - wideWidthAt(viewportWidth)) > 1,
    ),
  ).toEqual([]);
};

test("where the screen has room, the report's own control widens it to line its text up with the page, and narrows it again", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1280, height: 800 });
  await mountEvening(page, 'widthReport');
  await openReport(page);

  for (const width of [1024, 1280, 1400, 1920]) {
    await page.setViewportSize({ width, height: 800 });
    const column = await columnOf(page);

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

test('where widening would gain the report little, its control is hidden and the report stays in the column', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1280, height: 800 });
  await mountEvening(page, 'widthReport');
  await openReport(page);
  const column = await columnOf(page);
  await control(page, widen).click();
  await expect(control(page, narrow)).toBeVisible();

  for (const width of [1023, 768, 390]) {
    await page.setViewportSize({ width, height: 800 });
    await expect(control(page, narrow)).toBeHidden();
    await expect(control(page, widen)).toBeHidden();
    await expectInColumn(page, await columnOf(page));
  }

  // Back on a wide screen, the report is as wide as it was left.
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(control(page, narrow)).toBeVisible();
  await expectWide(page, column, 1280);
});

test('the report widens and narrows in one steady motion, or at once with reduced motion', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 1400, height: 800 });
  await mountEvening(page, 'widthReport');
  await openReport(page);
  const column = await columnOf(page);

  expectSteadyMotion(
    await edgesWhile(page, () => control(page, widen).click()),
    'out',
  );
  await expectWide(page, column, 1400);
  await expect(control(page, narrow)).toBeFocused();
  expectSteadyMotion(
    await edgesWhile(page, () => control(page, narrow).click()),
    'in',
  );
  await expectInColumn(page, column);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  expectNoMotion(
    await edgesWhile(page, () => control(page, widen).click()),
    column,
    1400,
  );
  await expectWide(page, column, 1400);
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

test('the browser remembers the width, so the next report opens as wide as the last, at once', async ({
  page,
}) => {
  await withStorage(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1400, height: 800 });

  await mountEvening(page, 'widthReport');
  await openReport(page);
  const column = await columnOf(page);
  await control(page, widen).click();
  await expect(control(page, narrow)).toBeVisible();
  await expectWide(page, column, 1400);

  // With motion, a report that opens wide is wide from the start, rather than
  // widening while it opens.
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await mountEvening(page, 'widthReport');
  await choose(page, 'Energy', 'Okay');
  await choose(page, 'Progress', 'Solid');
  const opening = await edgesWhile(page, () =>
    page.getByRole('button', { name: 'Show the report' }).click(),
  );
  await expect(control(page, narrow)).toBeVisible();
  await expectWide(page, column, 1400);
  expectNoMotion(opening, column, 1400);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await control(page, narrow).click();
  await expect(control(page, widen)).toBeVisible();
  await mountEvening(page, 'widthReport');
  await openReport(page);
  await expect(control(page, widen)).toBeVisible();
  await expectInColumn(page, column);
});

test('a report without a control of its own keeps to the column, even after the last report was widened', async ({
  page,
}) => {
  await withStorage(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1400, height: 800 });

  await mountEvening(page, 'widthReport');
  await openReport(page);
  const column = await columnOf(page);
  await control(page, widen).click();
  await expect(control(page, narrow)).toBeVisible();
  await expectWide(page, column, 1400);

  await mountEvening(page, 'report');
  await openReport(page);
  await expectInColumn(page, column);
  await expect(page.getByRole('button', { name: widenAnything })).toHaveCount(
    0,
  );
});
