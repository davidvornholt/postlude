import { expect, it } from 'bun:test';
import { is, SQL } from 'drizzle-orm';
import { getTableConfig, PgDialect } from 'drizzle-orm/pg-core';

import { entry } from './schema.ts';

const dialect = new PgDialect();

/**
 * Renders a check predicate or column default the way Postgres will receive it,
 * so a test can pin what a constraint actually refuses rather than only its
 * name. A non-SQL value renders as a readable marker instead of throwing, which
 * keeps the failure message useful.
 */
const renderSql = (value: unknown): string =>
  is(value, SQL)
    ? dialect.sqlToQuery(value).sql.replace(/\s+/gu, ' ').trim()
    : `not sql: ${String(value)}`;

it('entry keys by calendar date, not by a surrogate id', () => {
  const config = getTableConfig(entry);
  expect(config.name).toBe('entry');
  const primaryColumns = config.columns.filter((column) => column.primary);
  expect(primaryColumns.map((column) => column.name)).toEqual(['entry_date']);
});

it('both sections carry a persisted word count for the heatmap', () => {
  const config = getTableConfig(entry);
  const wordCountColumns = config.columns.filter((column) =>
    column.name.endsWith('_word_count'),
  );
  const names = wordCountColumns.map((column) => column.name);
  expect(names).toHaveLength(2);
  expect(names).toContain('journal_word_count');
  expect(names).toContain('scripture_word_count');
  for (const column of wordCountColumns) {
    expect(column.notNull).toBe(true);
    expect(column.hasDefault).toBe(true);
  }
});

it('each section carries an independent nullable first-use stamp', () => {
  const config = getTableConfig(entry);
  const firstUseColumns = config.columns.filter((column) =>
    column.name.endsWith('_first_used_at'),
  );
  expect(
    firstUseColumns
      .map((column) => column.name)
      .toSorted((left, right) => left.localeCompare(right)),
  ).toEqual(['journal_first_used_at', 'scripture_first_used_at']);
  for (const column of firstUseColumns) {
    expect(column.notNull).toBe(false);
    expect(column.hasDefault).toBe(false);
  }
});

it('stamps updated_at from the database clock on every write, not just on insert', () => {
  const config = getTableConfig(entry);
  const updatedAt = config.columns.find(
    (column) => column.name === 'updated_at',
  );
  const createdAt = config.columns.find(
    (column) => column.name === 'created_at',
  );
  expect(renderSql(updatedAt?.onUpdateFn?.())).toBe('now()');
  expect(createdAt?.onUpdateFn).toBeUndefined();
});

/** Constraint name paired with the predicate Postgres will enforce. */
const expectedChecks: ReadonlyArray<readonly [string, string]> = [
  [
    'entry_journal_word_count_non_negative',
    '"entry"."journal_word_count" >= 0',
  ],
  [
    'entry_scripture_word_count_non_negative',
    '"entry"."scripture_word_count" >= 0',
  ],
  // A book and a chapter travel together; the verse is genuinely optional,
  // because "Psalms 23" is a whole chapter and a reference a writer will type.
  [
    'entry_scripture_reference_complete',
    'num_nonnulls("entry"."scripture_book", "entry"."scripture_chapter") in (0, 2)',
  ],
  [
    'entry_scripture_verse_start_needs_chapter',
    '"entry"."scripture_verse_start" is null or "entry"."scripture_chapter" is not null',
  ],
  [
    'entry_scripture_verse_end_after_start',
    '"entry"."scripture_verse_end" is null or ("entry"."scripture_verse_start" is not null and "entry"."scripture_verse_end" >= "entry"."scripture_verse_start")',
  ],
  [
    'entry_scripture_chapter_positive',
    '"entry"."scripture_chapter" is null or "entry"."scripture_chapter" >= 1',
  ],
  [
    'entry_scripture_verse_start_positive',
    '"entry"."scripture_verse_start" is null or "entry"."scripture_verse_start" >= 1',
  ],
  // Requires a letter rather than a non-`[:space:]` character: Postgres does
  // not count a non-breaking space, a zero-width space, or a soft hyphen as
  // `[:space:]`, so a whitespace-only test accepts a book that renders blank.
  [
    'entry_scripture_book_not_blank',
    `"entry"."scripture_book" is null or "entry"."scripture_book" ~ '[[:alpha:]]'`,
  ],
];

it('the database rejects incoherent word counts and scripture references', () => {
  const config = getTableConfig(entry);
  const actual = config.checks.map(
    (constraint) => [constraint.name, renderSql(constraint.value)] as const,
  );
  const byName = (a: readonly [string, string], b: readonly [string, string]) =>
    a[0].localeCompare(b[0]);
  expect(actual.toSorted(byName)).toEqual([...expectedChecks].toSorted(byName));
});
