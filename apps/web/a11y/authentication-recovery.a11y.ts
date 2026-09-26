import { expect, test } from '@playwright/test';
import { signInToRealJournal } from './authenticated-fixture.ts';

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
    await field.press('Enter');
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
