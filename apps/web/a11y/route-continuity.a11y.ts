import { expect, test } from '@playwright/test';

import { mountArchiveNavigation } from './archive-navigation-test-support.ts';

type BrowserPage = Parameters<typeof mountArchiveNavigation>[0];

const beginContentOpacitySampling = async (
  page: BrowserPage,
): Promise<void> => {
  await page.locator('main').evaluate((main) => {
    main.dataset.minimumContentOpacity = '1';
    main.dataset.sampleContentOpacity = 'true';

    const sample = () => {
      const content = main.firstElementChild;
      if (content instanceof HTMLElement) {
        const opacity = Number.parseFloat(getComputedStyle(content).opacity);
        const minimum = Number.parseFloat(
          main.dataset.minimumContentOpacity ?? '1',
        );
        main.dataset.minimumContentOpacity = String(Math.min(minimum, opacity));
      }
      if (main.dataset.sampleContentOpacity === 'true') {
        requestAnimationFrame(sample);
      }
    };

    requestAnimationFrame(sample);
  });
};

const finishContentOpacitySampling = async (
  page: BrowserPage,
): Promise<number> =>
  page.locator('main').evaluate(
    (main) =>
      new Promise<number>((resolve) => {
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            main.dataset.sampleContentOpacity = 'false';
            resolve(
              Number.parseFloat(main.dataset.minimumContentOpacity ?? '1'),
            );
          }),
        );
      }),
  );

const openViewWithoutBlankingContent = async (
  page: BrowserPage,
  linkName: string,
  headingName: string,
): Promise<void> => {
  await beginContentOpacitySampling(page);
  let minimumOpacity = 1;
  try {
    await page.getByRole('link', { name: linkName, exact: true }).click();
    await expect(
      page.getByRole('heading', { level: 1, name: headingName }),
    ).toBeVisible();
  } finally {
    minimumOpacity = await finishContentOpacitySampling(page);
  }
  expect(minimumOpacity).toBe(1);
};

test('navigation keeps the page content opaque between views', async ({
  page,
}) => {
  await mountArchiveNavigation(page);

  await openViewWithoutBlankingContent(page, 'Calendar', 'August 2026');
  await openViewWithoutBlankingContent(
    page,
    'On this day',
    'Wednesday, August 26',
  );
  await openViewWithoutBlankingContent(
    page,
    'Today',
    'Wednesday, August 26, 2026',
  );
  await expect(page.getByRole('link', { name: 'Today' })).toHaveAttribute(
    'aria-current',
    'page',
  );
});
