import type * as playwright from '@playwright/test';
import { expect } from '@playwright/test';

import { viewportContent } from '../src/shared/ui/viewport.ts';
import { buildDayNavigationFixture } from './day-page-fixture-build.ts';

const navigationAssets = await buildDayNavigationFixture();
const navigationDocument = [
  '<html lang="en">',
  '<head>',
  `<meta name="viewport" content="${viewportContent}">`,
  '<title>Writing navigation fixture</title>',
  '</head>',
  '<body><div id="day-navigation-fixture"></div></body>',
  '</html>',
].join('');

export const mountDayNavigation = async (
  page: playwright.Page,
): Promise<void> => {
  const browserErrors: Array<string> = [];
  page.on('pageerror', (error) => browserErrors.push(error.message));
  await page.route('**/day/2026-08-25', (route) =>
    route.fulfill({
      body: navigationDocument,
      contentType: 'text/html',
      status: 200,
    }),
  );
  await page.goto('/day/2026-08-25');
  await page.addStyleTag({ content: navigationAssets.styles });
  await page.addScriptTag({
    content: navigationAssets.script,
    type: 'module',
  });
  try {
    await page.locator('html[data-hydrated="true"]').waitFor({ timeout: 5000 });
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'Tuesday, August 25, 2026',
      }),
    ).toBeVisible();
  } catch (error) {
    throw new Error(
      `The day-navigation fixture failed: ${browserErrors.join(' | ')}`,
      { cause: error },
    );
  }
};
