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

const expectDay = async (
  page: Parameters<typeof mountDayNavigation>[0],
  path: string,
  title: string,
  heading: string,
): Promise<void> => {
  await expect(page).toHaveURL(
    new RegExp(`${path.replaceAll('/', '\\/')}$`, 'u'),
  );
  await expect(page).toHaveTitle(title);
  await expect(
    page.getByRole('heading', { level: 1, name: heading }),
  ).toBeVisible();
  await expect(page.locator('main')).toBeFocused();
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

test('Previous and Next preserve the app shell and move focus', async ({
  page,
}) => {
  await mountDayNavigation(page);
  await expect(page.locator('main')).not.toBeFocused();
  await markAppShell(page);

  await followDayLink(page, 'Previous day');
  await expectDay(
    page,
    '/day/2026-08-24',
    'Monday, August 24, 2026 · Postlude',
    'Monday, August 24, 2026',
  );
  await followDayLink(page, 'Next day');
  await expectDay(
    page,
    '/day/2026-08-25',
    'Tuesday, August 25, 2026 · Postlude',
    'Tuesday, August 25, 2026',
  );
  await followDayLink(page, 'Next day');
  await expectDay(page, '/', 'Today · Postlude', 'Wednesday, August 26, 2026');
  await scan(page);
});

test('browser Back and Forward preserve the app shell', async ({ page }) => {
  await mountDayNavigation(page);
  await markAppShell(page);
  await followDayLink(page, 'Previous day');
  await expectDay(
    page,
    '/day/2026-08-24',
    'Monday, August 24, 2026 · Postlude',
    'Monday, August 24, 2026',
  );

  await page.goBack();
  await expectDay(
    page,
    '/day/2026-08-25',
    'Tuesday, August 25, 2026 · Postlude',
    'Tuesday, August 25, 2026',
  );

  await page.goForward();
  await expectDay(
    page,
    '/day/2026-08-24',
    'Monday, August 24, 2026 · Postlude',
    'Monday, August 24, 2026',
  );
  await expect(appShell(page)).toHaveAttribute('data-app-shell', 'same');
});

test('client navigation restores visible main focus from a scrolled page', async ({
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

  await followDayLink(page, 'Previous day');
  await expectDay(
    page,
    '/day/2026-08-24',
    'Monday, August 24, 2026 · Postlude',
    'Monday, August 24, 2026',
  );
  await expectMainFocusInViewport(page);

  await page.goBack();
  await expectDay(
    page,
    '/day/2026-08-25',
    'Tuesday, August 25, 2026 · Postlude',
    'Tuesday, August 25, 2026',
  );
  await expectMainFocusInViewport(page);

  await page.goForward();
  await expectDay(
    page,
    '/day/2026-08-24',
    'Monday, August 24, 2026 · Postlude',
    'Monday, August 24, 2026',
  );
  await expectMainFocusInViewport(page);
});
