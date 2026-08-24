/**
 * The audit machinery both theme test files run: `theme-contract.test.ts` on
 * the base tokens in `theme.css`, `comparison-themes.test.ts` on every design
 * comparison wrapper class. The rules are identical for all of them, so they
 * live here once rather than being restated per theme.
 *
 * The reader of a failure gets the whole list at once, so every check returns
 * findings as strings instead of asserting: a caller compares the list to `[]`
 * and one run names every pair that is out.
 */

import { contrastRatio, oklchLightness } from './oklch-contrast.ts';

export type Scheme = 'light' | 'dark';
export type Palette = Record<string, string>;

const darkQuery = 'prefers-color-scheme: dark';
const declarationPattern = /^(?<token>--pl-[a-z\d-]+)\s*:\s*(?<value>.+)$/su;

/**
 * The `--pl-*` declarations a selector carries in one color scheme.
 *
 * Both block shapes in this package parse the same way: `theme.css` puts the
 * dark `:root` inside a top-level media query, and a theme wrapper nests the
 * media query inside its class. Tracking the open preludes rather than slicing
 * on the first `}` is what makes one reader handle both, and what keeps a
 * nested block from being mistaken for the end of its parent.
 */
export const schemeDeclarations = (
  css: string,
  selector: string,
  scheme: Scheme,
): Palette => {
  const source = css.replace(/\/\*.*?\*\//gsu, '');
  const preludes: Array<string> = [];
  const palette: Palette = {};
  let pending = '';

  for (const character of source) {
    if (character === '{') {
      preludes.push(pending.trim());
      pending = '';
    } else if (character === '}') {
      preludes.pop();
      pending = '';
    } else if (character === ';') {
      const groups = declarationPattern.exec(pending.trim())?.groups;
      const scoped = preludes.some((prelude) => prelude.includes(selector));
      const dark = preludes.some((prelude) => prelude.includes(darkQuery));
      if (groups !== undefined && scoped && dark === (scheme === 'dark')) {
        palette[groups.token ?? ''] = (groups.value ?? '').trim();
      }
      pending = '';
    } else {
      pending += character;
    }
  }

  return palette;
};

/**
 * Token names that name a color, sorted. Faces and shadows are declared with
 * the same `--pl-` prefix but answer to none of the color rules: a face has no
 * contrast ratio, and a shadow is a whole `box-shadow` value.
 */
export const colorTokenNames = (palette: Palette): ReadonlyArray<string> =>
  Object.keys(palette)
    .filter(
      (token) =>
        !(token.startsWith('--pl-font-') || token.startsWith('--pl-shadow-')),
    )
    .toSorted();

/** Shadow tokens are audited separately because their values are not colors. */
export const shadowTokenNames = (palette: Palette): ReadonlyArray<string> =>
  Object.keys(palette)
    .filter((token) => token.startsWith('--pl-shadow-'))
    .toSorted();

/*
 * Every surface text can sit on, against every color text can be set in. The
 * only pairings left out are the ones the palette makes impossible:
 * `on-primary` exists solely for the filled primary control, and a filled
 * primary control carries no other text color; the deep register is its own
 * two-color surface.
 */
const textBackgrounds = [
  '--pl-background',
  '--pl-surface',
  '--pl-surface-sunken',
  '--pl-primary-subtle',
  '--pl-accent-subtle',
  '--pl-critical-subtle',
] as const;
const textForegrounds = [
  '--pl-ink',
  '--pl-ink-muted',
  '--pl-ink-faint',
  '--pl-primary',
  '--pl-primary-strong',
  '--pl-accent',
  '--pl-positive',
  '--pl-critical',
] as const;
const filledBackgrounds = ['--pl-primary', '--pl-primary-strong'] as const;
const deepForegrounds = ['--pl-deep-ink', '--pl-deep-ink-muted'] as const;

export const textPairs: ReadonlyArray<readonly [string, string]> = [
  ...textBackgrounds.flatMap((background) =>
    textForegrounds.map(
      (foreground) => [foreground, background] as readonly [string, string],
    ),
  ),
  ...filledBackgrounds.map(
    (background) =>
      ['--pl-on-primary', background] as readonly [string, string],
  ),
  ...deepForegrounds.map(
    (foreground) =>
      [foreground, '--pl-deep-ground'] as readonly [string, string],
  ),
];

const normalTextMinimum = 4.5;
const reportedDecimals = 3;

const ratio = (palette: Palette, foreground: string, background: string) =>
  contrastRatio(palette[foreground] ?? '', palette[background] ?? '');

/** Every text pair below WCAG AA for normal-size text, named with its ratio. */
export const textPairFindings = (
  label: string,
  palette: Palette,
): ReadonlyArray<string> =>
  textPairs.flatMap(([foreground, background]) => {
    const measured = ratio(palette, foreground, background);
    return measured >= normalTextMinimum
      ? []
      : [
          `${label}: ${foreground} on ${background} = ${measured.toFixed(reportedDecimals)}:1`,
        ];
  });

const rampSteps = [
  '--pl-heat-q1',
  '--pl-heat-q2',
  '--pl-heat-q3',
  '--pl-heat-q4',
] as const;
export const activityMarkNames = ['--pl-heat-none-mark', ...rampSteps] as const;
const minimumLightnessStep = 0.06;
const markMinimum = 3;
const stepDecimals = 3;

/**
 * The ramp is sequential, so it is judged on order rather than on the
 * categorical distinctness a series palette needs: lightness has to move one
 * way only and far enough per step to be seen. Every filled step and the empty
 * day's outline must also clear WCAG's non-text contrast minimum against the
 * surface beneath the grid.
 */
export const rampFindings = (
  label: string,
  scheme: Scheme,
  palette: Palette,
  ground: string,
): ReadonlyArray<string> => {
  const lightnesses = rampSteps.map((token) =>
    oklchLightness(palette[token] ?? ''),
  );
  const descending = scheme === 'light';

  const order = lightnesses.flatMap((lightness, index) => {
    const previous = lightnesses[index - 1];
    if (previous === undefined) {
      return [];
    }
    const step = descending ? previous - lightness : lightness - previous;
    if (step <= 0) {
      return [
        `${label}: ${rampSteps[index]} does not continue the ramp (L ${previous} then ${lightness})`,
      ];
    }
    return step >= minimumLightnessStep
      ? []
      : [
          `${label}: ${rampSteps[index]} steps only ${step.toFixed(stepDecimals)} in lightness`,
        ];
  });

  const contrast = activityMarkNames.flatMap((mark) => {
    const measured = ratio(palette, mark, ground);
    return measured >= markMinimum
      ? []
      : [
          `${label}: ${mark} on ${ground} = ${measured.toFixed(reportedDecimals)}:1`,
        ];
  });
  return [...order, ...contrast];
};
