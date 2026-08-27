import { expect, it } from 'bun:test';
import {
  classNames,
  elementAttributes,
  openingTag,
  plainText,
} from '#/shared/testing/rendered-html.ts';
import { entryOn, renderDay, today } from './day-page-test-support.tsx';

it('reads back an earlier year and opens the day it came from', async () => {
  const html = await renderDay(entryOn(), [
    {
      date: '2025-08-26',
      yearsAgo: 1,
      words: 210,
      snippet: 'Moved the desk under the window.',
    },
  ]);

  expect(html).toContain('On this day');
  expect(html).toContain('Moved the desk under the window.');
  expect(plainText(html)).toContain('1 year ago · Tuesday, August 26, 2025');
  expect(html).toContain('href="/day/2025-08-26"');
});

it('leaves the section out on a date with no years behind it', async () => {
  expect(await renderDay(entryOn())).not.toContain('On this day');
});

it('puts the memory after the evening rather than before it', async () => {
  const html = await renderDay(entryOn(), [
    {
      date: '2025-08-26',
      yearsAgo: 1,
      words: 210,
      snippet: 'Moved the desk under the window.',
    },
  ]);

  expect(html.indexOf('Evening')).toBeLessThan(html.indexOf('On this day'));
});

it('offers a way to a day by naming it, without needing script', async () => {
  const html = await renderDay(entryOn({ date: '2026-08-24' }));

  expect(html).toContain('action="/day"');
  expect(html).toContain('method="get"');
  expect(html).toContain('Go to a day');
  expect(html).toContain(`max="${today}"`);
  expect(html).toContain('value="2026-08-24"');
});

it('makes the date itself the way to another day', async () => {
  const html = await renderDay(entryOn({ date: '2026-08-24' }));
  const heading = elementAttributes(html, 'label', 'Monday, August 24, 2026');
  const field = openingTag(html, 'input');

  expect(heading).toContain('for=');
  expect(classNames(heading)).toContain('border-ink-muted');
  expect(field).toContain(
    'aria-label="Monday, August 24, 2026. Go to another day."',
  );
  expect(html.match(/<h1\b/gu)?.length).toBe(1);
});
