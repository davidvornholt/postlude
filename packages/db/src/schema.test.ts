import { expect, it } from 'bun:test';
import { getTableConfig } from 'drizzle-orm/pg-core';

import { entry } from './schema.ts';

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

it('stamps updated_at on every write, not just on insert', () => {
  const config = getTableConfig(entry);
  const updatedAt = config.columns.find(
    (column) => column.name === 'updated_at',
  );
  const createdAt = config.columns.find(
    (column) => column.name === 'created_at',
  );
  expect(updatedAt?.onUpdateFn?.()).toBeInstanceOf(Date);
  expect(createdAt?.onUpdateFn).toBeUndefined();
});

const expectedChecks: ReadonlyArray<string> = [
  'entry_journal_word_count_non_negative',
  'entry_scripture_word_count_non_negative',
  'entry_scripture_reference_complete',
  'entry_scripture_verse_end_after_start',
  'entry_scripture_chapter_positive',
  'entry_scripture_verse_start_positive',
  'entry_scripture_verse_end_positive',
];

it('the database rejects incoherent word counts and scripture references', () => {
  const config = getTableConfig(entry);
  const names = config.checks.map((constraint) => constraint.name);
  const byName = (a: string, b: string) => a.localeCompare(b);
  expect(names.toSorted(byName)).toEqual([...expectedChecks].toSorted(byName));
});
