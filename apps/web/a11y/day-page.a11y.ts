import { expect, test } from '@playwright/test';

import { journalWriteConflictMessage } from '../src/features/journal/errors/journal-errors.ts';
import { editAndLeave, mountDayPage, scan } from './day-page-test-support.ts';

test.describe.configure({ mode: 'serial' });
const passageLinkName = /Read Proverbs 12:5-13/u;
const connectionMessage =
  'This entry could not be saved. Your words are still here; check your connection.';
const authenticationMessage =
  'Your sign-in ended before this entry could be saved. Your words are kept in this tab.';

const colorSchemes = ['light', 'dark'] as const;
const dayName = 'Wednesday, August 26, 2026';
/** Long enough for the save line's few seconds of patience, and some slack. */
const slowSaveWait = 10_000;

type Page = Parameters<typeof scan>[0];

/** The one stop a part's writing tools take, ahead of what they act on. */
const expectToolsFocused = async (page: Page, section: string) => {
  const tools = page
    .getByRole('region', { name: section, exact: true })
    .getByRole('toolbar');
  await expect(tools.getByRole('button', { name: 'Bold' })).toBeFocused();
  await expect(tools).toBeVisible();
};

for (const colorScheme of colorSchemes) {
  test(`the hydrated writing page works by keyboard in ${colorScheme} mode`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await mountDayPage(page, ['stored']);

    // The date comes first and opens the calendar, then the steps and the
    // copy beside it. Today's own page has no way back to today to stop on.
    await page.keyboard.press('Tab');
    await expect(
      page
        .getByRole('heading', { level: 1 })
        .getByRole('button', { name: dayName, exact: true }),
    ).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(
      page.getByRole('link', { name: 'Previous day' }),
    ).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Next day' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Copy day as Markdown')).toBeFocused();
    // Each part's tools take one stop ahead of its writing, and show when
    // focus reaches them.
    await page.keyboard.press('Tab');
    await expectToolsFocused(page, 'Morning scripture');
    await page.keyboard.press('Tab');
    const passage = page.getByRole('textbox', { name: 'Passage or topic' });
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
    await expect(morning).toHaveAttribute('aria-multiline', 'true');
    await page.keyboard.type('Mercy arrived this morning.');
    // The day is rated before it is written about: one stop per scale.
    for (const [scale, first] of [
      ['Energy', 'Drained'],
      ['Progress', 'Little'],
      ['Would you repeat this day?', 'Yes'],
    ] as const) {
      await page.keyboard.press('Tab');
      await expect(
        page
          .getByRole('group', { name: scale })
          .getByRole('radio', { name: first }),
      ).toBeFocused();
    }
    await page.keyboard.press('Tab');
    await expectToolsFocused(page, 'Evening');
    await page.keyboard.press('Tab');
    const evening = page.getByRole('textbox', { name: 'Evening journal' });
    await expect(evening).toBeFocused();
    await expect(evening).toHaveAttribute('aria-multiline', 'true');
    await page.keyboard.type('A quiet evening ended well.');
    await page.keyboard.press('Tab');

    await expect(morning).toContainText('Mercy arrived this morning.');
    await expect(evening).toContainText('A quiet evening ended well.');
    await expect(page.getByText('Autosave on', { exact: true })).toBeVisible();
    await scan(page);
  });

  test(`the saving state passes WCAG 2.2 AA in ${colorScheme} mode`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await mountDayPage(page, ['pending']);
    await editAndLeave(page, 'Evening journal', 'Still being saved.');
    await expect(page.getByText('Autosave on', { exact: true })).toBeVisible();
    await scan(page);
    // A save that is still on its way after a few seconds says so, in full ink.
    await expect(page.getByText('Still saving …', { exact: true })).toBeVisible(
      { timeout: slowSaveWait },
    );
    await expect(page.getByText('Autosave on', { exact: true })).toHaveCount(0);
    await scan(page);
  });

  test(`the failed state passes WCAG 2.2 AA in ${colorScheme} mode`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await mountDayPage(page, ['failed']);
    await editAndLeave(page, 'Evening journal', 'Keep these words.');
    await expect(
      page.getByText(connectionMessage, { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
    await scan(page);

    const evening = page.getByRole('textbox', { name: 'Evening journal' });
    await evening.focus();
    await page.keyboard.down('Control');
    await page.keyboard.press('a');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');
    await expect(page.getByText('Autosave on', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Try again' })).toHaveCount(
      0,
    );
  });

  test(`an expired sign-in passes WCAG 2.2 AA in ${colorScheme} mode`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await mountDayPage(page, ['authentication']);
    await editAndLeave(page, 'Evening journal', 'Keep this after sign-in.');
    await expect(
      page.getByText(authenticationMessage, { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Sign in again' }),
    ).toHaveAttribute('href', '/login');
    await expect(page.getByRole('button', { name: 'Try again' })).toHaveCount(
      0,
    );
    await scan(page);
  });

  test(`a stale-write conflict stays recoverable in ${colorScheme} mode`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await mountDayPage(page, ['conflict']);
    const editedProse = 'Keep this version from the stale tab.';
    await editAndLeave(page, 'Evening journal', editedProse);

    const conflictStatus = page.locator(
      '[data-save-status] [aria-live="polite"]',
    );
    await expect(conflictStatus).toBeVisible();
    await expect(conflictStatus).toHaveText(journalWriteConflictMessage);
    await expect(
      page.getByRole('textbox', { name: 'Evening journal' }),
    ).toContainText(editedProse);
    await expect(page.getByRole('button', { name: 'Try again' })).toHaveCount(
      0,
    );
    await expect(page.getByRole('link', { name: 'Sign in again' })).toHaveCount(
      0,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
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
    await expect(page.getByText('Autosave on', { exact: true })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute(
      'data-save-attempts',
      '2',
    );
    await scan(page);
  });
}
