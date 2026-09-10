import { expect, it } from 'bun:test';
import { file, Glob } from 'bun';

const sourceRoot = new URL('../../', import.meta.url);
const testFile = /\.test\.tsx?$/u;
const readingMeasureUtility = 'max-w-prose';

it('keeps the reading measure utility in its shared owner', async () => {
  const owners = (
    await Promise.all(
      [...new Glob('**/*.{ts,tsx}').scanSync({ cwd: sourceRoot.pathname })]
        .filter((path) => !testFile.test(path))
        .map(async (path) => ({
          path,
          source: await file(new URL(path, sourceRoot)).text(),
        })),
    )
  )
    .filter(({ source }) => source.includes(readingMeasureUtility))
    .map(({ path }) => path)
    .sort();

  expect(owners).toEqual(['shared/ui/design-classes.ts']);
});

// Radius declarations belong to the theme; utilities may choose only the two approved shapes.
const forbiddenCornerStyles = (source: string) => [
  ...Array.from(
    source.matchAll(/\brounded(?:-[^\s"'`<>{}:;]+)?/gu),
    (match) => match[0],
  ).filter((utility) => !['rounded-none', 'rounded-full'].includes(utility)),
  ...Array.from(
    source.matchAll(
      /\b(?:border(?:-[a-z]+)*-radius|border\w*Radius)\b|--radius(?:-[\w*-]+)?/gu,
    ),
    (match) => match[0],
  ),
];

it('allows only square or fully rounded corners in application sources', async () => {
  const findings = await Promise.all(
    [...new Glob('**/*.{ts,tsx,css}').scanSync({ cwd: sourceRoot.pathname })]
      .filter((path) => !testFile.test(path))
      .map(async (path) => ({
        path,
        forbidden: forbiddenCornerStyles(
          await file(new URL(path, sourceRoot)).text(),
        ),
      })),
  );
  expect(findings.filter(({ forbidden }) => forbidden.length > 0)).toEqual([]);
});

it('rejects radius utilities, arbitrary values and declarations that bypass the theme', () => {
  for (const source of [
    'rounded',
    'hover:rounded-md',
    'rounded-[4px]',
    'rounded-t-full',
    'border-radius: 4px',
    'border-top-left-radius: 4px',
    'borderRadius: 4',
    'borderStartStartRadius: 4',
    '--radius-sm: 4px',
  ]) {
    expect(forbiddenCornerStyles(source).length).toBeGreaterThan(0);
  }
  expect(forbiddenCornerStyles('rounded-none hover:rounded-full')).toEqual([]);
});
