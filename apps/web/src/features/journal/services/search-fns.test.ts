import { expect, it } from 'bun:test';
import { Schema } from 'effect';

import {
  SearchQuery,
  searchHitOf,
  searchQueryLengthLimit,
} from '../search-contract.ts';

const joined = (
  excerpt: ReturnType<ReturnType<typeof searchHitOf>>['excerpt'],
) => excerpt.map((segment) => segment.text).join('');

it('attributes and highlights a book-only match to the morning', () => {
  const hit = searchHitOf(['sprüche'])({
    date: '2026-03-01',
    journalText: 'A quiet evening.',
    scriptureText: '',
    scriptureReferenceText:
      'Proverbs 12:5-13\nSprüche 12:5-13\nSprueche 12:5-13\nSpr 12:5-13',
    words: 3,
  });
  expect(hit.fromScripture).toBe(true);
  expect(joined(hit.excerpt)).toBe('Sprüche 12:5-13');
  expect(
    hit.excerpt
      .filter((segment) => segment.match)
      .map((segment) => segment.text),
  ).toEqual(['Sprüche']);
});

it('keeps the query length contract shared and fail-closed', () => {
  const decode = Schema.decodeUnknownEither(SearchQuery);
  expect(decode({ q: 'x'.repeat(searchQueryLengthLimit) })._tag).toBe('Right');
  expect(decode({ q: 'x'.repeat(searchQueryLengthLimit + 1) })._tag).toBe(
    'Left',
  );
});
