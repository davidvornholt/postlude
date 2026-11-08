import { expect, test } from '@playwright/test';
import {
  insightsFixtureConfigs,
  mountInsightsPage,
} from './insights-page-test-support.ts';

// Each fixture bundles the real Insights and editor dependency graph on a cold worker.
const fixtureBuildTimeout = 60_000;
test.setTimeout(fixtureBuildTimeout);

const millisecondsPerDay = 86_400_000;
const alignmentTolerance = 1;
const windows = [
  { from: '2026-01-01', to: '2026-12-31' },
  { from: '2026-01-01', to: '2026-06-03' },
] as const;
for (const window of windows) {
  test(`month labels follow the plotted interval ending ${window.to}`, async ({
    page,
  }, testInfo) => {
    // The year's entry length is drawn from its first day to today.
    await mountInsightsPage(page, {
      ...insightsFixtureConfigs.year,
      view: { ...insightsFixtureConfigs.year.view, today: window.to },
    });
    await page.locator('summary').filter({ hasText: 'Entry length' }).click();
    const chart = page.getByRole('region', { name: 'Entry size chart' });
    const labels = chart.locator('svg + div > span');
    const march = labels.filter({ hasText: 'Mar' });
    await expect(march).toBeVisible();
    const plotBounds = await chart.locator('svg').boundingBox();
    const labelBounds = await march.boundingBox();
    if (!(plotBounds && labelBounds)) {
      throw new Error('Chart geometry is missing.');
    }
    const marchDayOffset =
      (Date.parse('2026-03-01') - Date.parse(window.from)) / millisecondsPerDay;
    const lastDayOffset =
      (Date.parse(window.to) - Date.parse(window.from)) / millisecondsPerDay;
    const expectedCenter =
      plotBounds.x + (plotBounds.width * marchDayOffset) / lastDayOffset;
    expect(
      Math.abs(labelBounds.x + labelBounds.width / 2 - expectedCenter),
    ).toBeLessThan(alignmentTolerance);
    await testInfo.attach('chart-month-axis', {
      body: await chart.screenshot({
        path: testInfo.outputPath('chart-month-axis.png'),
      }),
      contentType: 'image/png',
    });
  });
}
