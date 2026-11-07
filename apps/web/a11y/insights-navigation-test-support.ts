import type * as playwright from '@playwright/test';
import { expect } from '@playwright/test';

import { viewportContent } from '../src/shared/ui/viewport.ts';
import type { BrowserFixtureAssets } from './hydrated-fixture-build.ts';
import { buildInsightsNavigationFixture } from './insights-navigation-fixture-build.ts';
import type {
  InsightsNavigationFixtureConfig,
  InsightsNavigationFixtureWindow,
} from './insights-navigation-fixture-contract.ts';

const navigationConfig: InsightsNavigationFixtureConfig = {
  insightsReadOutcome: 'stored',
  deferFirstInsightsRead: false,
  today: '2026-08-26',
  saveOutcome: 'stored',
  entry: {
    date: '2026-08-25',
    journalMarkdown: '',
    journalWordCount: 0,
    journalFirstUsedAt: null,
    scriptureMarkdown: '',
    scriptureWordCount: 0,
    scriptureFirstUsedAt: null,
    revision: 1,
    createdAt: '2026-08-26T18:00:00.000Z',
    updatedAt: '2026-08-26T18:00:00.000Z',
  },
};

let navigationAssets: BrowserFixtureAssets | undefined;

type InsightsNavigationOptions = Pick<
  InsightsNavigationFixtureConfig,
  'deferFirstInsightsRead' | 'saveOutcome'
> & {
  readonly insightsReadOutcome?: InsightsNavigationFixtureConfig['insightsReadOutcome'];
};

const navigationDocument = [
  '<html lang="en">',
  '<head>',
  `<meta name="viewport" content="${viewportContent}">`,
  '<title>Insights navigation fixture</title>',
  '</head>',
  '<body><div id="insights-navigation-fixture"></div></body>',
  '</html>',
].join('');

export const mountInsightsNavigation = async (
  page: playwright.Page,
  options: InsightsNavigationOptions = {
    insightsReadOutcome: 'stored',
    deferFirstInsightsRead: false,
    saveOutcome: 'stored',
  },
): Promise<void> => {
  navigationAssets ??= await buildInsightsNavigationFixture();
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
  await page.evaluate(
    (fixture) => {
      const fixtureWindow =
        globalThis as unknown as InsightsNavigationFixtureWindow;
      fixtureWindow.postludeInsightsNavigationFixture = fixture;
    },
    { ...navigationConfig, ...options },
  );
  await page.addScriptTag({
    content: navigationAssets.script,
    type: 'module',
  });
  try {
    await page.locator('html[data-hydrated="true"]').waitFor({ timeout: 5000 });
    await expect(
      page.getByRole('heading', { name: 'Tuesday, August 25, 2026' }),
    ).toBeVisible();
  } catch (error) {
    throw new Error(
      `The insights navigation fixture failed: ${browserErrors.join(' | ')}`,
      { cause: error },
    );
  }
};

export const releaseInsightsRead = (page: playwright.Page): Promise<void> =>
  page.evaluate(() => {
    const fixtureWindow =
      globalThis as unknown as InsightsNavigationFixtureWindow;
    fixtureWindow.postludeInsightsNavigationRuntime?.releaseInsightsRead();
  });
