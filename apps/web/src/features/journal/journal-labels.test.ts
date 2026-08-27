import { expect, it } from 'bun:test';

import { journalCountLabel, journalNumberLabel } from './journal-labels.ts';

const thousand = 1000;
const million = 1_000_000;

it('groups journal quantities in the fixed American convention', () => {
  expect(journalNumberLabel(thousand)).toBe('1,000');
  expect(journalNumberLabel(million)).toBe('1,000,000');
});

it('keeps singular and plural count labels together', () => {
  expect(journalCountLabel(1, 'word')).toBe('1 word');
  expect(journalCountLabel(thousand, 'word')).toBe('1,000 words');
});
