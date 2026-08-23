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

it('the scripture reference is structured, never parsed from markdown', () => {
  const config = getTableConfig(entry);
  const names = config.columns.map((column) => column.name);
  expect(names).toContain('scripture_book');
  expect(names).toContain('scripture_chapter');
  expect(names).toContain('scripture_verse_start');
  expect(names).toContain('scripture_verse_end');
});
