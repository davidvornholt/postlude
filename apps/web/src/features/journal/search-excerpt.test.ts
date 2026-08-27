import { expect, it } from 'bun:test';

import { searchQueryLengthLimit } from './search-contract.ts';
import { searchExcerpt, searchExcerpts } from './search-excerpt.ts';

const wordsBeforeMatch = 40;
const wordsAfterMatch = 60;
const before = 'quiet '.repeat(wordsBeforeMatch);
const after = ' later'.repeat(wordsAfterMatch);
const kibibyte = 1024;
const mebibyte = kibibyte * kibibyte;
const duplicateTermCount = 100;
const maxDistinctTermCount = 66;
const maxSearchHitCount = 50;
const unifiedIdeographStart = 0x4e_00;

const marked = (segments: ReadonlyArray<{ text: string; match: boolean }>) =>
  segments.filter((segment) => segment.match).map((segment) => segment.text);

const joined = (segments: ReadonlyArray<{ text: string }>) =>
  segments.map((segment) => segment.text).join('');

it('gives back a day with no search as one unmarked run', () => {
  expect(searchExcerpt('A quiet evening.', [])).toEqual([
    { text: 'A quiet evening.', match: false, at: 0 },
  ]);
});

it('has nothing to show for a day with no prose', () => {
  expect(searchExcerpt('   \n  ', ['rain'])).toEqual([]);
});

it('marks every occurrence while leaving the prose unchanged', () => {
  const segments = searchExcerpt('Rain, and more RAIN.', ['rain']);
  expect(marked(segments)).toEqual(['Rain', 'RAIN']);
  expect(joined(segments)).toBe('Rain, and more RAIN.');
});

it('marks canonically equivalent Unicode text', () => {
  expect(marked(searchExcerpt('Sprüche', ['spru\u0308che']))).toEqual([
    'Sprüche',
  ]);
});

it('maps dotted I and final sigma matches back to original graphemes', () => {
  expect(
    marked(searchExcerpt('İstanbul and τελικός', ['istanbul', 'τελικόσ'])),
  ).toEqual(['İstanbul', 'τελικός']);
});

it('marks the whole word a prefix found', () => {
  expect(marked(searchExcerpt('Gebete am Morgen.', ['gebet']))).toEqual([
    'Gebete',
  ]);
});

it('does not mark a term buried inside another word', () => {
  expect(marked(searchExcerpt('Ein Vorgebet.', ['gebet']))).toEqual([]);
});

it('collapses line breaks into running prose', () => {
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

it('keeps distant matched terms in separate excerpts', () => {
  const result = searchExcerpts(
    `Rain opened the day. ${'quiet '.repeat(wordsAfterMatch)}The orchard closed it.`,
    ['rain', 'orchard'],
  );
  expect(result.excerpts).toHaveLength(2);
  expect(result.excerpts.map(marked)).toEqual([['Rain'], ['orchard']]);
});

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

it('scans a one-mebibyte source once for duplicated query terms', () => {
  const suffix = ' needle';
  const source = `${'quiet '.repeat(Math.ceil((mebibyte - suffix.length) / 'quiet '.length)).slice(0, mebibyte - suffix.length)}${suffix}`;
  const result = searchExcerpts(
    source,
    Array.from({ length: duplicateTermCount }, () => 'NEEDLE'),
  );
  const expectedTokenCount = source.split(' ').length;
  expect(source).toHaveLength(mebibyte);
  expect(result.work.sourceTokenScans).toBe(1);
  expect(result.work.visibleCodeUnits).toBe(mebibyte);
  expect(result.work.canonicalTermCount).toBe(1);
  expect(result.work.sourceTokenCount).toBe(expectedTokenCount);
  expect(result.work.prefixCharactersVisited).toBe(
    expectedTokenCount + 'needle'.length - 1,
  );
  expect(result.excerpts.map(marked)).toEqual([['needle']]);
});

it('indexes max-shape attribution without rereading every match per term', () => {
  const terms = Array.from({ length: maxDistinctTermCount }, (_, at) =>
    String.fromCodePoint(unifiedIdeographStart + at),
  );
  const query = terms.join(' ');
  const sourceRepetitions = 50;
  const source = Array.from({ length: sourceRepetitions }, () => query).join(
    ' ',
  );
  const sourceTokenCount = maxDistinctTermCount * sourceRepetitions;
  let totalRangeEmits = 0;
  let totalRangeVisits = 0;
  let totalRangeWrites = 0;
  let totalSourceTokens = 0;
  let totalTermLookups = 0;
  let totalWindows = 0;

  expect(query.length).toBeLessThanOrEqual(searchQueryLengthLimit);
  for (let hit = 0; hit < maxSearchHitCount; hit += 1) {
    const result = searchExcerpts(source, terms);
    expect(result.work.canonicalTermCount).toBe(maxDistinctTermCount);
    expect(result.work.sourceTokenScans).toBe(1);
    expect(result.work.sourceTokenCount).toBe(sourceTokenCount);
    expect(result.work.evidenceTermLookups).toBe(maxDistinctTermCount);
    expect(result.work.evidenceRangeEmits).toBe(
      result.work.evidenceRangeWrites,
    );
    expect(result.work.evidenceRangeVisits).toBeLessThanOrEqual(
      result.work.evidenceRangeWrites + result.work.evidenceWindowCount,
    );
    expect(result.excerpts).toHaveLength(result.work.evidenceWindowCount);
    totalRangeEmits += result.work.evidenceRangeEmits;
    totalRangeVisits += result.work.evidenceRangeVisits;
    totalRangeWrites += result.work.evidenceRangeWrites;
    totalSourceTokens += result.work.sourceTokenCount;
    totalTermLookups += result.work.evidenceTermLookups;
    totalWindows += result.work.evidenceWindowCount;
  }
  expect(totalSourceTokens).toBe(sourceTokenCount * maxSearchHitCount);
  expect(totalTermLookups).toBe(maxDistinctTermCount * maxSearchHitCount);
  expect(totalRangeEmits).toBe(totalRangeWrites);
  expect(totalRangeVisits).toBeLessThanOrEqual(totalRangeWrites + totalWindows);
});
