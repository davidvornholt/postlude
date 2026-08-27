import { expect, it } from 'bun:test';
import { Schema } from 'effect';

import {
  SearchQuery,
  searchHitOf,
  searchQueryLengthLimit,
} from '../search-contract.ts';
import { searchTerms } from '../search-query.ts';

const distantWordGap = 80;

const joined = (excerpt: ReadonlyArray<{ readonly text: string }>) =>
  excerpt.map((segment) => segment.text).join('');

it('attributes and highlights a book-only match to the morning', () => {
  const hit = searchHitOf(['sprüche'])({
    date: '2026-03-01',
    journalText: 'A quiet evening.',
    scriptureText: '',
    scriptureReferenceText:
      'Proverbs 12:5-13\nSprüche 12:5-13\nSprueche 12:5-13\nSpr 12:5-13',
    words: 3,
  });
  expect(hit.sources).toHaveLength(1);
  expect(hit.sources[0]?.kind).toBe('passage-reference');
  expect(joined(hit.sources[0]?.excerpts[0] ?? [])).toBe('Sprüche 12:5-13');
  expect(
    hit.sources[0]?.excerpts[0]
      .filter((segment) => segment.match)
      .map((segment) => segment.text),
  ).toEqual(['Sprüche']);
});

it('keeps evidence for terms split across evening, notes, and reference', () => {
  const hit = searchHitOf(['rain', 'mercy', 'sprüche'])({
    date: '2026-03-01',
    journalText: 'Rain came after dusk.',
    scriptureText: 'Mercy was the morning note.',
    scriptureReferenceText:
      'Proverbs 12:5-13\nSprüche 12:5-13\nSprueche 12:5-13\nSpr 12:5-13',
    words: 11,
  });

  expect(hit.sources.map(({ kind }) => kind)).toEqual([
    'evening',
    'scripture-notes',
    'passage-reference',
  ]);
  expect(
    hit.sources.flatMap(({ excerpts }) =>
      excerpts.flatMap((excerpt) =>
        excerpt
          .filter((segment) => segment.match)
          .map((segment) => segment.text.toLocaleLowerCase('de-DE')),
      ),
    ),
  ).toEqual(['rain', 'mercy', 'sprüche']);
});

it('shows distant terms from one source in separate excerpts', () => {
  const hit = searchHitOf(['rain', 'orchard'])({
    date: '2026-03-01',
    journalText: `Rain opened the day. ${'quiet '.repeat(distantWordGap)}The orchard closed it.`,
    scriptureText: '',
    scriptureReferenceText: '',
    words: 90,
  });

  expect(hit.sources).toHaveLength(1);
  expect(hit.sources[0]?.excerpts).toHaveLength(2);
  expect(
    hit.sources[0]?.excerpts.map((excerpt) =>
      excerpt.find((segment) => segment.match)?.text.toLowerCase(),
    ),
  ).toEqual(['rain', 'orchard']);
});

it('attributes canonical dotted I and final sigma matches to original prose', () => {
  const hit = searchHitOf(searchTerms('istanbul τελικόσ'))({
    date: '2026-03-01',
    journalText: 'İstanbul after dusk.',
    scriptureText: 'Μια σκέψη τελικός.',
    scriptureReferenceText: '',
    words: 6,
  });

  expect(hit.sources.map(({ kind }) => kind)).toEqual([
    'evening',
    'scripture-notes',
  ]);
  expect(
    hit.sources.flatMap(({ excerpts }) =>
      excerpts.flatMap((excerpt) =>
        excerpt.filter(({ match }) => match).map(({ text }) => text),
      ),
    ),
  ).toEqual(['İstanbul', 'τελικός']);
});

it('keeps the query length contract shared and fail-closed', () => {
  const decode = Schema.decodeUnknownEither(SearchQuery);
  expect(decode({ q: 'x'.repeat(searchQueryLengthLimit) })._tag).toBe('Right');
  expect(decode({ q: 'x'.repeat(searchQueryLengthLimit + 1) })._tag).toBe(
    'Left',
  );
});
