import { expect, it } from 'bun:test';

import { asOneLine } from './one-line.ts';

it('turns each line break and the spaces around it into one space', () => {
  expect(asOneLine('The Sermon\non the Mount')).toBe('The Sermon on the Mount');
  expect(asOneLine('Grace \r\n\r\n  and truth')).toBe('Grace and truth');
  expect(asOneLine('Light\u2028and\u2029salt')).toBe('Light and salt');
});

it('leaves a line without a break as it was', () => {
  expect(asOneLine('  Psalms 23  ')).toBe('  Psalms 23  ');
  expect(asOneLine('A\ttab')).toBe('A\ttab');
});
