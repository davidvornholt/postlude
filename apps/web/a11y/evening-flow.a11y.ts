import { expect, test } from '@playwright/test';

import { eveningConnectionMessage } from '../src/features/journal/evening-failure.ts';
import {
  choose,
  eveningCalls,
  holdEveningCalls,
  mountEvening,
  noteModel,
  readyNoteText,
  releaseEveningCalls,
  revisitDay,
  scanPage,
} from './evening-flow-test-support.ts';

const colorSchemes = ['light', 'dark'] as const;

for (const colorScheme of colorSchemes) {
  test(`an evening is rated, closed and given its note in ${colorScheme} mode`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await mountEvening(page, 'report');

    const close = page.getByRole('button', { name: 'Close the day' });
    await expect(close).toBeDisabled();
    await expect(
      page.getByText('Rate energy and progress to close the day.'),
    ).toBeVisible();
    await scanPage(page);

    // The arrow keys move between the choices and save each one.
    await page.getByRole('radio', { name: 'Drained' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('radio', { name: 'Okay' })).toBeChecked();
    await expect(
      page.getByText('Rate progress to close the day.'),
    ).toBeVisible();

    await choose(page, 'Progress', 'Solid');
    await choose(page, 'Would you repeat this day?', 'Partly');
    await expect(page.getByRole('radio', { name: 'Partly' })).toBeChecked();
    await page.getByRole('button', { name: 'Clear this answer' }).click();
    await expect(page.getByRole('radio', { name: 'Partly' })).not.toBeChecked();
    await expect(close).toBeEnabled();

    await close.click();
    await expect(page.getByText('This day is closed.')).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Okay' })).toBeDisabled();
    await expect(
      page.getByText('An agent is writing a note on this day.'),
    ).toBeVisible();
    await scanPage(page);

    // The page looks again on its own and shows the note once it is written.
    await expect(page.getByText(readyNoteText)).toBeVisible({ timeout: 8000 });
    await expect(
      page.getByText(`Written by an agent, ${noteModel}`),
    ).toBeVisible();
    await expect(page.getByText(readyNoteText)).toHaveAttribute('lang', 'en');
    expect(await eveningCalls(page)).toBe(
      'rate:energy=okay rate:progress=solid rate:repeatDay=partly rate:repeatDay=null close read',
    );
    await scanPage(page);

    await page.getByRole('button', { name: 'Reopen the day' }).click();
    await expect(close).toBeEnabled();
    await expect(page.getByRole('radio', { name: 'Okay' })).toBeEnabled();
    await expect(page.getByText(readyNoteText)).toBeVisible();
  });

  test(`a day closed before agent notes were set up reads calmly in ${colorScheme} mode`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await mountEvening(page, 'notConfigured');

    const notSetUp = page.getByText('Agent notes are not set up yet');
    await expect(notSetUp).toBeVisible();
    await expect(page.getByText('This day is closed.')).toBeVisible();
    await scanPage(page);

    await page.getByRole('button', { name: 'Ask for a note' }).click();
    await expect(
      page.getByText('An agent is writing a note on this day.'),
    ).toBeVisible();
    await expect(notSetUp).toBeVisible({ timeout: 8000 });
    expect(await eveningCalls(page)).toBe('regenerate read');
  });

  test(`a note the writing moved past says so in ${colorScheme} mode`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await mountEvening(page, 'stale');

    await expect(
      page.getByText('The writing changed after this note was written.'),
    ).toBeVisible();
    await expect(page.getByText(readyNoteText)).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Ask for a new note' }),
    ).toBeVisible();
    await scanPage(page);
  });

  test(`a rating that could not be saved falls back and says why in ${colorScheme} mode`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await mountEvening(page, 'failingRatings');

    await choose(page, 'Energy', 'Fresh');
    await expect(page.getByText(eveningConnectionMessage)).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Fresh' })).not.toBeChecked();
    await scanPage(page);
  });

  test(`an evening that could not be read leaves the writing alone in ${colorScheme} mode`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await mountEvening(page, 'unavailable');

    await expect(
      page.getByText('The ratings, report and agent note could not be loaded.'),
    ).toBeVisible();
    await expect(page.getByRole('radio')).toHaveCount(0);
    await scanPage(page);
  });
}

test('a rating chosen after coming back to the day outlasts the ones before it', async ({
  page,
}) => {
  await mountEvening(page, 'report');
  await holdEveningCalls(page, 'rate:energy=okay');
  await choose(page, 'Energy', 'Okay');
  await choose(page, 'Energy', 'Fresh');
  await revisitDay(page);
  await choose(page, 'Energy', 'Drained');
  await releaseEveningCalls(page, 'rate:energy=okay');

  // The page that came back reads the evening once the earlier choices have
  // landed, and its own choice follows them.
  await expect
    .poll(() => eveningCalls(page))
    .toBe('rate:energy=okay read rate:energy=fresh read rate:energy=drained');
  await revisitDay(page);
  await expect(page.getByRole('radio', { name: 'Drained' })).toBeChecked();
});

test('a late answer about an earlier note does not replace the one asked for since', async ({
  page,
}) => {
  await mountEvening(page, 'report');
  await choose(page, 'Energy', 'Okay');
  await choose(page, 'Progress', 'Solid');
  await holdEveningCalls(page, 'read');
  await page.getByRole('button', { name: 'Close the day' }).click();

  // The page looks at the note once it is written, but the answer is slow,
  // and meanwhile the day is reopened and closed, which asks for a new note.
  await expect
    .poll(() => eveningCalls(page), { timeout: 8000 })
    .toBe('rate:energy=okay rate:progress=solid close read');
  await page.getByRole('button', { name: 'Reopen the day' }).click();
  await page.getByRole('button', { name: 'Close the day' }).click();
  await expect(page.getByText('This day is closed.')).toBeVisible();
  await releaseEveningCalls(page, 'read');

  await expect
    .poll(() => eveningCalls(page), { timeout: 8000 })
    .toBe('rate:energy=okay rate:progress=solid close read reopen close read');
  await expect(
    page.getByText(`Written by an agent, ${noteModel}`, { exact: true }),
  ).toBeVisible();
});
