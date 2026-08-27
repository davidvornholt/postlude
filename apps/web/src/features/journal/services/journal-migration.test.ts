import { expect, it } from 'bun:test';
import {
  migrateGeneratedThrough,
  searchProjectionColumnsMigrationTag,
} from '@postlude/db/migrate';
import { createPool } from '@postlude/db/pool';
import { Effect } from 'effect';
import { configuredDatabaseUrl } from '#/shared/testing/test-database.ts';
import { searchHitOf } from '../search-contract.ts';
import { searchTerms, searchTsQuery } from '../search-query.ts';
import {
  migrateJournalDatabase,
  searchBackfillBatchSize,
} from './journal-migration.ts';

const beforeSearchMigration = '0003_motionless_gauntlet';
const expectedMigrationCount = 6;
const chapter = 12;
const verseStart = 5;
const verseEnd = 13;

type MigrationPool = ReturnType<typeof createPool>;

const withTemporaryDatabase = async (
  body: (pool: MigrationPool) => Promise<void>,
): Promise<void> => {
  const configured = await Effect.runPromise(configuredDatabaseUrl());
  const databaseName = `postlude_search_migration_${crypto.randomUUID().replaceAll('-', '')}`;
  const databaseUrl = new URL(configured);
  databaseUrl.pathname = `/${databaseName}`;
  const admin = createPool(configured);
  const migrationPool = createPool(databaseUrl.toString());
  await admin.query(`create database "${databaseName}"`);
  try {
    await body(migrationPool);
  } finally {
    await migrationPool.end();
    await admin.query(`drop database "${databaseName}" with (force)`);
    await admin.end();
  }
};

const readOldWriterProjection = async (
  pool: MigrationPool,
): Promise<
  | {
      readonly journalMarkdown: string;
      readonly journalText: string;
      readonly revision: number;
      readonly searchProjectionRevision: number;
    }
  | undefined
> => {
  const rewritten = await pool.query<{
    readonly journalMarkdown: string;
    readonly journalText: string;
    readonly revision: number;
    readonly searchProjectionRevision: number;
  }>(`
    select
      journal_markdown as "journalMarkdown",
      journal_search_text as "journalText",
      revision,
      search_projection_revision as "searchProjectionRevision"
    from entry
    where entry_date = date '1900-01-01'
  `);
  return rewritten.rows[0];
};

it('backfills existing visible search documents before hardening the schema', async () => {
  // This upgrade cannot roll back across migration commits. It gets its own
  // disposable database and removes it, so the shared test database stays clean.
  await withTemporaryDatabase(async (upgrade) => {
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
    await upgrade.query(
      `insert into entry (entry_date, journal_markdown)
       select date '1900-01-01' + day_offset, 'Batch row ' || day_offset
       from generate_series(0, $1::integer - 1) as series(day_offset)`,
      [searchBackfillBatchSize],
    );
    await Effect.runPromise(
      migrateGeneratedThrough(upgrade, searchProjectionColumnsMigrationTag),
    );
    await upgrade.query(`
      create table search_backfill_audit (
        entry_date date not null,
        transaction_id bigint not null
      );
      create function audit_search_backfill() returns trigger
      language plpgsql as $$
      begin
        insert into search_backfill_audit (entry_date, transaction_id)
        values (new.entry_date, txid_current());
        if new.entry_date = date '1900-04-10' then
          update entry
          set journal_markdown = 'Changed by the old writer.',
              journal_word_count = 5,
              journal_first_used_at = coalesce(journal_first_used_at, now()),
              scripture_markdown = '',
              scripture_word_count = 0,
              scripture_first_used_at = scripture_first_used_at,
              scripture_book = null,
              scripture_chapter = null,
              scripture_verse_start = null,
              scripture_verse_end = null,
              revision = revision + 1,
              updated_at = now()
          where entry_date = date '1900-01-01'
            and revision = 1;
        end if;
        return new;
      end
      $$;
      create trigger audit_search_backfill
      after update of search_projection_revision on entry
      for each row execute function audit_search_backfill();
    `);

    await Effect.runPromise(migrateJournalDatabase(upgrade));

    const terms = searchTerms('sprüche');
    const result = await upgrade.query(
      `select
         entry_date as date,
       journal_search_text as "journalText",
       scripture_search_text as "scriptureText",
       scripture_reference_search_text as "scriptureReferenceText",
         journal_word_count + scripture_word_count as words,
         revision,
         search_projection_revision as "searchProjectionRevision"
       from entry
       where search_vector @@ $1::tsquery`,
      [searchTsQuery(terms)],
    );
    const [match] = result.rows;
    expect(match.journalText).toBe('Visible evening\nhidden-code');
    expect(match.journalText).not.toContain('hidden-target');
    expect(match.scriptureText).toBe(
      'Spru\u0308che in visible morning. hidden image',
    );
    expect(match.scriptureReferenceText).toContain('Sprüche 12:5-13');
    expect(match.scriptureReferenceText).toContain('Sprueche 12:5-13');
    expect(match.revision).toBe(1);
    expect(match.searchProjectionRevision).toBe(match.revision);
    const hit = searchHitOf(terms)(match);
    expect(hit.sources.map(({ kind }) => kind)).toEqual([
      'scripture-notes',
      'passage-reference',
    ]);
    for (const source of hit.sources) {
      expect(
        source.excerpts.some((excerpt) =>
          excerpt.some((segment) => segment.match),
        ),
      ).toBe(true);
    }

    const completeness = await upgrade.query<{
      readonly incomplete: number;
      readonly projected: number;
    }>(`
      select
        count(*) filter (
          where journal_search_text is null
             or scripture_search_text is null
             or scripture_reference_search_text is null
             or search_token_text is null
             or search_projection_revision is null
             or search_projection_revision <> revision
        )::integer as incomplete,
        count(*)::integer as projected
      from entry
    `);
    expect(completeness.rows[0]).toEqual({
      incomplete: 0,
      projected: searchBackfillBatchSize + 1,
    });
    expect(await readOldWriterProjection(upgrade)).toEqual({
      journalMarkdown: 'Changed by the old writer.',
      journalText: 'Changed by the old writer.',
      revision: 2,
      searchProjectionRevision: 2,
    });
    const batches = await upgrade.query<{
      readonly largest: number;
      readonly transactions: number;
    }>(`
      select
        max(rows_in_transaction)::integer as largest,
        count(*)::integer as transactions
      from (
        select transaction_id, count(*) as rows_in_transaction
        from search_backfill_audit
        group by transaction_id
      ) batches
    `);
    expect(batches.rows[0]).toEqual({
      largest: searchBackfillBatchSize,
      transactions: 2,
    });

    const auditedBeforeRerun = await upgrade.query<{ readonly count: number }>(
      'select count(*)::integer as count from search_backfill_audit',
    );
    await Effect.runPromise(migrateJournalDatabase(upgrade));
    const auditedAfterRerun = await upgrade.query<{ readonly count: number }>(
      'select count(*)::integer as count from search_backfill_audit',
    );
    expect(auditedAfterRerun.rows).toEqual(auditedBeforeRerun.rows);

    const oldWriterFailure = await upgrade
      .query(`
        update entry
        set journal_markdown = 'Written by the old app',
            revision = revision + 1,
            updated_at = now()
        where entry_date = '2026-03-01'
          and revision = 1
      `)
      .catch((error: unknown) => error);
    expect(oldWriterFailure).toMatchObject({
      code: '23514',
      constraint: 'entry_search_projection_current',
    });
    const retained = await upgrade.query<{
      readonly journalMarkdown: string;
      readonly revision: number;
      readonly searchProjectionRevision: number;
    }>(`
      select
        journal_markdown as "journalMarkdown",
        revision,
        search_projection_revision as "searchProjectionRevision"
      from entry
      where entry_date = '2026-03-01'
    `);
    expect(retained.rows[0]).toEqual({
      journalMarkdown:
        '[Visible evening](hidden-target)\n```\nhidden-code\n```',
      revision: 1,
      searchProjectionRevision: 1,
    });
  });
});

it('migrates a fresh database once and remains idempotent', async () => {
  await withTemporaryDatabase(async (migrationPool) => {
    await Effect.runPromise(migrateJournalDatabase(migrationPool));
    await Effect.runPromise(migrateJournalDatabase(migrationPool));
    const migrations = await migrationPool.query<{ readonly count: number }>(
      'select count(*)::integer as count from drizzle.__drizzle_migrations',
    );
    expect(migrations.rows[0]?.count).toBe(expectedMigrationCount);
  });
});
