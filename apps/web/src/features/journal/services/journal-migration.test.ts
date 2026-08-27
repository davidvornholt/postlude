import { expect, it } from 'bun:test';
import { migrateGeneratedThrough } from '@postlude/db/migrate';
import { createPool } from '@postlude/db/pool';
import { Effect } from 'effect';
import { configuredDatabaseUrl } from '#/shared/testing/test-database.ts';
import { searchHitOf } from '../search-contract.ts';
import { searchTerms, searchTsQuery } from '../search-query.ts';
import { migrateJournalDatabase } from './journal-migration.ts';

const beforeSearchMigration = '0002_independent_section_first_use';
const chapter = 12;
const verseStart = 5;
const verseEnd = 13;

it('backfills existing visible search documents before hardening the schema', async () => {
  // This upgrade cannot roll back across migration commits. It gets its own
  // disposable database and removes it, so the shared test database stays clean.
  const configured = await Effect.runPromise(configuredDatabaseUrl());
  const databaseName = 'postlude_search_upgrade_test';
  const databaseUrl = new URL(configured);
  databaseUrl.pathname = `/${databaseName}`;
  const admin = createPool(configured);
  const upgrade = createPool(databaseUrl.toString());
  await admin.query(`drop database if exists "${databaseName}" with (force)`);
  await admin.query(`create database "${databaseName}"`);
  try {
    await Effect.runPromise(
      migrateGeneratedThrough(upgrade, beforeSearchMigration),
    );
    await upgrade.query(
      `insert into entry (
         entry_date,
         journal_markdown,
         scripture_markdown,
         scripture_book,
         scripture_chapter,
         scripture_verse_start,
         scripture_verse_end
       ) values ($1, $2, $3, $4, $5, $6, $7)`,
      [
        '2026-03-01',
        '[Visible evening](hidden-target)\n```\nhidden-code\n```',
        'Spru\u0308che in visible morning. ![hidden image](hidden-file)',
        'Proverbs',
        chapter,
        verseStart,
        verseEnd,
      ],
    );

    await Effect.runPromise(migrateJournalDatabase(upgrade));

    const terms = searchTerms('sprüche');
    const result = await upgrade.query(
      `select
         entry_date as date,
         journal_search_text as "journalText",
         scripture_search_text as "scriptureText",
         scripture_reference_search_text as "scriptureReferenceText",
         journal_word_count + scripture_word_count as words
       from entry
       where search_vector @@ to_tsquery('simple', $1)`,
      [searchTsQuery(terms)],
    );
    const [match] = result.rows;
    expect(match.journalText).toBe('Visible evening');
    expect(match.journalText).not.toContain('hidden');
    expect(match.scriptureText).toBe('Sprüche in visible morning.');
    expect(match.scriptureReferenceText).toContain('Sprüche 12:5-13');
    expect(match.scriptureReferenceText).toContain('Sprueche 12:5-13');
    const hit = searchHitOf(terms)(match);
    expect(hit.fromScripture).toBe(true);
    expect(hit.excerpt.some((segment) => segment.match)).toBe(true);
  } finally {
    await upgrade.end();
    await admin.query(`drop database if exists "${databaseName}" with (force)`);
    await admin.end();
  }
});
