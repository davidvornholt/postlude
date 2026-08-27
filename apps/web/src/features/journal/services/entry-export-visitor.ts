/** Bounded visitor traversal for one repeatable-read export snapshot. */

import { Effect } from 'effect';

import type { journalReadError } from '../errors/journal-errors.ts';
import type { ExportPeriodMetadata } from '../export-markdown.ts';
import { type ExportGrouping, periodKeyOf } from '../export-period.ts';
import type { JournalDate } from '../journal-day.ts';
import type {
  ExportPass,
  ExportPeriodPass,
  ExportVisitor,
} from './entry-export-contract.ts';
import type {
  ExportEntryPageOptions,
  makeEntryExportPages,
} from './entry-export-pages.ts';

type EntryExportPages = ReturnType<typeof makeEntryExportPages>;
type EntryRange = Pick<ExportEntryPageOptions, 'from' | 'to'>;
type EntryTraversal<E, R> = {
  readonly pages: EntryExportPages;
  readonly pass: ExportPass<E, R>;
  readonly pageSize: number;
  readonly range?: EntryRange;
  readonly after?: JournalDate;
};
type PeriodTraversal<E, R> = {
  readonly pages: EntryExportPages;
  readonly pass: ExportPeriodPass<E, R>;
  readonly pageSize: number;
  readonly open?: ExportPeriodMetadata;
  readonly after?: JournalDate;
};

const readEntryPages = <E, R>({
  pages,
  pass,
  pageSize,
  range,
  after,
}: EntryTraversal<E, R>): Effect.Effect<
  void,
  E | ReturnType<typeof journalReadError>,
  R
> =>
  pages
    .entries({
      ...(after === undefined ? {} : { after }),
      ...(range ?? {}),
      pageSize,
    })
    .pipe(
      Effect.flatMap((entries) =>
        Effect.forEach(entries, pass.onEntry, { discard: true }).pipe(
          Effect.flatMap(() => {
            const last = entries.at(-1);
            return last === undefined || entries.length < pageSize
              ? Effect.void
              : readEntryPages({
                  pages,
                  pass,
                  pageSize,
                  ...(range === undefined ? {} : { range }),
                  after: last.date,
                });
          }),
        ),
      ),
    );

const visitEntries = <E, R>(options: EntryTraversal<E, R>) =>
  options.pass.before.pipe(
    Effect.zipRight(readEntryPages(options)),
    Effect.zipRight(options.pass.after),
  );

const emitPeriod = <E, R>(
  { pages, pass, pageSize }: PeriodTraversal<E, R>,
  period: ExportPeriodMetadata,
) =>
  pass.onPeriodStart(period).pipe(
    Effect.zipRight(
      visitEntries({
        pages,
        pass: {
          before: Effect.void,
          onEntry: pass.onEntry,
          after: Effect.void,
        },
        pageSize,
        range: { from: period.from, to: period.to },
      }),
    ),
    Effect.zipRight(pass.onPeriodEnd),
  );

const advancePeriod = (
  grouping: Exclude<ExportGrouping, 'day'>,
  open: ExportPeriodMetadata | undefined,
  date: JournalDate,
) => {
  const key = periodKeyOf(grouping, date);
  return open?.key === key
    ? { open: { ...open, to: date, days: open.days + 1 } }
    : {
        completed: open,
        open: { key, from: date, to: date, days: 1 },
      };
};

const consumeDates = <E, R>(
  options: PeriodTraversal<E, R> & {
    readonly dates: ReadonlyArray<{ readonly date: JournalDate }>;
    readonly index?: number;
  },
): Effect.Effect<
  ExportPeriodMetadata | undefined,
  E | ReturnType<typeof journalReadError>,
  R
> => {
  const { pages, pass, pageSize, dates, open, index = 0 } = options;
  const row = dates[index];
  if (row === undefined) {
    return Effect.succeed(open);
  }
  const next = advancePeriod(pass.grouping, open, row.date);
  const flush =
    next.completed === undefined
      ? Effect.void
      : emitPeriod({ pages, pass, pageSize }, next.completed);
  return flush.pipe(
    Effect.flatMap(() =>
      consumeDates({
        pages,
        pass,
        pageSize,
        dates,
        open: next.open,
        index: index + 1,
      }),
    ),
  );
};

const finishOrContinue = <E, R>(
  options: PeriodTraversal<E, R>,
  dates: ReadonlyArray<{ readonly date: JournalDate }>,
  nextOpen: ExportPeriodMetadata | undefined,
) => {
  const last = dates.at(-1);
  if (last !== undefined && dates.length === options.pageSize) {
    return readPeriodPages({ ...options, open: nextOpen, after: last.date });
  }
  return nextOpen === undefined ? Effect.void : emitPeriod(options, nextOpen);
};

const readPeriodPages = <E, R>(
  options: PeriodTraversal<E, R>,
): Effect.Effect<void, E | ReturnType<typeof journalReadError>, R> =>
  options.pages
    .dates(options.after, options.pageSize)
    .pipe(
      Effect.flatMap((dates) =>
        consumeDates({ ...options, dates }).pipe(
          Effect.flatMap((nextOpen) =>
            finishOrContinue(options, dates, nextOpen),
          ),
        ),
      ),
    );

const visitPeriods = <E, R>(options: PeriodTraversal<E, R>) =>
  options.pass.before.pipe(
    Effect.zipRight(readPeriodPages(options)),
    Effect.zipRight(options.pass.after),
  );

export const runExportVisitor = <E, R>(
  pages: EntryExportPages,
  visitor: ExportVisitor<E, R>,
  pageSize: number,
) =>
  Effect.gen(function* () {
    yield* visitor.onSnapshot(yield* pages.snapshot());
    yield* visitor.onCount(yield* pages.count());
    yield* Effect.forEach(
      visitor.passes,
      (pass) => visitEntries({ pages, pass, pageSize }),
      { discard: true },
    );
    if (visitor.periodPass !== undefined) {
      yield* visitPeriods({ pages, pass: visitor.periodPass, pageSize });
    }
  });
