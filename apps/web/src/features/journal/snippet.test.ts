import { expect, it } from 'bun:test';

import { journalSnippet, snippetLength } from './snippet.ts';

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
