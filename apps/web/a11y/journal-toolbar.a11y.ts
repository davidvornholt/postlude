import { expect, test } from '@playwright/test';

import { mountDayPage, scan } from './day-page-test-support.ts';

const narrowWidth = 320;
const addImageName = /^Add image/u;

const nonSquareControls = (elements: Array<Element>) =>
  elements
    .filter((element) => {
      const style = getComputedStyle(element);
      return [
        style.borderTopLeftRadius,
        style.borderTopRightRadius,
        style.borderBottomLeftRadius,
        style.borderBottomRightRadius,
      ].some((radius) => radius !== '0px');
    })
    .map((element) => element.outerHTML);

test('writing tools fit a narrow screen, preserve selection, and support keyboard navigation', async ({
  page,
}) => {
  await page.setViewportSize({ width: narrowWidth, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/toolbar-fixture', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<html lang="en"><title>Writing tools</title></html>',
    }),
  );
  await page.goto('/toolbar-fixture');
  await mountDayPage(page, ['stored']);
  const evening = page.getByRole('textbox', { name: 'Evening journal' });
  const toolbar = page.getByRole('toolbar');
  await expect(page.getByRole('button', { name: addImageName })).toHaveCount(1);
  await expect(
    toolbar.getByRole('button', { name: 'Bold', exact: true }),
  ).toBeDisabled();
  await scan(page);
  const geometry = () =>
    evening.evaluate((element) => ({
      top: element.getBoundingClientRect().top + window.scrollY,
      height: document.documentElement.scrollHeight,
      scrollY: window.scrollY,
    }));
  await page.getByRole('textbox', { name: 'Morning scripture notes' }).focus();
  const morningGeometry = await geometry();
  await toolbar.getByRole('button', { name: 'Add image', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Add image', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('form')).toHaveAttribute(
    'aria-label',
    'Add image to Morning scripture notes',
  );
  await expect.poll(geometry).toEqual(morningGeometry);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect.poll(geometry).toEqual(morningGeometry);
  const originalTop = (await geometry()).top;
  await evening.fill('Keep these words.');
  await expect.poll(async () => (await geometry()).top).toBe(originalTop);
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Alt+F10');
  const bold = toolbar.getByRole('button', { name: 'Bold', exact: true });
  await expect(bold).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(evening.locator('strong')).toHaveText('Keep these words.');
  await expect(bold).toBeFocused();
  await expect(bold).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('ArrowRight');
  await expect(
    toolbar.getByRole('button', { name: 'Italic', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Space');
  await expect(evening.locator('em')).toHaveText('Keep these words.');
  await scan(page);
  await page.keyboard.press('End');
  const addImage = toolbar.getByRole('button', {
    name: 'Add image',
    exact: true,
  });
  await expect(addImage).toBeFocused();
  await page.keyboard.press('Home');
  await expect(bold).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(evening).toBeFocused();
  await expect(page.locator('[data-formatting-toolbar]')).toHaveCSS(
    'position',
    'sticky',
  );
  const toolbarBox = await toolbar.boundingBox();
  expect(toolbarBox?.x).toBeGreaterThanOrEqual(0);
  expect((toolbarBox?.x ?? 0) + (toolbarBox?.width ?? 0)).toBeLessThanOrEqual(
    narrowWidth,
  );
  await expect(toolbar).toHaveJSProperty(
    'scrollWidth',
    await toolbar.evaluate((element) => element.clientWidth),
  );
  await page.keyboard.press('ArrowRight');
  await page.evaluate(() =>
    window.scrollTo(0, document.documentElement.scrollHeight),
  );
  const bottomGeometry = await geometry();
  expect(bottomGeometry.scrollY).toBeGreaterThan(0);
  await addImage.click();
  await expect(dialog.getByLabel('Image file')).toBeFocused();
  await expect(dialog.getByRole('form')).toHaveAttribute(
    'aria-label',
    'Add image to Evening journal',
  );
  await expect.poll(geometry).toEqual(bottomGeometry);
  await scan(page);
  expect(
    await page
      .locator('button, input, [role=tooltip]')
      .evaluateAll(nonSquareControls),
  ).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(evening).toBeFocused();
  await expect(evening).toHaveText('Keep these words.');
  await expect.poll(geometry).toEqual(bottomGeometry);
});

test('tooltips dismiss with Escape and return on a new keyboard or pointer visit', async ({
  page,
}) => {
  await page.route('**/tooltip-fixture', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<html lang="en"><title>Writing tool hints</title></html>',
    }),
  );
  await page.goto('/tooltip-fixture');
  await mountDayPage(page, ['stored']);
  const evening = page.getByRole('textbox', { name: 'Evening journal' });
  await evening.fill('Keep writing.');
  const bold = page
    .getByRole('toolbar')
    .getByRole('button', { name: 'Bold', exact: true });
  const hint = page.getByRole('tooltip').filter({ hasText: 'Bold' });
  await page.keyboard.press('Alt+F10');
  await expect(hint).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(hint).not.toBeVisible();
  await expect(evening).toBeFocused();
  await page.keyboard.press('Alt+F10');
  await expect(bold).toBeFocused();
  await expect(hint).toBeVisible();
  await scan(page);
  await bold.hover();
  await page.keyboard.press('Escape');
  await expect(hint).not.toBeVisible();
  await page.mouse.move(0, 0);
  await expect(hint).not.toBeVisible();
  await bold.hover();
  const canHover = await page.evaluate(
    () => matchMedia('(hover: hover)').matches,
  );
  await expect(hint).toBeVisible({ visible: canHover });
});
