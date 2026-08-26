import { Schema } from 'effect';

const firstArchiveYear = 1000;
export const lastArchiveYear = 9998;

/**
 * What the archive can be asked for: a year, or nothing.
 *
 * A named year includes the whole Sunday-to-Saturday weeks at its boundaries.
 * Year 9999 would therefore end in year 10000, outside the journal's four-digit
 * date contract. The route and server function both decode with this schema.
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
