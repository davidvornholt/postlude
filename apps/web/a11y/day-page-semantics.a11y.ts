import { expect, test } from '@playwright/test';

import { markdownSemanticsLinks } from '../src/features/journal/ui/markdown-semantics.fixture.ts';
import { mountSemanticDayPage, scan } from './day-page-test-support.ts';

const desktopViewportWidth = 1280;
const mobileViewportWidth = 412;
const cssViewportByProject: Record<string, number> = {
  'desktop-chromium': desktopViewportWidth,
  'mobile-chromium': mobileViewportWidth,
};
const headingLevelThreeSize = 25.6;
const headingLevelFourSize = 21.6;
const headingLevelFiveSize = 18.4;
const headingLevelSixSize = 16;
const displayTypeface = 'Fraunces Variable';
const levelSixWeight = '600';
const subordinateHeadingSizes = [
  headingLevelThreeSize,
  headingLevelFourSize,
  headingLevelFiveSize,
  headingLevelSixSize,
  headingLevelSixSize,
  headingLevelSixSize,
];

test('the hydrated editor keeps the production viewport and Markdown setting', async ({
  page,
}, testInfo) => {
  await mountSemanticDayPage(page);

  expect(await page.evaluate(() => globalThis.innerWidth)).toBe(
    cssViewportByProject[testInfo.project.name],
  );

  const evening = page.getByRole('textbox', { name: 'Evening journal' });
  const headings = evening.locator('h3, h4, h5, h6');
  await expect(headings).toHaveText([
    'Entry heading',
    'Entry subheading',
    'Entry detail',
    'Entry note',
    'Entry aside',
    'Entry footnote',
  ]);
  const headingStyles = await headings.evaluateAll((elements) =>
    elements.map((element) => {
      const style = getComputedStyle(element);
      return {
        family: style.fontFamily,
        size: Number.parseFloat(style.fontSize),
        weight: style.fontWeight,
      };
    }),
  );
  expect(headingStyles.map(({ size }) => size)).toEqual(
    subordinateHeadingSizes,
  );
  expect(
    headingStyles.every(({ family }) => family.includes(displayTypeface)),
  ).toBe(true);
  expect(headingStyles.at(-1)?.weight).toBe(levelSixWeight);
  await Promise.all(
    markdownSemanticsLinks.map((link) =>
      expect(evening.getByRole('link', { name: link.name })).toHaveAttribute(
        'href',
        link.href,
      ),
    ),
  );
  await scan(page);
});
