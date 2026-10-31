import { expect, test } from '@playwright/test';

import { mountDayNavigation } from './day-navigation-test-support.ts';
import { scan } from './day-page-test-support.ts';

const appShell = (page: Parameters<typeof mountDayNavigation>[0]) =>
  page.locator('main');

const markAppShell = async (
  page: Parameters<typeof mountDayNavigation>[0],
): Promise<void> => {
  await appShell(page).evaluate((element) =>
    element.setAttribute('data-app-shell', 'same'),
  );
};

const expectMainFocusInViewport = async (
  page: Parameters<typeof mountDayNavigation>[0],
): Promise<void> => {
  const bounds = await page.locator('main').evaluate((element) => {
    const { bottom, top } = element.getBoundingClientRect();
    return { bottom, top, viewportHeight: window.innerHeight };
  });
  expect(bounds.bottom).toBeGreaterThan(0);
  expect(bounds.top).toBeLessThan(bounds.viewportHeight);
};

// Today's page is titled by the word rather than the date.
const expectDay = async (
  page: Parameters<typeof mountDayNavigation>[0],
  path: string,
  heading: string,
  focused = page.locator('main'),
): Promise<void> => {
  const title = path === '/' ? 'Today · Postlude' : `${heading} · Postlude`;
  await expect(page).toHaveURL(
    new RegExp(`${path.replaceAll('/', '\\/')}$`, 'u'),
  );
  await expect(page).toHaveTitle(title);
  await expect(
    page.getByRole('heading', { level: 1, name: heading }),
  ).toBeVisible();
  await expect(focused).toBeFocused();
  await expect(appShell(page)).toHaveAttribute('data-app-shell', 'same');
};

const followDayLink = async (
  page: Parameters<typeof mountDayNavigation>[0],
  name: 'Previous day' | 'Next day',
): Promise<void> => {
  const link = page.getByRole('link', { name });
  await link.focus();
  await page.keyboard.press('Enter');
};

const dayLink = (
  page: Parameters<typeof mountDayNavigation>[0],
  name: 'Previous day' | 'Next day',
) => page.getByRole('link', { exact: true, name });

test('Previous and Next preserve the app shell and keep focus on the arrow', async ({
  page,
}) => {
  await mountDayNavigation(page);
  await expect(page.locator('main')).not.toBeFocused();
  await markAppShell(page);

  await followDayLink(page, 'Previous day');
  await expectDay(
    page,
    '/day/2026-08-24',
    'Monday, August 24, 2026',
    dayLink(page, 'Previous day'),
  );
  // The arrow is described by the heading, so landing on it names the day.
  await expect(dayLink(page, 'Previous day')).toHaveAccessibleDescription(
    'Monday, August 24, 2026',
  );
  await page.keyboard.press('Enter');
  await expectDay(
    page,
    '/day/2026-08-23',
    'Sunday, August 23, 2026',
    dayLink(page, 'Previous day'),
  );
  await followDayLink(page, 'Next day');
  await expectDay(
    page,
    '/day/2026-08-24',
    'Monday, August 24, 2026',
    dayLink(page, 'Next day'),
  );
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expectDay(
    page,
    '/',
    'Wednesday, August 26, 2026',
    dayLink(page, 'Next day'),
  );
  await scan(page);
});

test('browser Back and Forward preserve the app shell and focus the page', async ({
  page,
}) => {
  await mountDayNavigation(page);
  await markAppShell(page);
  await followDayLink(page, 'Previous day');
  await expectDay(
    page,
    '/day/2026-08-24',
    'Monday, August 24, 2026',
    dayLink(page, 'Previous day'),
  );

  // Focus is still on the arrow, but the arrow did not make these moves.

  await page.goBack();
  await expectDay(page, '/day/2026-08-25', 'Tuesday, August 25, 2026');

  await page.goForward();
  await expectDay(page, '/day/2026-08-24', 'Monday, August 24, 2026');
  await expect(appShell(page)).toHaveAttribute('data-app-shell', 'same');
});

test('the step at the end of a day opens the next one at its top', async ({
  page,
}) => {
  await mountDayNavigation(page);
  await markAppShell(page);
  await page.evaluate(() => {
    document.body.style.minHeight = '240vh';
    window.scrollTo({
      behavior: 'auto',
      left: 0,
      top: document.body.scrollHeight,
    });
  });
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

  const turns = page.getByRole('navigation', { name: 'Day before and after' });
  await expect(
    turns.getByRole('link', { name: 'Day after Wednesday, August 26, 2026' }),
  ).toHaveAttribute('href', '/');
  const before = turns.getByRole('link', {
    name: 'Day before Monday, August 24, 2026',
  });
  await before.focus();
  await page.keyboard.press('Enter');
  await expectDay(page, '/day/2026-08-24', 'Monday, August 24, 2026');
  await expectMainFocusInViewport(page);

  await page.goBack();
  await expectDay(page, '/day/2026-08-25', 'Tuesday, August 25, 2026');
  await expectMainFocusInViewport(page);

  await page.goForward();
  await expectDay(page, '/day/2026-08-24', 'Monday, August 24, 2026');
  await expectMainFocusInViewport(page);
});

const tidiedAddress = /\?from=address$/u;

type FixtureRouter = {
  readonly navigate: (options: {
    readonly params: { readonly date: string };
    readonly replace: boolean;
    readonly search: Record<string, string>;
    readonly to: string;
  }) => Promise<void>;
};

/** A navigation the page makes on its own, with no control behind it. */
const tidyQuery = async (
  page: Parameters<typeof mountDayNavigation>[0],
): Promise<void> => {
  await page.evaluate(async () => {
    const { dayNavigationRouter } = globalThis as unknown as {
      readonly dayNavigationRouter: FixtureRouter;
    };
    await dayNavigationRouter.navigate({
      params: { date: '2026-08-25' },
      replace: true,
      search: { from: 'address' },
      to: '/day/$date',
    });
  });
  await expect(page).toHaveURL(tidiedAddress);
};

test('a query a page tidies as it opens leaves focus where the load left it', async ({
  page,
}) => {
  await mountDayNavigation(page);
  await tidyQuery(page);
  await expect(page.locator('main')).not.toBeFocused();
  expect(
    await page.evaluate(() => document.activeElement === document.body),
  ).toBe(true);
});

test('a query change after focus was lost brings focus to the page', async ({
  page,
}) => {
  await mountDayNavigation(page);
  const copy = page.getByRole('button', { name: 'Copy day as Markdown' });
  await copy.focus();
  await copy.evaluate((element) => (element as HTMLElement).blur());
  await tidyQuery(page);
  await expect(page.locator('main')).toBeFocused();
});
