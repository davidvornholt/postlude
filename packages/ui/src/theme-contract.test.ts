import { expect, it } from 'bun:test';

import {
  activityMarkNames,
  colorTokenNames,
  deepRegisterFindings,
  rampFindings,
  ratingFindings,
  ratingMarkNames,
  schemeDeclarations,
  shadowTokenNames,
  textPairFindings,
  timelineFindings,
  timelineMarkFamilies,
} from './theme-audit.ts';

const squareElementDefault =
  /\*,\s*::before,\s*::after\s*\{\s*border-radius:\s*0;/u;

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
  expect(faces(light)).toEqual([
    '--pl-font-display',
    '--pl-font-sans',
    '--pl-font-mono',
  ]);
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
    shadowTokenNames(palette).map((token) => palette[token]),
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

it('rejects ramp steps too close to tell apart', () => {
  const crowded = {
    ...light,
    '--pl-heat-q1': 'oklch(0.6 0.07 155)',
    '--pl-heat-q2': 'oklch(0.52 0.085 155)',
    '--pl-heat-q3': 'oklch(0.44 0.09 155)',
    '--pl-heat-q4': 'oklch(0.36 0.085 155)',
  };
  expect(rampFindings('crowded', 'light', crowded, '--pl-background')).toEqual([
    'crowded: --pl-heat-q2 steps only 0.080 in lightness',
    'crowded: --pl-heat-q3 steps only 0.080 in lightness',
    'crowded: --pl-heat-q4 steps only 0.080 in lightness',
  ]);
});

it('keeps the deep register rule visible against its ground', () => {
  expect([
    ...deepRegisterFindings('light', light),
    ...deepRegisterFindings('dark', dark),
  ]).toEqual([]);
});

it('rejects a deep register rule that blends into its ground', () => {
  for (const [scheme, palette] of [
    ['light', light],
    ['dark', dark],
  ] as const) {
    const mutated = {
      ...palette,
      '--pl-deep-rule': palette['--pl-deep-ground'],
    };
    expect(deepRegisterFindings(`mutated ${scheme}`, mutated)).toEqual([
      `mutated ${scheme}: --pl-deep-rule on --pl-deep-ground = 1.000:1`,
    ]);
  }
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

it('keeps the rating steps apart for every common kind of color vision', () => {
  expect([
    ...ratingFindings('light', light, '--pl-background'),
    ...ratingFindings('light', light, '--pl-surface-sunken'),
    ...ratingFindings('dark', dark, '--pl-background'),
    ...ratingFindings('dark', dark, '--pl-surface-sunken'),
  ]).toEqual([]);
});

it('rejects ratings drawn as shades of one green', () => {
  // The ramp's own steps, which is how progress was drawn before the ratings
  // shared a scale: far enough apart in lightness to order, too close to name.
  const shades = {
    ...light,
    '--pl-rating-low': light['--pl-heat-q1'] ?? '',
    '--pl-rating-middle': light['--pl-heat-q2'] ?? '',
    '--pl-rating-high': light['--pl-heat-q4'] ?? '',
  };
  expect(ratingFindings('shades', shades, '--pl-background')).toEqual([
    'shades: --pl-rating-low and --pl-rating-middle are 11.0 apart with full color vision',
  ]);
});

it('rejects a high step at the primary green, which red-green deficiency reads as the umber', () => {
  const primary = { ...light, '--pl-rating-high': light['--pl-primary'] ?? '' };
  expect(ratingFindings('primary', primary, '--pl-background')).toEqual([
    'primary: --pl-rating-low and --pl-rating-high are 14.7 apart with full color vision',
    'primary: --pl-rating-low and --pl-rating-high are 6.0 apart under protanopia',
    'primary: --pl-rating-low and --pl-rating-high are 5.5 apart under deuteranopia',
  ]);
});

it('rejects rating marks that blend into the page', () => {
  for (const [scheme, palette] of [
    ['light', light],
    ['dark', dark],
  ] as const) {
    for (const token of ratingMarkNames) {
      const mutated = { ...palette, [token]: palette['--pl-background'] };
      expect(
        ratingFindings(`mutated ${scheme}`, mutated, '--pl-background'),
      ).toContain(`mutated ${scheme}: ${token} on --pl-background = 1.000:1`);
    }
  }
});

it('keeps the timeline marks of one shape apart for every common kind of color vision', () => {
  expect([
    ...timelineFindings('light', light, '--pl-background'),
    ...timelineFindings('light', light, '--pl-surface-sunken'),
    ...timelineFindings('dark', dark, '--pl-background'),
    ...timelineFindings('dark', dark, '--pl-surface-sunken'),
  ]).toEqual([]);
});

it('rejects a pull request mark in the ink of the prompts beside it', () => {
  const inked = { ...light, '--pl-timeline-pr': light['--pl-ink'] ?? '' };
  expect(timelineFindings('inked', inked, '--pl-background')).toContain(
    'inked points: --pl-ink and --pl-timeline-pr are 0.0 apart with full color vision',
  );
});

it('rejects timeline marks that blend into the page', () => {
  for (const token of timelineMarkFamilies.bars) {
    const mutated = { ...dark, [token]: dark['--pl-background'] };
    expect(timelineFindings('mutated', mutated, '--pl-background')).toContain(
      `mutated bars: ${token} on --pl-background = 1.000:1`,
    );
  }
});

it('disables intermediate corner radii and makes every element square by default', () => {
  const declarations = Array.from(
    theme.matchAll(
      /(?<property>--radius(?:-[\w*-]+)?|border(?:-[a-z]+)*-radius)\s*:\s*(?<value>[^;}]+)/gu,
    ),
    (match) => [match.groups?.property, match.groups?.value?.trim()],
  );
  expect(declarations).toEqual([
    ['--radius-*', 'initial'],
    ['--radius', '0'],
    ['border-radius', '0'],
  ]);
  expect(theme).toMatch(squareElementDefault);
});
