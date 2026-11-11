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
/** The page's frame, 56rem, which the wide frame leaves of the screen. */
const pageFrame = 896;

type Box = { readonly left: number; readonly width: number };
/** An element's left and right edge, and the width of the window it is in. */
type Edges = ReadonlyArray<{
  readonly left: number;
  readonly right: number;
  readonly window: number;
}>;
/** What `startRecording` keeps on the window it records in. */
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

/** The column's width, and the room the wide frame adds, in whole steps of 2px. */
const wideWidthAt = (viewportWidth: number, column: Box): number =>
  column.width +
  2 *
    Math.floor(
      Math.min(widestFrame - column.width, viewportWidth - pageFrame) / 2,
    );

const expectWide = async (
  page: playwright.Page,
  column: Box,
  viewportWidth: number,
): Promise<void> => {
  const frame = await boxOf(page.locator(frameSelector));
  expect(frame.width).toBeCloseTo(wideWidthAt(viewportWidth, column), 0);
  // The frame grows out of the column equally to both sides, so the middle of
  // the report's page, where its text is, stays where it was.
  expect(frame.left + frame.width / 2).toBeCloseTo(
    column.left + column.width / 2,
    1,
  );
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
 * Records an element's left and right edge, and its window's width, in each
 * animation frame, until they have held still for a while after
 * `postludeActed` is set. It runs in the page or in the report, so it uses
 * nothing from outside itself.
 */
const startRecording = (selector: string): void => {
  const recorder = globalThis as unknown as EdgeRecorder;
  const edges: Array<{ left: number; right: number; window: number }> = [];
  let stillSince = performance.now();
  const sample = (): void => {
    const box = document.querySelector(selector)?.getBoundingClientRect();
    if (box === undefined) {
      return;
    }
    const window = document.documentElement.getBoundingClientRect().width;
    const last = edges.at(-1);
    if (
      last?.left !== box.left ||
      last.right !== box.right ||
      last.window !== window
    ) {
      stillSince = performance.now();
    }
    edges.push({ left: box.left, right: box.right, window });
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

/** Says the recording may end once things hold still, and returns it. */
const stopRecording = (): Promise<Edges> => {
  const recorder = globalThis as unknown as EdgeRecorder;
  recorder.postludeActed = true;
  return recorder.postludeEdges ?? Promise.resolve([]);
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
  return page.evaluate(stopRecording);
};

/**
 * The frame's edges, as `edgesWhile` has them, and those of the report's
 * heading inside it, in each animation frame of the report's own.
 */
const motionWhile = async (
  page: playwright.Page,
  act: () => Promise<void>,
): Promise<{ readonly frame: Edges; readonly text: Edges }> => {
  const report = await (
    await page.locator(frameSelector).elementHandle()
  )?.contentFrame();
  if (report === null || report === undefined) {
    throw new Error('The frame has no report.');
  }
  await report.evaluate(startRecording, 'h1');
  const frame = await edgesWhile(page, act);
  return { frame, text: await report.evaluate(stopRecording) };
};

const widthsOf = (edges: Edges): ReadonlyArray<number> => [
  ...new Set(edges.map(({ left, right }) => Math.round(right - left))),
];

/**
 * The report's text keeps still on the screen. The frame keeps its middle
 * (`expectSteadyMotion`), so the text does when it keeps its place from the
 * middle of the report's window, in every frame the report draws while that
 * window grows or shrinks.
 */
const expectStillText = (text: Edges): void => {
  const fromMiddle = text.map(({ left, window }) => left - window / 2);
  expect(Math.max(...fromMiddle) - Math.min(...fromMiddle)).toBeLessThan(0.01);
  expect(new Set(text.map(({ window }) => window)).size).toBeGreaterThan(4);
};

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
  // It passes through widths between the two, rather than jumping, and its
  // middle stays where it is.
  expect(widthsOf(edges).length).toBeGreaterThan(4);
  const middles = edges.map(({ left, right }) => (left + right) / 2);
  expect(Math.max(...middles) - Math.min(...middles)).toBeLessThan(0.01);
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
        Math.abs(width - wideWidthAt(viewportWidth, column)) > 1,
    ),
  ).toEqual([]);
};

test("where the screen has room, the report's own control widens it equally to both sides of the column, and narrows it again", async ({
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

test('the report widens and narrows in one steady motion with its text kept still, or at once with reduced motion', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 1400, height: 800 });
  await mountEvening(page, 'widthReport');
  await openReport(page);
  const column = await columnOf(page);

  const widening = await motionWhile(page, () => control(page, widen).click());
  expectSteadyMotion(widening.frame, 'out');
  expectStillText(widening.text);
  await expectWide(page, column, 1400);
  await expect(control(page, narrow)).toBeFocused();
  const narrowing = await motionWhile(page, () =>
    control(page, narrow).click(),
  );
  expectSteadyMotion(narrowing.frame, 'in');
  expectStillText(narrowing.text);
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
