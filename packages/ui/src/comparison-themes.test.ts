import { expect, it } from 'bun:test';

import {
  colorTokenNames,
  rampFindings,
  type Scheme,
  schemeDeclarations,
  shadowTokenNames,
  textPairFindings,
} from './theme-audit.ts';

/**
 * The design comparison themes, audited against the same bar as the base
 * palette in `theme-contract.test.ts`. A theme is one row here: add the file
 * and the wrapper class it defines, and every check below runs on it.
 */
const themes = [
  {
    name: 'heirloom',
    file: 'comparison-heirloom.css',
    selector: '.theme-heirloom',
  },
  {
    name: 'warm-print',
    file: 'comparison-warm-print.css',
    selector: '.theme-warm-print',
  },
] as const;

const schemes: ReadonlyArray<Scheme> = ['light', 'dark'];

const baseCss = await Bun.file(new URL('./theme.css', import.meta.url)).text();
const base = schemeDeclarations(baseCss, ':root', 'light');

const palettes = await Promise.all(
  themes.map(async (theme) => {
    const css = await Bun.file(
      new URL(`./${theme.file}`, import.meta.url),
    ).text();
    return {
      name: theme.name,
      light: schemeDeclarations(css, theme.selector, 'light'),
      dark: schemeDeclarations(css, theme.selector, 'dark'),
    };
  }),
);

const faces = (palette: Record<string, string>) =>
  Object.keys(palette)
    .filter((token) => token.startsWith('--pl-font-'))
    .toSorted();

for (const theme of palettes) {
  it(`${theme.name} redefines every base token, in both schemes`, () => {
    // A token the wrapper leaves out does not fall back to something neutral:
    // it keeps the base value, so a theme would ship half of the scaffold
    // palette without ever looking wrong in the file.
    expect(colorTokenNames(theme.light)).toEqual(colorTokenNames(base));
    expect(colorTokenNames(theme.dark)).toEqual(colorTokenNames(base));
    expect(faces(theme.light)).toEqual(faces(base));
    expect(shadowTokenNames(theme.light)).toEqual(shadowTokenNames(base));
    expect(shadowTokenNames(theme.dark)).toEqual(
      shadowTokenNames(schemeDeclarations(baseCss, ':root', 'dark')),
    );
    // Faces stay out of the dark block for the reason they do in the base
    // theme: a color scheme does not change which typeface is right.
    expect(faces(theme.dark)).toEqual([]);
  });

  it(`${theme.name} rejects either shadow token when it is omitted`, () => {
    for (const token of shadowTokenNames(base)) {
      const withoutToken = { ...theme.light };
      delete withoutToken[token];
      expect(shadowTokenNames(withoutToken)).not.toEqual(
        shadowTokenNames(base),
      );
    }
  });

  it(`${theme.name} authors every color in oklch`, () => {
    for (const scheme of schemes) {
      for (const token of colorTokenNames(theme[scheme])) {
        expect(theme[scheme][token]?.startsWith('oklch(')).toBe(true);
      }
    }
  });

  it(`${theme.name} meets WCAG AA on every pair that can carry text`, () => {
    // Whole-list equality, so one run names every failing pair at once.
    expect(
      schemes.flatMap((scheme) =>
        textPairFindings(`${theme.name} ${scheme}`, theme[scheme]),
      ),
    ).toEqual([]);
  });

  it(`${theme.name} keeps the activity ramp readable as a sequence`, () => {
    expect(
      schemes.flatMap((scheme) =>
        rampFindings(`${theme.name} ${scheme}`, scheme, theme[scheme]),
      ),
    ).toEqual([]);
  });
}
