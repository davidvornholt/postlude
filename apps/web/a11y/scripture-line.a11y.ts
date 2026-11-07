import { scanWcag22AaViolations } from '@davidvornholt/a11y-testing/axe';
import type * as playwright from '@playwright/test';
import { expect, test } from '@playwright/test';

import { viewportContent } from '../src/shared/ui/viewport.ts';
import { buildDayPageFixtures } from './day-page-fixture-build.ts';
import type { DayPageFixtureConfig } from './day-page-fixture-contract.ts';
import { fixtureConfig, mountFixture } from './day-page-mount.ts';

// Long enough to wrap at every width the tests run at.
const longTopic =
  'The Sermon on the Mount, read slowly, with the beatitudes and the salt and light that follow them';
const emptyConfig = fixtureConfig(['stored'], '');
const topicConfig: DayPageFixtureConfig = {
  ...emptyConfig,
  entry: {
    ...emptyConfig.entry,
    scriptureTopic: longTopic,
    scriptureFirstUsedAt: emptyConfig.entry.createdAt,
  },
};
const [emptyAssets, topicAssets] = await buildDayPageFixtures([
  emptyConfig,
  topicConfig,
]);
if (emptyAssets === undefined || topicAssets === undefined) {
  throw new Error('The passage fixtures rendered nothing.');
}

const passageField = (page: playwright.Page) =>
  page.getByRole('textbox', { name: 'Passage or topic' });

const fieldGeometry = (field: playwright.Locator) =>
  field.evaluate((element) => ({
    clientHeight: element.clientHeight,
    height: element.getBoundingClientRect().height,
    lineHeight: Number.parseFloat(getComputedStyle(element).lineHeight),
    scrollHeight: element.scrollHeight,
  }));

const pageScrollsSideways = (page: playwright.Page) =>
  page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );

test('a long topic wraps onto more lines of its field from the first paint', async ({
  page,
}) => {
  await page.setContent(
    `<html lang="en"><head><meta name="viewport" content="${viewportContent}"><title>Writing page fixture</title></head><body><main id="day-page-fixture">${topicAssets.markup}</main></body></html>`,
  );
  await page.addStyleTag({ content: topicAssets.styles });
  const serverRendered = await fieldGeometry(passageField(page));

  await mountFixture(page, topicConfig, topicAssets);
  const field = passageField(page);
  await expect(field).toHaveValue(longTopic);
  await expect(page.getByText('Kept as a topic')).toBeVisible();
  const hydrated = await fieldGeometry(field);
  // Every line shows, the field is as tall before hydration as after it, and
  // nothing runs past the edge of the page.
  expect(hydrated.height).toBeGreaterThanOrEqual(2 * hydrated.lineHeight);
  expect(hydrated.scrollHeight).toBeLessThanOrEqual(hydrated.clientHeight);
  expect(hydrated.height).toBe(serverRendered.height);
  expect(await pageScrollsSideways(page)).toBe(false);
  expect(await scanWcag22AaViolations(page)).toEqual([]);
});

test('the passage or topic stays one paragraph', async ({ page }) => {
  await mountFixture(page, emptyConfig, emptyAssets);
  const field = passageField(page);
  const oneLine = await fieldGeometry(field);
  expect(oneLine.height).toBeLessThan(2 * oneLine.lineHeight);

  // A line break put in with other text becomes a space, and the caret stays
  // after what was put in.
  await field.focus();
  await page.keyboard.type('Grace truth');
  await page.keyboard.press('Home');
  for (const _ of 'Grace') {
    await page.keyboard.press('ArrowRight');
  }
  await page.keyboard.insertText('\nand');
  await page.keyboard.type(',');
  await expect(field).toHaveValue('Grace and, truth');
  await field.fill('Light\n\n  and salt\n');
  await expect(field).toHaveValue('Light and salt ');

  // Enter leaves the field instead of starting a second line.
  await page.keyboard.press('Enter');
  await expect(field).not.toBeFocused();
  await expect(field).toHaveValue('Light and salt ');
  expect((await fieldGeometry(field)).height).toBe(oneLine.height);
});
