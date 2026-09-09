import { expect, test } from '@playwright/test';

import { mountDayPage, scan } from './day-page-test-support.ts';

const expectedImages = 3;
const key = '12345678-1234-4234-8234-123456789abc.png';
const imageUrl = `/api/journal-images/${key}`;
const imageBase64 =
  // biome-ignore lint/security/noSecrets: Public one-pixel PNG test fixture, not a credential.
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const image = {
  name: 'lake.png',
  mimeType: 'image/png',
  buffer: Buffer.from(imageBase64, 'base64'),
};

for (const colorScheme of ['light', 'dark'] as const) {
  test(`uploads and pastes private images, enlarges them, and formats the active editor in ${colorScheme}`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await page.route('**/image-fixture', (route) =>
      route.fulfill({
        contentType: 'text/html',
        // biome-ignore lint/security/noSecrets: Static HTML fixture contains no credential.
        body: '<html lang="en"><title>Journal fixture</title></html>',
      }),
    );
    await page.goto('/image-fixture');
    await mountDayPage(page, ['stored']);
    let uploads = 0;
    await page.route('**/api/journal-images/', (route) => {
      uploads += 1;
      return route.fulfill({ json: { src: imageUrl } });
    });
    await page.route(`**${imageUrl}`, (route) =>
      route.fulfill({ contentType: 'image/png', body: image.buffer }),
    );
    const evening = page.getByRole('textbox', { name: 'Evening journal' });
    await evening.fill('A quiet evening.');
    await evening.focus();
    await page.keyboard.press('ControlOrMeta+a');
    const toolbar = page.getByRole('group', {
      name: 'Formatting Evening journal',
    });
    await toolbar.getByRole('button', { name: 'Bold', exact: true }).click();
    await expect(evening.locator('strong')).toHaveText('A quiet evening.');
    await page.keyboard.press('ArrowRight');
    await page
      .getByRole('button', { name: 'Add image to Evening journal' })
      .click();
    const form = page.getByRole('form', {
      name: 'Add image to Evening journal',
    });
    await form.getByLabel('Image file').setInputFiles(image);
    await form
      .getByLabel('Image description (optional)')
      .fill('Evening at the lake');
    await scan(page);
    await form.getByRole('button', { name: 'Insert image' }).click();
    const enlarge = page.getByRole('button', {
      name: 'Enlarge image: Evening at the lake',
    });
    await expect(enlarge).toBeVisible();
    await enlarge.click();
    const viewer = page.getByRole('dialog', { name: 'Evening at the lake' });
    await expect(viewer).toBeVisible();
    await expect(
      viewer.getByRole('button', { name: 'Close image' }),
    ).toBeFocused();
    await scan(page);
    await page.keyboard.press('Escape');
    await expect(viewer).not.toBeVisible();
    await expect(enlarge).toBeFocused();
    await evening.focus();
    await evening.locator('p').last().click();
    await evening.evaluate((element, base64) => {
      const clipboard = new DataTransfer();
      clipboard.items.add(
        new File(
          [
            Uint8Array.from(atob(base64), (character) =>
              character.charCodeAt(0),
            ),
          ],
          'pasted.png',
          { type: 'image/png' },
        ),
      );
      clipboard.items.add(
        new File(
          [
            Uint8Array.from(atob(base64), (character) =>
              character.charCodeAt(0),
            ),
          ],
          'second.png',
          { type: 'image/png' },
        ),
      );
      element.dispatchEvent(
        new ClipboardEvent('paste', {
          clipboardData: clipboard,
          bubbles: true,
          cancelable: true,
        }),
      );
    }, imageBase64);
    await expect(evening.locator('.journal-image-button')).toHaveCount(
      expectedImages,
    );
    expect(uploads).toBe(expectedImages);
    await expect(page.getByText('Autosave on', { exact: true })).toBeVisible();
    const morning = page.getByRole('textbox', {
      name: 'Morning scripture notes',
    });
    await morning.fill('Morning thought');
    await morning.focus();
    await page.keyboard.press('ControlOrMeta+a');
    await page
      .getByRole('group', { name: 'Formatting Morning scripture notes' })
      .getByRole('button', { name: 'Italic', exact: true })
      .click();
    await expect(morning.locator('em')).toHaveText('Morning thought');
    await expect(evening.locator('strong')).toHaveText('A quiet evening.');
    await scan(page);
  });
}

test('failed image uploads retain the writing and offer retry', async ({
  page,
}) => {
  await page.route('**/image-fixture', (route) =>
    route.fulfill({
      contentType: 'text/html',
      // biome-ignore lint/security/noSecrets: Static HTML fixture contains no credential.
      body: '<html lang="en"><title>Journal fixture</title></html>',
    }),
  );
  await page.goto('/image-fixture');
  await mountDayPage(page, ['stored']);
  await page.route('**/api/journal-images/', (route) =>
    route.fulfill({ status: 503 }),
  );
  const evening = page.getByRole('textbox', { name: 'Evening journal' });
  await evening.fill('Keep these words.');
  await page
    .getByRole('button', { name: 'Add image to Evening journal' })
    .click();
  const form = page.getByRole('form', { name: 'Add image to Evening journal' });
  await form.getByLabel('Image file').setInputFiles(image);
  await form.getByRole('button', { name: 'Insert image' }).click();
  await expect(form.getByRole('status')).toContainText(
    'The image could not be uploaded.',
  );
  await expect(evening).toHaveText('Keep these words.');
  await expect(evening).toHaveAttribute('contenteditable', 'true');
  await expect(
    form.getByRole('button', { name: 'Insert image' }),
  ).toBeEnabled();
  await scan(page);
});
