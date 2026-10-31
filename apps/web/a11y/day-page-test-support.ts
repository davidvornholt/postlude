import { scanWcag22AaViolations } from '@davidvornholt/a11y-testing/axe';
import type * as playwright from '@playwright/test';
import { expect } from '@playwright/test';
import { markdownSemanticsFixture } from '../src/features/journal/ui/markdown-semantics.fixture.ts';
import { viewportContent } from '../src/shared/ui/viewport.ts';
import { buildDayPageFixture } from './day-page-fixture-build.ts';
import type { SaveOutcome } from './day-page-fixture-contract.ts';
import { fixtureConfig, mountFixture } from './day-page-mount.ts';

const emptyConfig = fixtureConfig(['stored'], '');
const datedConfig = fixtureConfig(['stored'], '', '2026-08-25');

const emptyAssets = await buildDayPageFixture(emptyConfig);
const datedAssets = await buildDayPageFixture(datedConfig);
const semanticAssets = await buildDayPageFixture(
  fixtureConfig(['stored'], markdownSemanticsFixture),
);

export const mountDayPage = (
  page: playwright.Page,
  saveOutcomes: ReadonlyArray<SaveOutcome>,
): Promise<void> =>
  mountFixture(page, fixtureConfig(saveOutcomes, ''), emptyAssets);

export const mountDatedDayPage = (page: playwright.Page): Promise<void> =>
  mountFixture(page, datedConfig, datedAssets);

export const mountSemanticDayPage = (page: playwright.Page): Promise<void> =>
  mountFixture(
    page,
    fixtureConfig(['stored'], markdownSemanticsFixture),
    semanticAssets,
  );

/** Server markup and styles, with no client bundle attached. */
export const mountUnhydratedDayPage = async (
  page: playwright.Page,
): Promise<void> => {
  await page.setContent(
    `<html lang="en"><head><base href="http://127.0.0.1:3130/"><meta name="viewport" content="${viewportContent}"><title>Writing page fixture</title></head><body><main id="day-page-fixture">${emptyAssets.markup}</main></body></html>`,
  );
  await page.addStyleTag({ content: emptyAssets.styles });
};

export const scan = async (page: playwright.Page): Promise<void> => {
  await expect(page.locator('[data-save-status]')).toHaveCount(1);
  expect(await scanWcag22AaViolations(page)).toEqual([]);
};

export const editAndLeave = async (
  page: playwright.Page,
  name: string,
  text: string,
): Promise<void> => {
  const field = page.getByRole('textbox', { name });
  await field.focus();
  await page.keyboard.type(text);
  await page.keyboard.press('Tab');
};
