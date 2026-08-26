import { scanWcag22AaViolations } from '@davidvornholt/a11y-testing/axe';
import type * as playwright from '@playwright/test';
import { expect, test } from '@playwright/test';

import { buildDayPageFixture } from './day-page-fixture-build.ts';
import type {
  DayPageFixtureConfig,
  DayPageFixtureWindow,
  SaveOutcome,
} from './day-page-fixture-contract.ts';

test.describe.configure({ mode: 'serial' });

const today = '2026-08-26';
const timestamp = '2026-08-26T20:00:00.000Z';
const textboxCount = 3;
const passageLinkName = /Read Proverbs 12:5-13/u;
const bibleserverLinkName = /bibleserver/u;

const fixtureConfig = (
  saveOutcomes: ReadonlyArray<SaveOutcome>,
): DayPageFixtureConfig => ({
  entry: {
    date: today,
    journalMarkdown: '',
    journalWordCount: 0,
    scriptureMarkdown: '',
    scriptureWordCount: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  },
  today,
  saveOutcomes,
});

const assets = await buildDayPageFixture(fixtureConfig(['stored']));

const mountDayPage = async (
  page: playwright.Page,
  saveOutcomes: ReadonlyArray<SaveOutcome>,
): Promise<void> => {
  const config = fixtureConfig(saveOutcomes);
  const browserErrors: Array<string> = [];
  page.on('pageerror', (error) => browserErrors.push(error.message));
  await page.setContent(
    `<html lang="en"><head><title>Writing page fixture</title></head><body><main id="day-page-fixture">${assets.markup}</main></body></html>`,
  );
  await page.addStyleTag({ content: assets.styles });
  await page.evaluate((fixture) => {
    const fixtureWindow = globalThis as unknown as DayPageFixtureWindow;
    fixtureWindow.postludeDayPageFixture = fixture;
  }, config);
  await page.addScriptTag({ content: assets.script, type: 'module' });
  try {
    await page.locator('html[data-hydrated="true"]').waitFor({ timeout: 5000 });
  } catch (error) {
    throw new Error(
      `The hydrated fixture failed: ${browserErrors.join(' | ')}`,
      { cause: error },
    );
  }
  await expect(page.getByRole('textbox')).toHaveCount(textboxCount);
};

const scan = async (page: playwright.Page): Promise<void> => {
  expect(await scanWcag22AaViolations(page)).toEqual([]);
};

const editAndLeave = async (
  page: playwright.Page,
  name: string,
  text: string,
): Promise<void> => {
  const field = page.getByRole('textbox', { name });
  await field.focus();
  await page.keyboard.type(text);
  await page.keyboard.press('Tab');
};

const colorSchemes = ['light', 'dark'] as const;

for (const colorScheme of colorSchemes) {
  test(`the hydrated writing page works by keyboard in ${colorScheme} mode`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await mountDayPage(page, ['stored']);

    await page.keyboard.press('Tab');
    await expect(
      page.getByRole('link', { name: 'Previous day' }),
    ).toBeFocused();
    await page.keyboard.press('Tab');
    const passage = page.getByRole('textbox', { name: 'Passage' });
    await expect(passage).toBeFocused();
    await page.keyboard.type('Proverbs 12:5-13');
    await page.keyboard.press('Tab');
    await expect(
      page.getByRole('link', { name: passageLinkName }),
    ).toBeFocused();
    await page.keyboard.press('Tab');
    const morning = page.getByRole('textbox', {
      name: 'Morning scripture notes',
    });
    await expect(morning).toBeFocused();
    await page.keyboard.type('Mercy arrived this morning.');
    await page.keyboard.press('Tab');
    const evening = page.getByRole('textbox', { name: 'Evening journal' });
    await expect(evening).toBeFocused();
    await page.keyboard.type('A quiet evening ended well.');
    await page.keyboard.press('Tab');

    await expect(morning).toContainText('Mercy arrived this morning.');
    await expect(evening).toContainText('A quiet evening ended well.');
    await expect(page.getByText('Saved', { exact: true })).toBeVisible();
    await scan(page);
  });

  test(`the saving state passes WCAG 2.2 AA in ${colorScheme} mode`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await mountDayPage(page, ['pending']);
    await editAndLeave(page, 'Evening journal', 'Still being saved.');
    await expect(page.getByText('Saving …', { exact: true })).toBeVisible();
    await scan(page);
  });

  test(`the failed state passes WCAG 2.2 AA in ${colorScheme} mode`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await mountDayPage(page, ['failed']);
    await editAndLeave(page, 'Evening journal', 'Keep these words.');
    await expect(
      page.getByText('Could not save', { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
    await scan(page);
  });

  test(`an invalid passage passes WCAG 2.2 AA in ${colorScheme} mode`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await mountDayPage(page, ['validation']);
    await editAndLeave(page, 'Passage', 'Proverbs 12:');
    await expect(
      page.getByText('Could not save', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: bibleserverLinkName }),
    ).toHaveCount(0);
    await scan(page);
  });

  test(`retrying a failed save passes WCAG 2.2 AA in ${colorScheme} mode`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await mountDayPage(page, ['failed', 'pending']);
    await editAndLeave(page, 'Evening journal', 'Retry these words.');
    const retry = page.getByRole('button', { name: 'Try again' });
    await expect(retry).toBeVisible();
    await retry.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByText('Saving …', { exact: true })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute(
      'data-save-attempts',
      '2',
    );
    await scan(page);
  });
}
