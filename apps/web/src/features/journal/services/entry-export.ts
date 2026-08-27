/** A bounded, ordered read of every currently meaningful journal day. */

import { SqlClient } from '@effect/sql';
import { Effect, Either } from 'effect';

import { journalReadError } from '../errors/journal-errors.ts';
import type { ExportVisitor } from './entry-export-contract.ts';
import { makeEntryExportPages } from './entry-export-pages.ts';
import { runExportVisitor } from './entry-export-visitor.ts';
import { inRepeatableReadSnapshot } from './read-snapshot.ts';

export type { ExportEntry } from '../export-format.ts';
export type {
  ExportPass,
  ExportPeriodPass,
  ExportVisitor,
} from './entry-export-contract.ts';
export type { ExportSnapshot } from './entry-export-pages.ts';

export const exportPageSize = 32;

export class EntryExport extends Effect.Service<EntryExport>()(
  'journal/EntryExport',
  {
    effect: Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      const pages = makeEntryExportPages(sql);
      const visit = <E, R>(
        visitor: ExportVisitor<E, R>,
        pageSize = exportPageSize,
      ): Effect.Effect<void, E | ReturnType<typeof journalReadError>, R> =>
        inRepeatableReadSnapshot(
          sql,
          runExportVisitor(pages, visitor, pageSize).pipe(Effect.either),
        ).pipe(
          Effect.mapError(journalReadError),
          Effect.flatMap((result) =>
            Either.isLeft(result)
              ? Effect.fail(result.left)
              : Effect.succeed(result.right),
          ),
        );
      return { visit } as const;
    }),
  },
) {}
