import { expect, test } from '@playwright/test';
import {
  answerWithDownload,
  downloadedBytes,
  exportButton,
  exportBytes,
  exportCases,
  exportRoute,
  postedGrouping,
  submitHydratedForm,
} from './archive-export-test-support.ts';
import {
  archiveFixtureConfigs,
  mountArchivePage,
  mountArchivePageWithoutJavaScript,
  scanArchive,
} from './archive-page-test-support.ts';

test.describe.configure({ mode: 'serial' });

const colorSchemes = ['light', 'dark'] as const;

for (const exportCase of Object.values(exportCases)) {
  test(`${exportCase.label} is snapped through settlement and recovers after download`, async ({
    page,
  }) => {
    let posts = 0;
    let grouping = '';
    await page.route(exportRoute, (route) => {
      posts += 1;
      grouping = postedGrouping(route);
      return answerWithDownload(route, exportCase.fileName);
    });
    await mountArchivePage(page, archiveFixtureConfigs.exportDelayed);
    const button = exportButton(page);
    const fieldset = page.getByRole('group', {
      name: 'One reading-copy file per',
    });
    const radio = page.getByRole('radio', { name: exportCase.label });
    await radio.check();
    await expect(radio).toBeChecked();
    await button.focus();
    const downloadStarted = page.waitForEvent('download');
    await submitHydratedForm(button);

    await expect(button).toHaveText('Saving before download …');
    await expect(button).toHaveAttribute('aria-disabled', 'true');
    await expect(fieldset).toHaveAttribute('disabled', '');
    await expect(radio).toBeDisabled();
    await expect(radio).toBeChecked();
    await expect(page.locator('input[type=hidden]')).toHaveValue(
      exportCase.grouping,
    );
    await submitHydratedForm(button);

    const download = await downloadStarted;
    expect(download.suggestedFilename()).toBe(exportCase.fileName);
    expect(await downloadedBytes(download)).toEqual(Buffer.from(exportBytes));
    expect(posts).toBe(1);
    expect(grouping).toBe(exportCase.grouping);
    await expect(page.locator('html')).toHaveAttribute(
      'data-export-settle-calls',
      '1',
    );
    await expect(button).toBeFocused();
    await expect(button).toHaveText('Download started');
    await expect(button).toHaveAttribute('aria-disabled', 'true');
    await expect(fieldset).toHaveAttribute('disabled', '');
    await expect(radio).toBeDisabled();
    await expect(page.locator('input[type=hidden]')).toHaveValue(
      exportCase.grouping,
    );
    await expect(page.locator('html')).toHaveAttribute(
      'data-export-settle-status',
      'stored',
    );
    await page.unroute(exportRoute);
  });
}

test('a non-default grouping stays described and posts without JavaScript', async ({
  page,
}) => {
  const { year } = exportCases;
  let method = '';
  let grouping = '';
  await page.route(exportRoute, (route) => {
    method = route.request().method();
    grouping = postedGrouping(route);
    return answerWithDownload(route, year.fileName);
  });
  await mountArchivePageWithoutJavaScript(page, archiveFixtureConfigs.filled);
  const radio = page.getByRole('radio', { name: year.label });
  await radio.check();
  await expect(radio).toBeChecked();
  await expect(radio).toHaveAttribute(
    'aria-describedby',
    'export-year-description',
  );
  await expect(
    page.getByText('One Markdown file for each calendar year', {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.getByText('One Markdown file for each journal day', { exact: false }),
  ).toBeHidden();

  const downloadStarted = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download the journal' }).click();
  const download = await downloadStarted;
  expect(method).toBe('POST');
  expect(grouping).toBe(year.grouping);
  expect(download.suggestedFilename()).toBe(year.fileName);
});

test('a failed settlement keeps the grouping and retries the download', async ({
  page,
}) => {
  const { week } = exportCases;
  let posts = 0;
  await page.route(exportRoute, (route) => {
    posts += 1;
    expect(postedGrouping(route)).toBe(week.grouping);
    return answerWithDownload(route, week.fileName);
  });
  await mountArchivePage(page, archiveFixtureConfigs.exportFailedOnce);
  const radio = page.getByRole('radio', { name: week.label });
  const button = exportButton(page);
  await radio.check();
  await submitHydratedForm(button);
  await expect(page.getByRole('alert')).toContainText(
    'the download did not start',
  );
  expect(posts).toBe(0);
  await expect(radio).toBeChecked();
  await expect(radio).toBeEnabled();
  await expect(button).not.toHaveAttribute('aria-disabled', 'true');
  await expect(
    page.getByRole('group', { name: 'One reading-copy file per' }),
  ).not.toHaveAttribute('disabled', '');

  const downloadStarted = page.waitForEvent('download');
  await submitHydratedForm(button);
  await expect(page.locator('input[type=hidden]')).toHaveValue(week.grouping);
  const download = await downloadStarted;
  expect(download.suggestedFilename()).toBe(week.fileName);
  expect(posts).toBe(1);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(button).not.toHaveAttribute('aria-describedby');
  await expect(page.locator('html')).toHaveAttribute(
    'data-export-settle-calls',
    '2',
  );
});

for (const colorScheme of colorSchemes) {
  test(`export focus, checked, pending, and error states pass WCAG 2.2 AA in ${colorScheme} mode`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await mountArchivePage(page, archiveFixtureConfigs.exportPending);
    const month = page.getByRole('radio', { name: 'Month' });
    const button = exportButton(page);
    await month.check();
    await month.focus();
    await scanArchive(page);
    await submitHydratedForm(button);
    await expect(button).toHaveText('Saving before download …');
    await scanArchive(page);

    await mountArchivePage(page, archiveFixtureConfigs.exportFailed);
    const failedButton = exportButton(page);
    await page.getByRole('radio', { name: 'Year' }).check();
    await failedButton.focus();
    await submitHydratedForm(failedButton);
    await expect(page.getByRole('alert')).toBeVisible();
    await scanArchive(page);
  });
}
