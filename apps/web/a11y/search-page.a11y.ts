import { expect, test } from '@playwright/test';

import {
  changeSearchOutcome,
  mountSearchPage,
  scanSearch,
} from './search-page-test-support.ts';

test.describe.configure({ mode: 'serial' });

const colorSchemes = ['light', 'dark'] as const;
const resultLink = /Sunday,? 1 March 2026/u;
const limitedLabel = /The first 1 day holding/u;
const overLimitLength = 201;

const searchFor = async (
  page: Parameters<typeof mountSearchPage>[0],
  query: string,
) => {
  const field = page.getByRole('searchbox', { name: 'Words to find' });
  await field.fill(query);
  await field.press('Enter');
  return field;
};

for (const colorScheme of colorSchemes) {
  test(`the initial search passes WCAG 2.2 AA in ${colorScheme} mode`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await mountSearchPage(page, 'populated');
    await expect(
      page.getByText('Every evening you have written is searchable'),
    ).toBeVisible();
    await scanSearch(page);
  });

  test(`an empty search answer passes WCAG 2.2 AA in ${colorScheme} mode`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await mountSearchPage(page, 'empty');
    const field = await searchFor(page, 'winter orchard');
    await expect(
      page.getByText('No day holds all of those words'),
    ).toBeVisible();
    await expect(field).toBeFocused();
    expect(page.url()).not.toContain('winter');
    await scanSearch(page);
  });

  test(`populated search results pass WCAG 2.2 AA and reflow in ${colorScheme} mode`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await mountSearchPage(page, 'populated');
    const field = await searchFor(page, 'rain');
    await expect(page.getByRole('link', { name: resultLink })).toBeVisible();
    await expect(field).toHaveValue('rain');
    await expect(field).toBeFocused();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= globalThis.innerWidth,
      ),
    ).toBe(true);
    await scanSearch(page);
  });

  test(`a cross-source result explains every matched term in ${colorScheme} mode`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await mountSearchPage(page, 'multi-source');
    await searchFor(page, 'rain mercy sprüche');
    const result = page.getByRole('link', { name: resultLink });
    await expect(result.getByText('Evening')).toBeVisible();
    await expect(result.getByText('Morning notes')).toBeVisible();
    await expect(result.getByText('Passage reference')).toBeVisible();
    await expect(result.locator('mark')).toHaveText([
      'Rain',
      'Mercy',
      'Sprüche',
    ]);
    await scanSearch(page);
  });

  test(`canonical Unicode matches keep their original prose in ${colorScheme} mode`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await mountSearchPage(page, 'unicode');
    await searchFor(page, 'istanbul τελικόσ');
    const result = page.getByRole('link', { name: resultLink });
    await expect(result.locator('mark')).toHaveText(['İstanbul', 'τελικός']);
    await expect(result.getByText('Evening')).toBeVisible();
    await expect(result.getByText('Morning notes')).toBeVisible();
    await scanSearch(page);
  });

  test(`a limited search answer passes WCAG 2.2 AA in ${colorScheme} mode`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await mountSearchPage(page, 'limited');
    await searchFor(page, 'rain');
    await expect(page.getByText(limitedLabel)).toBeVisible();
    await scanSearch(page);
  });

  test(`the pending search is unambiguous and passes WCAG 2.2 AA in ${colorScheme} mode`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await mountSearchPage(page, 'loading');
    const field = page.getByRole('searchbox', { name: 'Words to find' });
    await field.fill('rain');
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page.getByText('Searching.')).toBeVisible();
    await expect(page.locator('[aria-busy="true"]')).toBeVisible();
    await expect(field).toHaveAttribute('readonly', '');
    await expect(field).toBeFocused();
    await expect(
      page.getByText('Every evening you have written is searchable'),
    ).toHaveCount(0);
    await scanSearch(page);
  });

  test(`a failed search can retry and passes WCAG 2.2 AA in ${colorScheme} mode`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await mountSearchPage(page, 'error');
    const field = await searchFor(page, 'rain');
    await expect(
      page.getByText('Search is unavailable right now'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
    await expect(field).toHaveValue('rain');
    await expect(page.getByText('private fixture detail')).toHaveCount(0);
    await scanSearch(page);

    await changeSearchOutcome(page, 'populated');
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(field).toBeFocused();
    await expect(page.getByRole('link', { name: resultLink })).toBeVisible();
    await expect(field).toHaveValue('rain');
    await expect(field).toBeFocused();
  });

  test(`an expired session focuses an explicit recovery action in ${colorScheme} mode`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await mountSearchPage(page, 'authentication');
    await searchFor(page, 'rain');
    await expect(
      page.getByText('Your sign-in ended before the search finished'),
    ).toBeVisible();
    const signIn = page.getByRole('link', { name: 'Sign in again' });
    await expect(signIn).toHaveAttribute('href', '/login');
    await expect(signIn).toBeFocused();
    await expect(page.getByText('Not authorized.')).toHaveCount(0);
    await scanSearch(page);
  });

  test(`an overlong search keeps its field error accessible in ${colorScheme} mode`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await mountSearchPage(page, 'populated');
    const field = page.getByRole('searchbox', { name: 'Words to find' });
    const overlong = 'x'.repeat(overLimitLength);
    await field.evaluate((element, value) => {
      const input = element as HTMLInputElement;
      const setValue = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )?.set;
      if (setValue === undefined) {
        throw new Error('The browser has no input value setter.');
      }
      setValue.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }, overlong);
    await expect(field).toHaveValue(overlong);
    await expect(field).toHaveAttribute('maxlength', '200');
    await expect(field).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByText('Use 200 characters or fewer')).toBeVisible();
    await field.press('Enter');
    await expect(field).toBeFocused();
    await scanSearch(page);
  });
}
