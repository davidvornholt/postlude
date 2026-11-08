import { expect, test } from '@playwright/test';
import { signInToRealJournal } from './authenticated-fixture.ts';

const connectionMessage =
  'This entry could not be saved. Your words are still here; check your connection.';
const refusedWords = 'Words the server never receives.';

// Tests running at the same time share one database, so each worker slot
// opens its own day.
const dayFor = (parallelIndex: number): string =>
  `2026-06-${String(parallelIndex + 1).padStart(2, '0')}`;

test('closing the tab still asks first after leaving a day whose writing was not saved', async ({
  page,
}, testInfo) => {
  const signOut = await signInToRealJournal(page);
  const closingIsQuestioned = () =>
    page.evaluate(() => {
      const closing = new Event('beforeunload', { cancelable: true });
      globalThis.window.dispatchEvent(closing);
      return closing.defaultPrevented;
    });
  try {
    await page.goto(`/day/${dayFor(testInfo.parallelIndex)}`);
    // The save carrying these words is dropped on its way, as a lost
    // connection would drop it, while every other request goes through.
    await page.route('**/_serverFn/**', (route) =>
      route.request().postData()?.includes(refusedWords)
        ? route.abort('internetdisconnected')
        : route.fallback(),
    );
    const evening = page.getByRole('textbox', { name: 'Evening journal' });
    await evening.focus();
    await page.keyboard.type(refusedWords);
    await page.keyboard.press('Tab');
    await expect(
      page.locator('[data-save-status] [aria-live="polite"]'),
    ).toHaveText(connectionMessage);
    expect(await closingIsQuestioned()).toBe(true);

    await page
      .getByRole('navigation')
      .getByRole('link', { name: 'Search', exact: true })
      .click();
    await expect(
      page.getByRole('heading', { name: 'Search', exact: true }),
    ).toBeVisible();
    expect(await closingIsQuestioned()).toBe(true);
  } finally {
    await signOut();
  }
});
