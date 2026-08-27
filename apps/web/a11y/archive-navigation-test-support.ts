import type * as playwright from '@playwright/test';
import { expect } from '@playwright/test';

import { viewportContent } from '../src/shared/ui/viewport.ts';
import { buildArchiveNavigationFixture } from './archive-navigation-fixture-build.ts';
import type {
  ArchiveNavigationFixtureConfig,
  ArchiveNavigationFixtureWindow,
} from './archive-navigation-fixture-contract.ts';
import type { BrowserFixtureAssets } from './hydrated-fixture-build.ts';

const navigationConfig: ArchiveNavigationFixtureConfig = {
  archiveReadOutcome: 'stored',
  deferFirstArchiveRead: false,
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

type ArchiveNavigationOptions = Pick<
  ArchiveNavigationFixtureConfig,
  'deferFirstArchiveRead' | 'saveOutcome'
> & {
  readonly archiveReadOutcome?: ArchiveNavigationFixtureConfig['archiveReadOutcome'];
};

const navigationDocument = [
  '<html lang="en">',
  '<head>',
  `<meta name="viewport" content="${viewportContent}">`,
  '<title>Archive navigation fixture</title>',
  '</head>',
  '<body><div id="archive-navigation-fixture"></div></body>',
  '</html>',
].join('');

export const mountArchiveNavigation = async (
  page: playwright.Page,
  options: ArchiveNavigationOptions = {
    archiveReadOutcome: 'stored',
    deferFirstArchiveRead: false,
    saveOutcome: 'stored',
  },
): Promise<void> => {
  navigationAssets ??= await buildArchiveNavigationFixture();
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
        globalThis as unknown as ArchiveNavigationFixtureWindow;
      fixtureWindow.postludeArchiveNavigationFixture = fixture;
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
      `The archive navigation fixture failed: ${browserErrors.join(' | ')}`,
      { cause: error },
    );
  }
};

export const releaseArchiveRead = (page: playwright.Page): Promise<void> =>
  page.evaluate(() => {
    const fixtureWindow =
      globalThis as unknown as ArchiveNavigationFixtureWindow;
    fixtureWindow.postludeArchiveNavigationRuntime?.releaseArchiveRead();
  });
