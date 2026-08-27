import { scanWcag22AaViolations } from '@davidvornholt/a11y-testing/axe';
import { expect, test } from '@playwright/test';

import { buildExportControlFixture } from './export-control-fixture-build.ts';
import type { ExportControlFixtureConfig } from './export-control-fixture-contract.ts';

const fixtureConfig: ExportControlFixtureConfig = {
  responseDelayMs: 800,
  today: '2026-08-26',
};
const fixtureDocument = '**/__postlude-export-control-fixture';
const isoWeekExplanation = /ISO weeks run Monday to Sunday/u;

test('a hydrated period choice stays paired with its download', async ({
  page,
}) => {
  const assets = await buildExportControlFixture(fixtureConfig);
  await page.route(fixtureDocument, (route) =>
    route.fulfill({ body: '<!doctype html><html></html>', status: 200 }),
  );
  await page.goto('/__postlude-export-control-fixture');
  await page.unroute(fixtureDocument);
  await page.setContent(
    `<html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Export control fixture</title></head><body><main id="export-control-fixture">${assets.markup}</main></body></html>`,
  );
  await page.addStyleTag({ content: assets.styles });
  await page.evaluate((config) => {
    const fixtureWindow =
      globalThis as unknown as ExportControlFixtureWindowShape;
    fixtureWindow.postludeExportControlFixture = config;
  }, fixtureConfig);
  await page.addScriptTag({ content: assets.script, type: 'module' });
  await page.locator('html[data-hydrated="true"]').waitFor();

  const week = page.getByRole('radio', { name: 'Week' });
  await week.check();
  await expect(page.getByText(isoWeekExplanation)).toBeVisible();

  const month = page.getByRole('radio', { name: 'Month' });
  const year = page.getByRole('radio', { name: 'Year' });
  await month.check();
  const downloadStarted = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download the journal' }).click();

  await expect(month).toBeDisabled();
  await expect(year).toBeDisabled();
  expect(await scanWcag22AaViolations(page)).toEqual([]);
  const archive = await downloadStarted;
  expect(archive.suggestedFilename()).toBe('postlude-2026-08-26-monthly.zip');
  await expect(page.locator('html')).toHaveAttribute(
    'data-requested-grouping',
    'month',
  );
  await expect(month).toBeEnabled();
  await expect(month).toBeChecked();
});

type ExportControlFixtureWindowShape = Window & {
  postludeExportControlFixture: ExportControlFixtureConfig;
};
