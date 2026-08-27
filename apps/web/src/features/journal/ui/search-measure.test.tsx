import { expect, it } from 'bun:test';

import { renderInRouter } from '#/shared/testing/render-in-router.tsx';
import {
  classNames,
  elementAttributes,
  openingTag,
} from '#/shared/testing/rendered-html.ts';
import { readingMeasureClass } from '#/shared/ui/design-classes.ts';
import type { SearchResults } from '../search-contract.ts';
import { SearchPage } from './search-page.tsx';

const results: SearchResults = {
  query: '',
  today: '2026-08-26',
  terms: [],
  hits: [],
  limited: false,
};
const search = () => Promise.reject(new Error('SSR does not submit a search.'));
const html = await renderInRouter(
  <SearchPage search={search} view={{ state: 'answered', results }} />,
);
const measureNames = readingMeasureClass.split(' ');

it('keeps the search field inside the shared reading measure', () => {
  const formClasses = classNames(openingTag(html, 'form'));

  for (const name of measureNames) {
    expect(formClasses.has(name)).toBe(true);
  }
});

it('keeps the quiet answer inside the shared reading measure', () => {
  const answerClasses = classNames(
    elementAttributes(
      html,
      'p',
      'Every evening you have written is searchable. One word is usually enough; a word is matched from its beginning, so “rain” also finds “rainy”.',
    ),
  );

  for (const name of measureNames) {
    expect(answerClasses.has(name)).toBe(true);
  }
});
