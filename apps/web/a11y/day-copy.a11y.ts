import { expect, test } from '@playwright/test';

import { mountDayPage, scan } from './day-page-test-support.ts';

const captureClipboardWrites = (
  page: import('@playwright/test').Page,
): Promise<void> =>
  page.evaluate(() => {
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: (markdown: string) => {
          document.documentElement.dataset.copiedMarkdown = markdown;
          return Promise.resolve();
        },
      },
    });
  });

test('copy day uses the live draft and confirms the Markdown copy', async ({
  page,
}) => {
  await mountDayPage(page, ['pending']);
  await captureClipboardWrites(page);

  await page.getByRole('textbox', { name: 'Passage' }).fill('Proverbs 12:5');
  await page
    .getByRole('textbox', { name: 'Morning scripture notes' })
    .fill('Morning draft.');
  await page
    .getByRole('textbox', { name: 'Evening journal' })
    .fill('Evening draft.');
  const copy = page.getByRole('button', { name: 'Copy day as Markdown' });
  await copy.scrollIntoViewIfNeeded();
  const positionBefore = await copy.boundingBox();
  await copy.click();

  await expect(copy).toHaveAttribute('data-copy-state', 'succeeded');
  await expect(page.getByText('Day copied as Markdown.')).toHaveText(
    'Day copied as Markdown.',
  );
  const positionAfter = await copy.boundingBox();
  expect(positionAfter?.x).toBe(positionBefore?.x);
  expect(positionAfter?.y).toBe(positionBefore?.y);
  await expect(page.locator('html')).toHaveAttribute(
    'data-copied-markdown',
    `# Wednesday, August 26, 2026

## Morning

Passage: Proverbs 12:5

Morning draft.

## Evening

Evening draft.
`,
  );
  await scan(page);
});

test('copy day leaves an actionable failure when clipboard access is refused', async ({
  page,
}) => {
  await mountDayPage(page, ['stored']);
  await page.evaluate(() => {
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: () => Promise.reject(new Error('Clipboard denied.')),
      },
    });
  });

  await page.getByRole('button', { name: 'Copy day as Markdown' }).click();

  await expect(page.getByText('Could not copy. Try again.')).toBeVisible();
  await scan(page);
});
