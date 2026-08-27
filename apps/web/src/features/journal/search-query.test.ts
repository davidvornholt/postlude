/**
 * What a typed line is taken to mean, and what comes back to be read.
 *
 * These are the two halves search cannot get wrong without lying to the writer:
 * the terms handed to the database have to be the words that were typed and
 * nothing the query parser could act on, and the excerpt handed to the page has
 * to mark the words that were actually found.
 */

import { expect, it } from 'bun:test';

import { searchExcerpt, searchTerms, searchTsQuery } from './search-query.ts';

/* Long enough that the excerpt window opens after the start of the day and
 * closes before its end, which is the only way both ellipses appear. */
const wordsBeforeMatch = 40;
const wordsAfterMatch = 60;
const before = 'quiet '.repeat(wordsBeforeMatch);
const after = ' later'.repeat(wordsAfterMatch);

const marked = (segments: ReadonlyArray<{ text: string; match: boolean }>) =>
  segments.filter((segment) => segment.match).map((segment) => segment.text);

const joined = (segments: ReadonlyArray<{ text: string }>) =>
  segments.map((segment) => segment.text).join('');

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

it('asks for every term, each as a prefix', () => {
  expect(searchTsQuery(['rain', 'fell'])).toBe('rain:* & fell:*');
});

it('has nothing to ask when no word was typed', () => {
  expect(searchTsQuery([])).toBe('');
});

it('gives back a day with no search as one unmarked run', () => {
  expect(searchExcerpt('A quiet evening.', [])).toEqual([
    { text: 'A quiet evening.', match: false, at: 0 },
  ]);
});

it('has nothing to show for a day with no prose', () => {
  expect(searchExcerpt('   \n  ', ['rain'])).toEqual([]);
});

it('marks the matched word and leaves the rest of the line alone', () => {
  const segments = searchExcerpt('The rain fell all night.', ['rain']);
  expect(marked(segments)).toEqual(['rain']);
  expect(joined(segments)).toBe('The rain fell all night.');
});

it('marks a match whatever case the day was written in', () => {
  expect(marked(searchExcerpt('Rain, and more RAIN.', ['rain']))).toEqual([
    'Rain',
    'RAIN',
  ]);
});

it('marks canonically equivalent Unicode text', () => {
  expect(marked(searchExcerpt('Sprüche', ['spru\u0308che']))).toEqual([
    'Sprüche',
  ]);
});

/*
 * The database matched the day on a prefix, so the excerpt marks the whole word
 * the prefix found rather than the first few letters of it.
 */
it('marks the whole word a prefix found', () => {
  expect(marked(searchExcerpt('Gebete am Morgen.', ['gebet']))).toEqual([
    'Gebete',
  ]);
});

it('does not mark a term buried inside another word', () => {
  expect(marked(searchExcerpt('Ein Vorgebet.', ['gebet']))).toEqual([]);
});

it('collapses the line breaks of a written day into running prose', () => {
  expect(joined(searchExcerpt('First line.\n\nSecond line.', []))).toBe(
    'First line. Second line.',
  );
});

it('opens at the first match rather than at the top of a long day', () => {
  const segments = searchExcerpt(`${before}rain fell${after}`, ['rain']);
  const text = joined(segments);
  expect(text.startsWith('… ')).toBe(true);
  expect(text.endsWith(' …')).toBe(true);
  expect(text).toContain('rain fell');
  expect(marked(segments)).toEqual(['rain']);
});

it('never cuts a word in half at either end', () => {
  const text = joined(searchExcerpt(`${before}rain fell${after}`, ['rain']));
  const words = text.slice('… '.length, -' …'.length).split(' ');
  expect(words.at(0)).toBe('quiet');
  expect(words.at(-1)).toBe('later');
});

/*
 * A day can match on a form the plain text does not literally contain — a
 * prefix the excerpt's own pattern misses. Showing its opening is a truer answer
 * than showing an empty row for a day the database says holds the word.
 */
it('falls back to the opening of a day it cannot mark', () => {
  const segments = searchExcerpt('A quiet evening.', ['storm']);
  expect(joined(segments)).toBe('A quiet evening.');
  expect(marked(segments)).toEqual([]);
});

it('gives every run its own place in the excerpt', () => {
  const segments = searchExcerpt('Rain, and more rain.', ['rain']);
  const places = segments.map((segment) => segment.at);
  expect(new Set(places).size).toBe(segments.length);
  expect(places).toEqual([...places].sort((a, b) => a - b));
});
