import { expect, it } from 'bun:test';

import { renderInRouter } from '#/shared/testing/render-in-router.tsx';
import {
  attributeValue,
  elementAttributes,
  openingTag,
} from '#/shared/testing/rendered-html.ts';
import { ArchiveNavigationFailure } from './archive-navigation-failure.tsx';

it('raises the blocked archive navigation and links to the retained day', async () => {
  const html = await renderInRouter(
    <ArchiveNavigationFailure date="2025-11-02" onOpen={() => undefined} />,
  );
  const alert = openingTag(html, 'p');
  const day = elementAttributes(html, 'a', 'Sunday, November 2, 2025');

  expect(alert).toContain('role="alert"');
  expect(attributeValue(day, 'href')).toBe('/day/2025-11-02');
  expect(html).toContain('recover the draft');
});
