import type { createPool } from '@postlude/db/pool';
import { Schema } from 'effect';
import { storedSearchEvidence } from '../search-stored-evidence.ts';
import { replaceSearchEvidenceWithClient } from './search-evidence-write.ts';

type MigrationPool = ReturnType<typeof createPool>;
const batchSize = 100;
const decodeRows = Schema.decodeUnknownSync(
  Schema.Array(
    Schema.Struct({
      date: Schema.String,
      revision: Schema.Number,
      journalText: Schema.String,
      scriptureText: Schema.String,
      scriptureReferenceText: Schema.String,
    }),
  ),
);

const backfillBatch = async (pool: MigrationPool): Promise<number> => {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const result = await client.query(
      `
      select entry_date as date, revision, journal_search_text as "journalText",
        scripture_search_text as "scriptureText", scripture_reference_search_text as "scriptureReferenceText"
      from entry where search_evidence_revision is distinct from revision
      order by entry_date limit $1 for update
    `,
      [batchSize],
    );
    const rows = decodeRows(result.rows);
    const updateRows = async (index: number): Promise<void> => {
      const row = rows[index];
      if (!row) {
        return;
      }
      const evidence = storedSearchEvidence(row);
      await replaceSearchEvidenceWithClient(client, row.date, evidence);
      await client.query(
        'update entry set search_evidence_revision = revision where entry_date = $1 and revision = $2',
        [row.date, row.revision],
      );
      await updateRows(index + 1);
    };
    await updateRows(0);
    await client.query('commit');
    return rows.length;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
};

/** Ordered row locks and bounded transactions prevent evidence from racing an entry save. */
export const backfillSearchEvidence = async (
  pool: MigrationPool,
): Promise<void> => {
  const count = await backfillBatch(pool);
  if (count === batchSize) {
    await backfillSearchEvidence(pool);
  }
};
