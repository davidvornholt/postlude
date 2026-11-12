import { describe, expect, it } from 'bun:test';

import { wideFigureOf } from './use-timeline-width.ts';

/** A screen scaled by 5/3, as the browser reports it. */
const fiveThirds = Math.fround(5 / 3);
const margin = 32;

const onDevicePixels = (px: number, ratio: number): boolean =>
  Math.abs(px * ratio - Math.round(px * ratio)) < 1e-6;

describe('the wide timeline’s place', () => {
  it('reaches from the margin at the window’s left to the margin at its right', () => {
    expect(
      wideFigureOf({
        slotLeft: 400,
        slotWidth: 640,
        window: 1440,
        margin,
        pixelRatio: 1,
      }),
    ).toEqual({ shift: -368, width: 1376 });
  });

  it('reaches out further on the side with more room', () => {
    const { shift, width } = wideFigureOf({
      slotLeft: 600,
      slotWidth: 640,
      window: 1728,
      margin,
      pixelRatio: 1,
    });
    const right = 600 + shift + width - (600 + 640);
    expect(-shift).toBe(568);
    expect(right).toBe(456);
  });

  it('puts both edges on whole device pixels', () => {
    for (const pixelRatio of [1, 1.25, 1.5, fiveThirds, 2]) {
      for (const window of [1280, 1400, 1728, 2560]) {
        const slotLeft = (window - 640) / 2 + 0.4;
        const { shift, width } = wideFigureOf({
          slotLeft,
          slotWidth: 640,
          window,
          margin,
          pixelRatio,
        });
        expect(onDevicePixels(slotLeft + shift, pixelRatio)).toBe(true);
        expect(onDevicePixels(slotLeft + shift + width, pixelRatio)).toBe(true);
      }
    }
  });

  it('is never narrower than the slot, nor left of where the slot already is', () => {
    expect(
      wideFigureOf({
        slotLeft: 16,
        slotWidth: 311,
        window: 343,
        margin,
        pixelRatio: 3,
      }),
    ).toEqual({ shift: 0, width: 311 });
  });

  it('takes a ratio it cannot use as one', () => {
    expect(
      wideFigureOf({
        slotLeft: 400,
        slotWidth: 640,
        window: 1440,
        margin,
        pixelRatio: 0,
      }),
    ).toEqual({ shift: -368, width: 1376 });
  });
});
