import { expect, it } from 'bun:test';

const themeUrl = new URL('./theme.css', import.meta.url);
const theme = await Bun.file(themeUrl).text();

const tokenDefinitions = (block: string): ReadonlyArray<string> =>
  Array.from(
    block.matchAll(/(?<token>--pl-[a-z-]+):/gu),
    (match) => match.groups?.token ?? '',
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
  const light = new Set(tokenDefinitions(lightBlock));
  const dark = tokenDefinitions(darkBlock);
  expect(light.size).toBeGreaterThan(0);
  expect(dark.length).toBeGreaterThan(0);
  for (const token of dark) {
    expect(light).toContain(token);
  }
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
