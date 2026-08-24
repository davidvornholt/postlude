import { describe, expect, it } from 'bun:test';

import {
  countCharacters,
  countWords,
  groupDigits,
  journalText,
  sampleDay,
  scriptureHref,
  scriptureReference,
} from './content.ts';

const wordsInSpacedText = 4;
const codePointsInOneAstralCharacter = 1;
const utf16UnitsInOneAstralCharacter = 2;
const underOneThousand = 999;
const justOverOneThousand = 1065;
const overOneMillion = 1_234_567;

describe('countWords', () => {
  it('counts runs of non-whitespace, however they are spaced', () => {
    expect(countWords('  two   words\nover\tlines  ')).toBe(wordsInSpacedText);
  });

  it('counts nothing in an empty or blank document', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('   \n  ')).toBe(0);
  });
});

describe('countCharacters', () => {
  it('counts code points, not the UTF-16 units a string is stored in', () => {
    const candle = '\u{1F56F}';
    expect(candle).toHaveLength(utf16UnitsInOneAstralCharacter);
    expect(countCharacters(candle)).toBe(codePointsInOneAstralCharacter);
  });
});

describe('groupDigits', () => {
  it('separates thousands and leaves shorter counts alone', () => {
    expect(groupDigits(0)).toBe('0');
    expect(groupDigits(underOneThousand)).toBe('999');
    expect(groupDigits(justOverOneThousand)).toBe('1,065');
    expect(groupDigits(overOneMillion)).toBe('1,234,567');
  });
});

it('reads a passage reference the way it is spoken', () => {
  expect(scriptureReference(sampleDay.scripture)).toBe('Proverbs 12:5-13');
});

it('links the structured passage reference to its exact verse range', () => {
  expect(sampleDay.scripture.href).toBe(scriptureHref(sampleDay.scripture));
  expect(sampleDay.scripture.href).toBe(
    'https://www.bibleserver.com/NeÜ/Proverbs12,5-13',
  );
});

it('holds the sample day as one document the counts can run over', () => {
  // The counts the page shows are taken from this text, so the join has to
  // keep every paragraph and add nothing that reads as a word.
  for (const paragraph of sampleDay.journalParagraphs) {
    expect(journalText).toContain(paragraph);
  }
  expect(countWords(journalText)).toBe(
    sampleDay.journalParagraphs.reduce(
      (total, paragraph) => total + countWords(paragraph),
      0,
    ),
  );
});
