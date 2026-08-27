import { scanWcag22AaViolations } from '@davidvornholt/a11y-testing/axe';
import type * as playwright from '@playwright/test';
import { expect } from '@playwright/test';
import { searchQueryLengthLimit } from '../src/features/journal/search-contract.ts';
import type { SearchResults } from '../src/features/journal/services/search-fns.ts';
import { buildSearchPageFixture } from './search-page-fixture-build.ts';
import type {
  SearchFixtureOutcome,
  SearchPageFixtureConfig,
  SearchPageFixtureWindow,
} from './search-page-fixture-contract.ts';
import { searchFixtureView } from './search-server-fixture-module.ts';

const today = '2026-08-26';
const baseUrl = 'https://fixture.invalid/';

const initialResults: SearchResults = {
  query: '',
  today,
  terms: [],
  hits: [],
  limited: false,
};

const configFor = (outcome: SearchFixtureOutcome): SearchPageFixtureConfig => ({
  outcome,
  view: { state: 'answered', results: initialResults },
});

const assets = new Map<
  SearchFixtureOutcome,
  Awaited<ReturnType<typeof buildSearchPageFixture>>
>();

const assetsFor = async (outcome: SearchFixtureOutcome) => {
  const existing = assets.get(outcome);
  if (existing !== undefined) {
    return existing;
  }
  const built = await buildSearchPageFixture(configFor(outcome));
  assets.set(outcome, built);
  return built;
};

const documentOf = (
  markup: string,
  styles: string,
  title = 'Search fixture',
): string =>
  `<html lang="en"><head><base href="${baseUrl}"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title><style>${styles}</style></head><body><main id="search-page-fixture">${markup}</main></body></html>`;

export const mountSearchPage = async (
  page: playwright.Page,
  outcome: SearchFixtureOutcome,
): Promise<{ readonly pageErrors: () => ReadonlyArray<string> }> => {
  const fixtureAssets = await assetsFor(outcome);
  const browserErrors: Array<string> = [];
  page.on('pageerror', (error) => browserErrors.push(error.message));
  await page.setContent(documentOf(fixtureAssets.markup, fixtureAssets.styles));
  await page.evaluate((fixture) => {
    const fixtureWindow = globalThis as unknown as SearchPageFixtureWindow;
    fixtureWindow.postludeSearchPageFixture = fixture;
  }, configFor(outcome));
  await page.addScriptTag({ content: fixtureAssets.script, type: 'module' });
  try {
    await page.locator('html[data-hydrated="true"]').waitFor({ timeout: 5000 });
  } catch (error) {
    throw new Error(
      `The hydrated search fixture failed: ${browserErrors.join(' | ')}`,
      { cause: error },
    );
  }
  await expect(page.getByRole('heading', { name: 'Search' })).toBeVisible();
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  const hydratedErrorCount = browserErrors.length;
  return { pageErrors: () => browserErrors.slice(hydratedErrorCount) };
};

export const changeSearchOutcome = (
  page: playwright.Page,
  outcome: SearchFixtureOutcome,
): Promise<void> =>
  page.evaluate((nextOutcome) => {
    const fixtureWindow = globalThis as unknown as SearchPageFixtureWindow;
    fixtureWindow.postludeSearchPageFixture = {
      ...fixtureWindow.postludeSearchPageFixture,
      outcome: nextOutcome,
    };
  }, outcome);

export const scanSearch = async (page: playwright.Page): Promise<void> => {
  expect(await scanWcag22AaViolations(page)).toEqual([]);
};

export const mountNativeSearch = async (
  page: playwright.Page,
  outcome: 'error' | 'populated',
  query: string,
): Promise<{
  readonly submittedBodies: () => ReadonlyArray<string>;
  readonly submittedMethods: () => ReadonlyArray<string>;
}> => {
  const initialAssets = await assetsFor('populated');
  const responseConfig: SearchPageFixtureConfig = {
    outcome,
    view:
      query.length > searchQueryLengthLimit
        ? { state: 'invalid', query }
        : searchFixtureView(outcome, query),
  };
  const responseAssets = await buildSearchPageFixture(responseConfig);
  let bodies: ReadonlyArray<string> = [];
  let methods: ReadonlyArray<string> = [];
  await page.route(`${baseUrl}search`, async (route) => {
    bodies = [...bodies, route.request().postData() ?? ''];
    methods = [...methods, route.request().method()];
    await route.fulfill({
      body: documentOf(
        responseAssets.markup,
        responseAssets.styles,
        'Search result fixture',
      ),
      headers: { 'content-type': 'text/html; charset=utf-8' },
      status: 200,
    });
  });
  await page.setContent(documentOf(initialAssets.markup, initialAssets.styles));
  return {
    submittedBodies: () => bodies,
    submittedMethods: () => methods,
  };
};
