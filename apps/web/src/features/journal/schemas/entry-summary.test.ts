import { expect, it } from 'bun:test';
import { Either, Schema } from 'effect';
import { EntrySummaryFromRow } from './entry-summary.ts';

const summary = Object.fromEntries([
  ['entry_date', '2026-09-25'],
  ['journal_word_count', 0],
  ['journal_first_used_at', null],
  ['scripture_word_count', 1],
  ['scripture_first_used_at', null],
  ['has_scripture_reference', false],
]);
const fractionalCount = 1.5;
const decode = Schema.decodeUnknownEither(EntrySummaryFromRow);

it('accepts zero and positive whole word counts', () => {
  expect(Either.isRight(decode(summary))).toBe(true);
});

for (const field of ['journal_word_count', 'scripture_word_count']) {
  it.each([
    -1,
    fractionalCount,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ])(`rejects an impossible ${field}: %s`, (count) => {
    expect(Either.isLeft(decode({ ...summary, [field]: count }))).toBe(true);
  });
}
