import { expect, it } from 'bun:test';

import {
  activityMarkNames,
  colorTokenNames,
  rampFindings,
  schemeDeclarations,
  textPairFindings,
} from './theme-audit.ts';

const themeUrl = new URL('./theme.css', import.meta.url);
const theme = await Bun.file(themeUrl).text();

const light = schemeDeclarations(theme, ':root', 'light');
const dark = schemeDeclarations(theme, ':root', 'dark');

it('every semantic color is defined in both light and dark mode', () => {
  // Sorted whole-list equality, not one-way containment: a token dropped from
  // either block has to fail, because a token missing from dark silently
  // inherits the light value (and the reverse leaves dark unreachable).
  expect(colorTokenNames(light).length).toBeGreaterThan(0);
  expect(colorTokenNames(dark)).toEqual(colorTokenNames(light));
});

it('declares the type faces once, outside the color schemes', () => {
  // A face token that appeared in the dark block would be a claim that the
  // color scheme changes which typeface is right, which it never does.
  const faces = (palette: Record<string, string>) =>
    Object.keys(palette).filter((token) => token.startsWith('--pl-font-'));
  expect(faces(light)).toEqual(['--pl-font-display', '--pl-font-sans']);
  expect(faces(dark)).toEqual([]);
});

it('every mapped Tailwind value resolves to a defined token', () => {
  const defined = new Set(Object.keys(light));
  const references = Array.from(
    theme.matchAll(/var\((?<token>--pl-[a-z\d-]+)\)/gu),
    (match) => match.groups?.token ?? '',
  );
  expect(references.length).toBeGreaterThan(0);
  for (const token of references) {
    expect(defined).toContain(token);
  }
});

it('color tokens use oklch, and nothing casts a shadow', () => {
  const schemes = [light, dark];
  const notOklch = schemes.flatMap((palette) =>
    colorTokenNames(palette).filter(
      (token) => !palette[token]?.startsWith('oklch('),
    ),
  );
  expect(notOklch).toEqual([]);

  // Nothing in Postlude floats: structure comes from hairline rules and type
  // rather than from raised material, so both shadow tokens stay off in both
  // schemes. They still exist so a utility that names one resolves.
  const shadows = schemes.flatMap((palette) =>
    Object.entries(palette)
      .filter(([token]) => token.startsWith('--pl-shadow-'))
      .map(([, value]) => value),
  );
  expect(shadows.length).toBeGreaterThan(0);
  expect(new Set(shadows)).toEqual(new Set(['none']));
});

/*
 * The accessibility scan in apps/web can only measure the token pairs the
 * pages it can reach actually render, so a pair no component has used yet is
 * invisible to it. These audits are what keep the rest of the palette safe:
 * they recompute every pair straight from the token values.
 */
it('every token pair that can carry normal-size text meets WCAG AA', () => {
  // Whole-list equality, so one run names every failing pair at once.
  expect([
    ...textPairFindings('light', light),
    ...textPairFindings('dark', dark),
  ]).toEqual([]);
});

it('the activity ramp stays readable as a sequence', () => {
  expect([
    ...rampFindings('light', 'light', light, '--pl-background'),
    ...rampFindings('dark', 'dark', dark, '--pl-background'),
  ]).toEqual([]);
});

it('rejects activity marks that blend into the page', () => {
  for (const [scheme, palette] of [
    ['light', light],
    ['dark', dark],
  ] as const) {
    for (const token of activityMarkNames) {
      const mutated = {
        ...palette,
        [token]: palette['--pl-background'],
      };
      expect(
        rampFindings(
          `mutated ${scheme} ${token}`,
          scheme,
          mutated,
          '--pl-background',
        ),
      ).toContain(
        `mutated ${scheme} ${token}: ${token} on --pl-background = 1.000:1`,
      );
    }
  }
});
