import type { SqlClient } from '@effect/sql';
import { Effect } from 'effect';
import type { StoredSearchEvidence } from '../search-stored-evidence.ts';

/** Runs inside the same transaction as its entry update or migration batch. */
export const replaceSearchEvidence = (
  sql: SqlClient.SqlClient,
  date: string,
  evidence: ReadonlyArray<StoredSearchEvidence>,
) =>
  Effect.gen(function* () {
    yield* sql`delete from entry_search_evidence where entry_date = ${date}::date`;
    yield* sql`
    insert into entry_search_evidence (entry_date, kind, token, position, excerpt, match_start, match_length, anchor_length)
    select ${date}::date, kind, token, position, excerpt, "matchStart", "matchLength", "anchorLength"
    from jsonb_to_recordset(${JSON.stringify(evidence)}::jsonb)
      as evidence(kind text, token text, position integer, excerpt text, "matchStart" integer, "matchLength" integer, "anchorLength" integer)
  `;
  });

export const replaceSearchEvidenceWithClient = async (
  client: {
    readonly query: (text: string, values: Array<unknown>) => Promise<unknown>;
  },
  date: string,
  evidence: ReadonlyArray<StoredSearchEvidence>,
): Promise<void> => {
  await client.query(
    'delete from entry_search_evidence where entry_date = $1',
    [date],
  );
  await client.query(
    `
    insert into entry_search_evidence (entry_date, kind, token, position, excerpt, match_start, match_length, anchor_length)
    select $1::date, kind, token, position, excerpt, "matchStart", "matchLength", "anchorLength"
    from jsonb_to_recordset($2::jsonb)
      as evidence(kind text, token text, position integer, excerpt text, "matchStart" integer, "matchLength" integer, "anchorLength" integer)
  `,
    [date, JSON.stringify(evidence)],
  );
};
