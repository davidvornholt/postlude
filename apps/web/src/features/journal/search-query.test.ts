/**
 * What a typed line is taken to mean, and what comes back to be read.
 *
 * These are the two halves search cannot get wrong without lying to the writer:
 * the terms handed to the database have to be the words that were typed and
 * nothing the query parser could act on, and the excerpt handed to the page has
 * to mark the words that were actually found.
 */

import { expect, it } from 'bun:test';

import { searchTerms, searchTokenText, searchTsQuery } from './search-query.ts';

it('reads a typed line as the words it holds, lowercased', () => {
  expect(searchTerms('Rain   fell ALL night')).toEqual([
    'rain',
    'fell',
    'all',
    'night',
  ]);
});

/*
 * Punctuation is a word boundary rather than an operator. It must not merge two
 * words into a third word the writer never typed.
 */
it('turns everything that is not a letter or a digit into a boundary', () => {
  expect(searchTerms("rain, & fell! (twice) 'quoted' 2026")).toEqual([
    'rain',
    'fell',
    'twice',
    'quoted',
    '2026',
  ]);
  expect(searchTerms('rain,fell')).toEqual(['rain', 'fell']);
});

it('reads a line of pure punctuation as no search at all', () => {
  expect(searchTerms('  &&& !? ')).toEqual([]);
});

it('keeps a word written in another script', () => {
  expect(searchTerms('Gebet über Sprüche')).toEqual([
    'gebet',
    'über',
    'sprüche',
  ]);
});

it('normalizes canonically equivalent Unicode before searching', () => {
  expect(searchTerms('Spru\u0308che')).toEqual(['sprüche']);
  expect(searchTerms('Ｆａｉｔｈ')).toEqual(['faith']);
});

it('uses one case fold for dotted I and both Greek sigmas', () => {
  expect(searchTerms('İSTANBUL ΟΣ ος οσ')).toEqual(['istanbul', 'οσ']);
});

it('deduplicates terms after canonical folding', () => {
  expect(searchTerms('İSTANBUL istanbul ΟΣ ος οσ')).toEqual(['istanbul', 'οσ']);
});

it('stores the same punctuation-delimited token stream a query uses', () => {
  const source = 'Mail.Name@example.com / notes/1.John';
  expect(searchTokenText(source)).toBe(searchTerms(source).join(' '));
  expect(searchTokenText(source)).toBe('mail name example com notes 1 john');
});

it('asks for every term, each as a prefix', () => {
  expect(searchTsQuery(['rain', 'fell'])).toBe('rain:* & fell:*');
});

it('has nothing to ask when no word was typed', () => {
  expect(searchTsQuery([])).toBe('');
});
