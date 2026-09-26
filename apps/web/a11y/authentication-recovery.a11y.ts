import { expect, test } from '@playwright/test';
import { signInToRealJournal } from './authenticated-fixture.ts';

const unauthorizedStatus = 401;

test('a real serialized expired-session error offers sign-in recovery', async ({
  page,
}) => {
  const cleanup = await signInToRealJournal(page);
  try {
    await page.goto('/search');
    await expect(
      page.getByRole('heading', { name: 'Search', exact: true }),
    ).toBeVisible();
    const field = page.getByRole('searchbox', { name: 'Words to find' });
    await field.fill('quiet');
    // Revoke only this fixture session after rendering, so the next real RPC fails.
    await cleanup();
    const expiredResponse = page.waitForResponse(
      (candidate) => candidate.status() === unauthorizedStatus,
    );
    await field.press('Enter');
    const response = await expiredResponse;
    expect(response.headers()['cache-control']).toBe(
      'private, no-store, max-age=0',
    );
    expect(response.headers().pragma).toBe('no-cache');
    expect(response.headers()['x-content-type-options']).toBe('nosniff');
    await expect(
      page.getByText('Your sign-in ended before the search finished'),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Sign in again' }),
    ).toHaveAttribute('href', '/login');
    await expect(page.getByRole('button', { name: 'Try again' })).toHaveCount(
      0,
    );
  } finally {
    await cleanup();
  }
});
