import { expect, it } from 'bun:test';

import { contrastRatio } from './oklch-contrast.ts';

const themeUrl = new URL('./theme.css', import.meta.url);
const theme = await Bun.file(themeUrl).text();

const tokenDefinitions = (block: string): ReadonlyArray<string> =>
  Array.from(
    block.matchAll(/(?<token>--pl-[a-z-]+):/gu),
    (match) => match.groups?.token ?? '',
  );

const tokenValues = (block: string): Record<string, string> =>
  Object.fromEntries(
    Array.from(
      block.matchAll(/(?<token>--pl-[a-z-]+):\s*(?<value>[^;]+);/gu),
      (match) => [
        match.groups?.token ?? '',
        (match.groups?.value ?? '').trim(),
      ],
    ),
  );

const blockOf = (source: string, startMarker: string): string => {
  const start = source.indexOf(startMarker);
  if (start < 0) {
    return '';
  }
  const end = source.indexOf('}', start);
  return source.slice(start, end);
};

const lightBlock = blockOf(theme, ':root');
const darkBlock = blockOf(
  theme.slice(theme.indexOf('@media (prefers-color-scheme: dark)')),
  ':root',
);

it('every semantic color is defined in both light and dark mode', () => {
  // Sorted whole-list equality, not one-way containment: a token dropped from
  // either block has to fail, because a token missing from dark silently
  // inherits the light value (and the reverse leaves dark unreachable).
  const light = tokenDefinitions(lightBlock).toSorted();
  const dark = tokenDefinitions(darkBlock).toSorted();
  expect(light.length).toBeGreaterThan(0);
  expect(dark).toEqual(light);
});

it('every mapped Tailwind color resolves to a defined token', () => {
  const defined = new Set(tokenDefinitions(lightBlock));
  const references = Array.from(
    theme.matchAll(/var\((?<token>--pl-[a-z-]+)\)/gu),
    (match) => match.groups?.token ?? '',
  );
  expect(references.length).toBeGreaterThan(0);
  for (const token of references) {
    expect(defined).toContain(token);
  }
});

it('color tokens use oklch (or none for shadows) exclusively', () => {
  const values = Array.from(
    theme.matchAll(/--pl-[a-z-]+:\s*(?<value>[^;]+);/gu),
    (match) => (match.groups?.value ?? '').trim(),
  );
  expect(values.length).toBeGreaterThan(0);
  for (const value of values) {
    expect(value === 'none' || value.startsWith('oklch(')).toBe(true);
  }
});

/*
 * The accessibility scan in apps/web can only measure the token pairs the
 * pages it can reach actually render, so a pair no component has used yet is
 * invisible to it. This audit is what keeps the rest of the palette safe: it
 * recomputes every pair straight from the token values.
 *
 * Every surface text can sit on, against every colour text can be set in. The
 * only pairings left out are the ones the palette makes impossible:
 * `on-primary` exists solely for the filled primary control, and a filled
 * primary control carries no other text colour.
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
const normalTextMinimum = 4.5;
const reportedDecimals = 3;

const textPairs: ReadonlyArray<readonly [string, string]> = [
  ...textBackgrounds.flatMap((background) =>
    textForegrounds.map(
      (foreground) => [foreground, background] as readonly [string, string],
    ),
  ),
  ...filledBackgrounds.map(
    (background) =>
      ['--pl-on-primary', background] as readonly [string, string],
  ),
];

const belowAa = (
  mode: string,
  palette: Record<string, string>,
): ReadonlyArray<string> =>
  textPairs.flatMap(([foreground, background]) => {
    const ratio = contrastRatio(
      palette[foreground] ?? '',
      palette[background] ?? '',
    );
    return ratio >= normalTextMinimum
      ? []
      : [
          `${mode}: ${foreground} on ${background} = ${ratio.toFixed(reportedDecimals)}:1`,
        ];
  });

it('every token pair that can carry normal-size text meets WCAG AA', () => {
  // Whole-list equality, so one run names every failing pair at once.
  expect([
    ...belowAa('light', tokenValues(lightBlock)),
    ...belowAa('dark', tokenValues(darkBlock)),
  ]).toEqual([]);
});
