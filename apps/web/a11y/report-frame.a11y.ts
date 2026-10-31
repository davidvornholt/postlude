import type * as playwright from '@playwright/test';
import { expect, test } from '@playwright/test';

import {
  reportContentSecurityPolicy,
  reportHeightBounds,
} from '../src/features/journal/report-document.ts';
import {
  choose,
  mountEvening,
  reportMetrics,
  scanPage,
} from './evening-flow-test-support.ts';

const colorSchemes = ['light', 'dark'] as const;
const frameSelector = 'iframe[title="Day report"]';
const connectSourceViolation = /connect-src/u;

const openReport = async (page: playwright.Page): Promise<void> => {
  const toggle = page.getByRole('button', { name: 'Show the report' });
  await expect(toggle).toBeDisabled();
  await expect(page.getByText('Rate your energy first.')).toBeVisible();
  await choose(page, 'Energy', 'Okay');
  await expect(toggle).toBeEnabled();
  await toggle.click();
  await expect(
    page.getByRole('button', { name: 'Hide the report' }),
  ).toHaveAttribute('aria-expanded', 'true');
};

const frameHeight = (page: playwright.Page): Promise<string> =>
  page.locator(frameSelector).evaluate((frame) => frame.style.height);

for (const colorScheme of colorSchemes) {
  const otherScheme = colorScheme === 'light' ? 'dark' : 'light';

  test(`the report opens after energy, sandboxed and fed its numbers, in ${colorScheme} mode`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await mountEvening(page, 'report');
    await openReport(page);

    const frame = page.locator(frameSelector);
    await expect(frame).toHaveAttribute('sandbox', 'allow-scripts');
    await expect(frame).toHaveAttribute('referrerpolicy', 'no-referrer');
    const srcdoc = (await frame.getAttribute('srcdoc')) ?? '';
    expect(srcdoc).not.toContain(String(reportMetrics.activeMinutes));

    const report = page.frameLocator(frameSelector);
    const root = report.locator('html');
    await expect(report.locator('[data-metric="activeMinutes"]')).toHaveText(
      String(reportMetrics.activeMinutes),
    );
    await expect(report.locator('[data-metric="metricsVersion"]')).toHaveText(
      String(reportMetrics.metricsVersion),
    );
    await expect(report.locator('[data-metric="landedPrs"]')).toHaveText(
      'Not measured',
    );
    await expect(root).toHaveAttribute('data-theme', colorScheme);

    // The policy sits in the parsed head, after the doctype, so the report is
    // still in standards mode and every request it tries is refused.
    await expect(
      report.locator('head > meta[http-equiv="Content-Security-Policy"]'),
    ).toHaveAttribute('content', reportContentSecurityPolicy);
    const handle = await frame.elementHandle();
    const content = await handle?.contentFrame();
    expect(await content?.evaluate(() => document.compatMode)).toBe(
      'CSS1Compat',
    );
    await expect(root).toHaveAttribute('data-network', 'blocked');
    await expect(root).toHaveAttribute(
      'data-violations',
      connectSourceViolation,
    );
    await expect(root).toHaveAttribute('data-cookies', 'blocked');
    await expect(root).toHaveAttribute('data-storage', 'blocked');
    await expect(root).toHaveAttribute('data-parent-page', 'blocked');

    // The frame takes the height the report asked for, within bounds.
    const requested = Number(await root.getAttribute('data-requested-height'));
    const expected = `${Math.max(requested, reportHeightBounds.minimum)}px`;
    await expect.poll(() => frameHeight(page)).toBe(expected);
    await scanPage(page);

    // A height request that doesn't come from the report's own window is
    // ignored, even when it is shaped exactly like one.
    await page.evaluate(() => {
      window.postMessage({ type: 'postlude:report-height', height: 9000 }, '*');
    });
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(resolve)),
    );
    expect(await frameHeight(page)).toBe(expected);

    // The report follows the page's colour scheme when it changes.
    await page.emulateMedia({ colorScheme: otherScheme });
    await expect(root).toHaveAttribute('data-theme', otherScheme);
    await expect(root).toHaveAttribute('data-messages', '2');
  });
}

test('the open report leads straight back to the writing', async ({ page }) => {
  await mountEvening(page, 'report');
  await openReport(page);
  const back = page.getByRole('button', { name: 'Back to writing' });
  await expect(back).toHaveCount(2);

  await back.last().click();
  await expect(
    page.getByRole('textbox', { name: 'Evening journal' }),
  ).toBeFocused();
});

test('a report that navigates its frame away is taken down', async ({
  page,
}) => {
  await mountEvening(page, 'report');
  await openReport(page);
  const report = page.frameLocator(frameSelector);
  await expect(report.locator('html')).toHaveAttribute('data-messages', '1');

  const handle = await page.locator(frameSelector).elementHandle();
  const content = await handle?.contentFrame();
  await content?.evaluate(() => {
    globalThis.location.href = 'about:blank';
  });
  await expect(
    page.getByText('The report tried to open another page inside its frame'),
  ).toBeVisible();
  await expect(page.locator(frameSelector)).toHaveCount(0);
});
