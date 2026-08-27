import { Schema } from 'effect';

const firstArchiveYear = 1;
export const lastArchiveYear = 9998;

/**
 * What the archive can be asked for: a year, or nothing.
 *
 * A named year includes the Sunday-to-Saturday weeks at its boundaries where
 * the journal can represent them. The first year starts at 0001-01-01 because
 * the preceding Sunday is outside the Common Era date contract. Year 9999
 * would end in year 10000, so it remains outside the named-year range. The
 * route and server function both decode with this schema.
 */
export const ArchiveQuery = Schema.Struct({
  year: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.between(firstArchiveYear, lastArchiveYear),
    ),
  ),
});

export type ArchiveQueryParams = Schema.Schema.Type<typeof ArchiveQuery>;

export const decodeArchiveQuery = Schema.decodeUnknownSync(ArchiveQuery);
