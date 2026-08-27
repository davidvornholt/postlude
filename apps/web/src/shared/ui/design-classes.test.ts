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
