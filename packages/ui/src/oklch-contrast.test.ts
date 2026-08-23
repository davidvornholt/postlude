import { expect, it } from 'bun:test';

import { contrastRatio, srgbChannels, srgbHex } from './oklch-contrast.ts';

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

/*
 * The one value in `theme.css` Chromium does not agree on, pinned from both
 * sides rather than left out of the list above. The red channel of light mode's
 * `--pl-background` lands 0.006 of a step past a rounding boundary, and
 * Chromium's own arithmetic settles on the other side of it. Pinning the gap
 * is what makes a change that moved or widened it fail here, which dropping the
 * value from the list would not.
 */
const roundingBoundary = {
  chromium: '#f7f5ef',
  here: '#f8f5ef',
  value: 'oklch(0.97 0.008 85)',
} as const;

const hexadecimal = 16;

/** The `rr`, `gg` and `bb` of a `#rrggbb` string, as numbers. */
const channelsOf = (hex: string): ReadonlyArray<number> =>
  Array.from(hex.matchAll(/[\da-f]{2}/gu), ([channel]) =>
    Number.parseInt(channel, hexadecimal),
  );

it('differs from Chromium by one step on one channel of one theme value', () => {
  expect(srgbHex(roundingBoundary.value)).toBe(roundingBoundary.here);

  const painted = channelsOf(roundingBoundary.chromium);
  expect(
    srgbChannels(roundingBoundary.value).map(
      (channel, index) => channel - painted[index],
    ),
  ).toEqual([1, 0, 0]);
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
