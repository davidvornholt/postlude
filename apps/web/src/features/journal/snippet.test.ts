import { expect, it } from 'bun:test';

import { journalSnippet, snippetLength } from './snippet.ts';

const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const visibleLength = (text: string): number =>
  Array.from(graphemes.segment(text)).length;

it('shows a short entry whole, with no ellipsis to suggest more', () => {
  expect(journalSnippet('Slept badly, wrote anyway.')).toBe(
    'Slept badly, wrote anyway.',
  );
});

/* The opening of an entry is prose, not the markdown that carries it. */
it('shows the words rather than the marks around them', () => {
  expect(journalSnippet('## The desk\n\nMoved it *under* the window.')).toBe(
    'The desk Moved it under the window.',
  );
});

it('cuts on a word boundary and says that it cut', () => {
  const long = `${'word '.repeat(60)}end`;
  const snippet = journalSnippet(long);
  expect(snippet.endsWith('…')).toBe(true);
  expect(snippet).not.toContain('wor…');
});

it('keeps the whole of an entry that is exactly long enough', () => {
  const exactly = 'a'.repeat(snippetLength);
  expect(journalSnippet(exactly)).toBe(exactly);
});

it('hard-cuts one long token within the visible length contract', () => {
  const snippet = journalSnippet('a'.repeat(snippetLength + 1));

  expect(snippet).toBe(`${'a'.repeat(snippetLength - 1)}…`);
  expect(visibleLength(snippet)).toBe(snippetLength);
});

it('keeps an emoji grapheme whole at the cut', () => {
  const family = '👨‍👩‍👧‍👦';
  const snippet = journalSnippet(
    `${'a'.repeat(snippetLength - 2)}${family}tail`,
  );

  expect(snippet).toBe(`${'a'.repeat(snippetLength - 2)}${family}…`);
  expect(visibleLength(snippet)).toBe(snippetLength);
});

it('hard-cuts prose that has no spaces', () => {
  const noSpaces = '日'.repeat(snippetLength + 1);
  const snippet = journalSnippet(noSpaces);

  expect(snippet).toBe(`${'日'.repeat(snippetLength - 1)}…`);
  expect(visibleLength(snippet)).toBe(snippetLength);
});
