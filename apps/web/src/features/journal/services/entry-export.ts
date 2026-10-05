/** A bounded, ordered read of every currently meaningful journal day. */

import { Context, Effect, Layer } from 'effect';
import { SqlClient } from 'effect/sql';

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

export class EntryExport extends Context.Service<EntryExport>()(
  'journal/EntryExport',
  {
    make: Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      const pages = makeEntryExportPages(sql);
      const visit = <E, R>(
        visitor: ExportVisitor<E, R>,
        pageSize = exportPageSize,
      ): Effect.Effect<void, E | ReturnType<typeof journalReadError>, R> =>
        inRepeatableReadSnapshot(
          sql,
          runExportVisitor(pages, visitor, pageSize).pipe(Effect.result),
        ).pipe(
          Effect.mapError(journalReadError),
          Effect.flatMap(Effect.fromResult),
        );
      return { visit } as const;
    }),
  },
) {
  static readonly layer = Layer.effect(EntryExport, EntryExport.make);
}
