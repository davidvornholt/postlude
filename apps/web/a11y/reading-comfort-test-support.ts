import type * as playwright from '@playwright/test';
import { expect } from '@playwright/test';

const pageFrameMaximumRem = 56;
const readingMeasureCharacters = 65;
const geometryTolerance = 1;

const rectangleOf = (locator: playwright.Locator) =>
  locator.evaluate((element) => {
    const rectangle = element.getBoundingClientRect();
    return {
      left: rectangle.left,
      right: rectangle.right,
      width: rectangle.width,
    };
  });

export const expectPageFrameGeometry = async (
  frame: playwright.Locator,
): Promise<void> => {
  const geometry = await frame.evaluate((element, maximumRem) => {
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

  expect(geometry.width).toBeCloseTo(geometry.expectedWidth, 0);
  expect(Math.abs(geometry.left - geometry.right)).toBeLessThanOrEqual(
    geometryTolerance,
  );
};

export const expectViewportBandGeometry = async (
  band: playwright.Locator,
): Promise<void> => {
  const geometry = await band.evaluate((element) => {
    const rectangle = element.getBoundingClientRect();
    return {
      left: rectangle.left,
      right: globalThis.innerWidth - rectangle.right,
    };
  });

  expect(Math.abs(geometry.left)).toBeLessThanOrEqual(geometryTolerance);
  expect(Math.abs(geometry.right)).toBeLessThanOrEqual(geometryTolerance);
};

export const expectReadingMeasureGeometry = async (
  page: playwright.Page,
  measure: playwright.Locator,
): Promise<void> => {
  await page.evaluate(() => document.fonts.ready);
  const geometry = await measure.evaluate((element, characters) => {
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
    const rectangle = element.getBoundingClientRect();
    return {
      expectedMaxWidth,
      left: rectangle.left,
      maxWidth: Number.parseFloat(style.maxWidth),
      right: rectangle.right,
      viewportWidth: globalThis.innerWidth,
      width: rectangle.width,
    };
  }, readingMeasureCharacters);

  expect(geometry.maxWidth).toBeCloseTo(geometry.expectedMaxWidth, 0);
  expect(geometry.width).toBeLessThanOrEqual(
    geometry.expectedMaxWidth + geometryTolerance,
  );
  expect(geometry.left).toBeGreaterThanOrEqual(-geometryTolerance);
  expect(geometry.right).toBeLessThanOrEqual(
    geometry.viewportWidth + geometryTolerance,
  );
};

export const expectContainedGeometry = async (
  child: playwright.Locator,
  parent: playwright.Locator,
): Promise<void> => {
  const [childRectangle, parentRectangle] = await Promise.all([
    rectangleOf(child),
    rectangleOf(parent),
  ]);
  expect(childRectangle.left).toBeGreaterThanOrEqual(
    parentRectangle.left - geometryTolerance,
  );
  expect(childRectangle.right).toBeLessThanOrEqual(
    parentRectangle.right + geometryTolerance,
  );
  expect(childRectangle.width).toBeLessThanOrEqual(
    parentRectangle.width + geometryTolerance,
  );
};
