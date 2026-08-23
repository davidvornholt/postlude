import { expect, it } from 'bun:test';

import { contrastRatio, srgbHex } from './oklch-contrast.ts';

/*
 * The expected hexes are what Chromium paints for these oklch values, read back
 * from a 1×1 canvas. They pin the conversion against a real browser rather than
 * against this module's own arithmetic — including the two out-of-gamut cases,
 * where a browser clamps each channel instead of reducing chroma.
 */
const chromiumHexes: ReadonlyArray<readonly [string, string]> = [
  ['oklch(1 0 0)', '#ffffff'],
  ['oklch(0 0 0)', '#000000'],
  ['oklch(0.99 0.005 90)', '#fdfcf8'],
  ['oklch(0.25 0.02 60)', '#291f18'],
  ['oklch(0.51 0.115 60)', '#95530c'],
  ['oklch(0.6 0.3 140)', '#00a400'],
  ['oklch(0.7 0.25 20)', '#ff3b59'],
];

it('converts oklch to the sRGB a browser paints', () => {
  expect(
    chromiumHexes.map(([value]) => [value, srgbHex(value)] as const),
  ).toEqual(chromiumHexes.map(([value, hex]) => [value, hex] as const));
});

const maximumContrast = 21;
const precision = 2;

it('reports the WCAG ratio symmetrically, black on white at the maximum', () => {
  expect(contrastRatio('oklch(0 0 0)', 'oklch(1 0 0)')).toBeCloseTo(
    maximumContrast,
    precision,
  );
  expect(contrastRatio('oklch(1 0 0)', 'oklch(0 0 0)')).toBeCloseTo(
    maximumContrast,
    precision,
  );
  expect(contrastRatio('oklch(0.5 0.1 60)', 'oklch(0.5 0.1 60)')).toBeCloseTo(
    1,
    precision,
  );
});

it('rejects a value that is not a plain oklch colour', () => {
  expect(() => srgbHex('none')).toThrow('Not a plain oklch colour: none');
  expect(() => srgbHex('var(--pl-ink)')).toThrow();
});
