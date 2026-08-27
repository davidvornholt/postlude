import { expect, test } from '@playwright/test';

import {
  changeSearchOutcome,
  mountNativeSearch,
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
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= globalThis.innerWidth,
      ),
    ).toBe(true);
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
    const field = await searchFor(page, 'rain');
    await expect(page.getByText('Searching.')).toBeVisible();
    await expect(page.locator('[aria-busy="true"]')).toBeVisible();
    await expect(field).toHaveAttribute('readonly', '');
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
    await expect(page.getByRole('link', { name: resultLink })).toBeVisible();
    await expect(field).toHaveValue('rain');
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

for (const outcome of ['populated', 'error'] as const) {
  test(`a no-JavaScript ${outcome} POST keeps the query out of the response URL`, async ({
    page,
  }) => {
    const query = outcome === 'error' ? 'private failure' : 'private rain';
    const submission = await mountNativeSearch(page, outcome, query);
    const field = page.getByRole('searchbox', { name: 'Words to find' });
    await field.fill(query);
    await page.getByRole('button', { name: 'Search' }).click();

    await expect(page).toHaveURL('https://fixture.invalid/search');
    expect(new URLSearchParams(submission.submittedBody()).get('q')).toBe(
      query,
    );
    expect(page.url()).not.toContain(query);
    await expect(field).toHaveValue(query);
    await expect(page.getByRole('heading', { name: 'Search' })).toBeVisible();
    const responseControl =
      outcome === 'error'
        ? page.getByRole('button', { name: 'Try again' })
        : page.getByRole('link', { name: resultLink });
    await expect(responseControl).toBeVisible();
  });
}
