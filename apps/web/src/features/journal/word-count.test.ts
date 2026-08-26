import { describe, expect, it } from 'bun:test';

import {
  countJournalCharacters,
  countJournalWords,
  journalPlainText,
} from './word-count.ts';

/**
 * The cases are tables rather than a run of assertions because what each one
 * claims is the same claim about a different piece of syntax, and a table shows
 * the syntax next to the number it should not change.
 */
type WordCase = { readonly markdown: string; readonly words: number };
type CharacterCase = {
  readonly markdown: string;
  readonly characters: number;
};

describe('countJournalWords', () => {
  it('counts prose and nothing else', () => {
    const cases: ReadonlyArray<WordCase> = [
      { markdown: '', words: 0 },
      { markdown: '   \n\n  ', words: 0 },
      { markdown: 'One two three', words: 3 },
      { markdown: 'One  two\n\nthree\tfour', words: 4 },
    ];
    for (const { markdown, words } of cases) {
      expect(countJournalWords(markdown)).toBe(words);
    }
  });

  it('does not count the markdown that carries the words', () => {
    // Each of these is three words of prose wearing different syntax.
    const cases: ReadonlyArray<WordCase> = [
      { markdown: '## A quiet morning', words: 3 },
      { markdown: '> A quiet morning', words: 3 },
      { markdown: '- A quiet morning', words: 3 },
      { markdown: '1. A quiet morning', words: 3 },
      { markdown: '**A** *quiet* ~~morning~~', words: 3 },
      { markdown: 'A quiet morning\n===', words: 3 },
      { markdown: 'A quiet morning\n\n---\n', words: 3 },
    ];
    for (const { markdown, words } of cases) {
      expect(countJournalWords(markdown)).toBe(words);
    }
  });

  it('keeps the label of a link and drops its target', () => {
    const cases: ReadonlyArray<WordCase> = [
      { markdown: '[A quiet morning](https://example.com/a/b)', words: 3 },
      { markdown: '[A quiet morning][ref]', words: 3 },
      { markdown: 'Read <https://example.com>', words: 2 },
      { markdown: '[ref]: https://example.com "Title"', words: 0 },
    ];
    for (const { markdown, words } of cases) {
      expect(countJournalWords(markdown)).toBe(words);
    }
  });

  it('drops an image whole, alt text included', () => {
    // Alt text describes a picture; it is not prose the writer wrote.
    const cases: ReadonlyArray<WordCase> = [
      { markdown: '![A quiet morning](/img/a.png)', words: 0 },
      { markdown: 'Before ![alt](/a.png) after', words: 2 },
    ];
    for (const { markdown, words } of cases) {
      expect(countJournalWords(markdown)).toBe(words);
    }
  });

  it('drops a code block and keeps inline code, which is part of the sentence', () => {
    const cases: ReadonlyArray<WordCase> = [
      { markdown: 'Ran `bun run check` today', words: 5 },
      { markdown: 'Before\n\n```ts\nconst a = 1;\n```\n\nafter', words: 2 },
      { markdown: 'Before\n\n~~~\nliteral text\n~~~\n\nafter', words: 2 },
    ];
    for (const { markdown, words } of cases) {
      expect(countJournalWords(markdown)).toBe(words);
    }
  });

  /*
   * The moment between typing an opening fence and its closing one. If the
   * unclosed block counted, the number under the writer's hands would leap as
   * the code was pasted and fall back when the fence was finished.
   */
  it('holds the count still while a fence is still open', () => {
    const openFence = 'Before\n\n```\nconst a = 1;\nmore lines';
    const beforeOnly = 1;
    expect(countJournalWords(openFence)).toBe(beforeOnly);
  });

  it('does not mistake trailing text for a closing fence', () => {
    const openFence = [
      'Before',
      '',
      '```',
      'const a = 1;',
      '``` not a closer',
      'more code',
    ].join('\n');

    expect(countJournalWords(openFence)).toBe(1);
  });

  it('does not mistake an over-indented fence for a closing fence', () => {
    const openFence = [
      'Before',
      '',
      '```',
      'const a = 1;',
      '    ```',
      'more code',
    ].join('\n');

    expect(countJournalWords(openFence)).toBe(1);
  });

  it('accepts a closing fence longer than its opener', () => {
    const closedFence = [
      'Before',
      '',
      '```',
      'const a = 1;',
      '````',
      '',
      'after',
    ].join('\n');

    expect(countJournalWords(closedFence)).toBe(2);
  });

  it('counts an escaped marker as the character it stands for', () => {
    const escapedStars = 3;
    expect(countJournalWords('A \\*quiet\\* morning')).toBe(escapedStars);
    expect(journalPlainText('5 \\* 3')).toBe('5 * 3');
  });

  it('counts the cells of a table and not its rules', () => {
    const table = '| Day | Words |\n| --- | --- |\n| Monday | 200 |';
    const cellWords = 6;
    expect(countJournalWords(table)).toBe(cellWords);
  });

  it('counts an entry the way a writer would read it', () => {
    const entry = [
      '## Evening',
      '',
      'The light went **long** across the yard, and I sat with it.',
      '',
      '- Read [Proverbs](https://www.bibleserver.com/NeÜ/Sprüche12)',
      '- Called Mum',
    ].join('\n');
    // Evening(1) + 12 + Read Proverbs(2) + Called Mum(2)
    const readAloud = 17;
    expect(countJournalWords(entry)).toBe(readAloud);
  });
});

describe('countJournalCharacters', () => {
  it('counts what the reader sees, not what the file holds', () => {
    const cases: ReadonlyArray<CharacterCase> = [
      { markdown: '', characters: 0 },
      { markdown: '**abc**', characters: 3 },
      { markdown: '## Hi', characters: 2 },
    ];
    for (const { markdown, characters } of cases) {
      expect(countJournalCharacters(markdown)).toBe(characters);
    }
  });

  it('counts one character for a letter the string calls two', () => {
    // A decomposed "é" is two code units and one character to a reader.
    const decomposed = 'é';
    expect(countJournalCharacters(decomposed)).toBe(1);
    expect(decomposed.length).toBe(2);
  });

  it('counts one character for an emoji built from several', () => {
    // A family emoji is one glyph; its string length is far more.
    const family = '👩‍👩‍👧';
    expect(countJournalCharacters(family)).toBe(1);
    expect(family.length).toBeGreaterThan(1);
  });
});
