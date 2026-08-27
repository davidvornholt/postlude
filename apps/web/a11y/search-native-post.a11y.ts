import { expect, test } from '@playwright/test';

import { mountNativeSearch } from './search-page-test-support.ts';

const resultLink = /Sunday, March 1, 2026/u;

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
    expect(new URLSearchParams(submission.submittedBodies()[0]).get('q')).toBe(
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

test('Chromium can resubmit the private POST body when reloading its result', async ({
  page,
}) => {
  const query = 'private rain';
  const submission = await mountNativeSearch(page, 'populated', query);
  await page.getByRole('searchbox', { name: 'Words to find' }).fill(query);
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(page).toHaveURL('https://fixture.invalid/search');

  await page.reload();

  expect(submission.submittedMethods()).toEqual(['POST', 'POST']);
  expect(
    submission
      .submittedBodies()
      .map((body) => new URLSearchParams(body).get('q')),
  ).toEqual([query, query]);
  await expect(page).toHaveURL('https://fixture.invalid/search');
});
