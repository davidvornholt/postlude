import { expect, test } from '@playwright/test';

import { mountSearchPage } from './search-page-test-support.ts';

test('the focused search outline aligns beside its action or wraps clear of it', async ({
  page,
}) => {
  await mountSearchPage(page, 'populated');
  const field = page.getByRole('searchbox', { name: 'Words to find' });
  await field.focus();
  const layout = await field.evaluate((element) => {
    if (!(element instanceof HTMLInputElement)) {
      throw new Error('The search field is not an input.');
    }
    const fieldBounds = element.getBoundingClientRect();
    const fieldStyles = getComputedStyle(element);
    const button = element.form?.querySelector('button');
    if (button === null || button === undefined) {
      throw new Error('The search action is missing.');
    }
    const outlineBottom =
      fieldBounds.bottom +
      Number.parseFloat(fieldStyles.outlineWidth) +
      Number.parseFloat(fieldStyles.outlineOffset);
    const buttonBounds = button.getBoundingClientRect();
    return {
      buttonIsBelow: buttonBounds.top >= outlineBottom,
      edgeDifference: Math.abs(outlineBottom - buttonBounds.bottom),
    };
  });
  expect(layout.buttonIsBelow || layout.edgeDifference <= 1).toBe(true);
});
