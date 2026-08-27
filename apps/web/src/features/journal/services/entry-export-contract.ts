/** Consumer contract for streaming one journal export snapshot. */

import type { Effect } from 'effect';

import type { ExportEntry } from '../export-format.ts';
import type { ExportPeriodMetadata } from '../export-markdown.ts';
import type { ExportGrouping } from '../export-period.ts';
import type { ExportSnapshot } from './entry-export-pages.ts';

export type ExportPass<E, R> = {
  readonly before: Effect.Effect<void, E, R>;
  readonly onEntry: (entry: ExportEntry) => Effect.Effect<void, E, R>;
  readonly after: Effect.Effect<void, E, R>;
};

export type ExportPeriodPass<E, R> = {
  readonly grouping: Exclude<ExportGrouping, 'day'>;
  readonly before: Effect.Effect<void, E, R>;
  readonly onPeriodStart: (
    period: ExportPeriodMetadata,
  ) => Effect.Effect<void, E, R>;
  readonly onEntry: (entry: ExportEntry) => Effect.Effect<void, E, R>;
  readonly onPeriodEnd: Effect.Effect<void, E, R>;
  readonly after: Effect.Effect<void, E, R>;
};

export type ExportVisitor<E, R> = {
  readonly onSnapshot: (snapshot: ExportSnapshot) => Effect.Effect<void, E, R>;
  readonly onCount: (count: number) => Effect.Effect<void, E, R>;
  readonly passes: ReadonlyArray<ExportPass<E, R>>;
  readonly periodPass?: ExportPeriodPass<E, R>;
};
