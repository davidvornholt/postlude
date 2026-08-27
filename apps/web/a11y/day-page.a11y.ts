import { expect, test } from '@playwright/test';

import { journalWriteConflictMessage } from '../src/features/journal/errors/journal-errors.ts';
import { editAndLeave, mountDayPage, scan } from './day-page-test-support.ts';

test.describe.configure({ mode: 'serial' });

const passageLinkName = /Read Proverbs 12:5-13/u;
const bibleserverLinkName = /bibleserver/u;
const connectionMessage =
  'This entry could not be saved. Your words are still here; check your connection.';
const validationMessage =
  'Check the scripture reference and use a form such as Proverbs 12:5-13.';
const authenticationMessage =
  'Your sign-in ended before this entry could be saved. Your words are kept in this tab.';

const colorSchemes = ['light', 'dark'] as const;
for (const colorScheme of colorSchemes) {
  test(`the hydrated writing page works by keyboard in ${colorScheme} mode`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await mountDayPage(page, ['stored']);

    await page.keyboard.press('Tab');
    const dayField = page.getByLabel(dayFieldName);
    await expect(dayField).toBeFocused();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Open' })).toBeFocused();
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
    await expect(morning).toHaveAttribute('aria-multiline', 'true');
    await page.keyboard.type('Mercy arrived this morning.');
    await page.keyboard.press('Tab');
    const evening = page.getByRole('textbox', { name: 'Evening journal' });
    await expect(evening).toBeFocused();
    await expect(evening).toHaveAttribute('aria-multiline', 'true');
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
    await expect(page.getByText('Saved', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Try again' })).toHaveCount(
      0,
    );
  });

  test(`an invalid passage passes WCAG 2.2 AA in ${colorScheme} mode`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await mountDayPage(page, ['validation']);
    await editAndLeave(page, 'Passage', 'Proverbs 12:');
    const passage = page.getByRole('textbox', { name: 'Passage' });
    await expect(passage).toHaveAttribute('aria-invalid', 'true');
    const guidanceId = await passage.getAttribute('aria-describedby');
    expect(guidanceId).not.toBeNull();
    await expect(page.locator(`#${guidanceId ?? ''}`)).toHaveText(
      validationMessage,
    );
    await expect(page.locator('[aria-live="polite"]')).toHaveText(
      validationMessage,
    );
    await expect(
      page.getByRole('link', { name: bibleserverLinkName }),
    ).toHaveCount(0);
    await scan(page);

    await passage.fill('still not a passage');
    await expect(passage).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator(`#${guidanceId ?? ''}`)).toHaveText(
      validationMessage,
    );

    await passage.fill('Proverbs 12:5');
    await expect(passage).not.toHaveAttribute('aria-invalid', 'true');
    expect(await passage.getAttribute('aria-describedby')).toBeNull();
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

    const conflictStatus = page.locator('[aria-live="polite"]');
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
    await expect(page.getByText('Saving …', { exact: true })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute(
      'data-save-attempts',
      '2',
    );
    await scan(page);
  });
}
