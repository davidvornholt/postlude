import { expect, test } from '@playwright/test';

import { mountDayNavigation } from './day-navigation-test-support.ts';
import { mountDayPage, scan } from './day-page-test-support.ts';

const dayBefore = /\/day\/2026-08-24$/u;
const startingDay = /\/day\/2026-08-25$/u;

test('the arrow keys step a day only where they mean nothing else', async ({
  page,
}) => {
  await mountDayNavigation(page);
  const previous = page.getByRole('link', {
    exact: true,
    name: 'Previous day',
  });
  await expect(previous).toHaveAttribute('aria-keyshortcuts', 'ArrowLeft');
  await expect(
    page.getByRole('link', { exact: true, name: 'Next day' }),
  ).toHaveAttribute('aria-keyshortcuts', 'ArrowRight');

  await page.keyboard.press('ArrowLeft');
  await expect(page).toHaveURL(dayBefore);
  await expect(page.locator('main')).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(startingDay);

  // With a modifier the key belongs to the browser or the system.
  await page.keyboard.press('Shift+ArrowRight');
  await page.keyboard.press('Control+ArrowLeft');

  // In the writing, the keys move the caret.
  const evening = page.getByRole('textbox', { name: 'Evening journal' });
  await evening.focus();
  await page.keyboard.type('Ein Tag');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowRight');
  const reference = page.getByRole('textbox', { name: 'Passage' });
  await reference.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(page).toHaveURL(startingDay);
  await expect(reference).toBeFocused();
  await expect(evening).toHaveText('Ein Tag');
});

test('an empty day opens with the evening writing above the fold', async ({
  page,
}) => {
  await page.setViewportSize({ height: 800, width: 1280 });
  await mountDayNavigation(page);
  const prompt = page.getByText('How did the day go?', { exact: true });
  await expect(prompt).toBeInViewport();
  const promptBox = await prompt.boundingBox();
  const lineHeight = 28;
  // The prompt and at least two lines of writing under it are on screen.
  expect(
    (promptBox?.y ?? Number.POSITIVE_INFINITY) + 3 * lineHeight,
  ).toBeLessThanOrEqual(800);
});

test('the writing prompt is English beside the German writing', async ({
  page,
}) => {
  await mountDayPage(page, ['stored']);
  const evening = page.getByRole('textbox', { name: 'Evening journal' });
  await expect(evening).toHaveAttribute('lang', 'de');
  await expect(evening).toHaveAccessibleDescription('How did the day go?');
  const prompt = page.getByText('How did the day go?', { exact: true });
  await expect(prompt).toBeVisible();
  const promptLanguage = await prompt.evaluate((element) =>
    element.closest('[lang]')?.getAttribute('lang'),
  );
  expect(promptLanguage).toBe('en');
  await scan(page);

  await evening.focus();
  await page.keyboard.type('Heute');
  await expect(prompt).toHaveCount(0);
  await expect(evening).not.toHaveAttribute('aria-describedby');
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');
  await expect(prompt).toBeVisible();
  await expect(evening).toHaveAccessibleDescription('How did the day go?');
});
