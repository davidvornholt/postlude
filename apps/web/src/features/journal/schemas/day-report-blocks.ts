/**
 * The day report document /wrap stores and Postlude draws: a versioned list of
 * blocks from the catalogue below.
 *
 * The agent that wraps the day composes the document. It chooses which blocks
 * to use, in what order, under which headings, and writes their prose. /wrap's
 * scripts build the blocks that carry data, such as the tiles, the timeline,
 * and the lists of what landed, so their numbers come from what was measured.
 * Postlude owns how every block looks, so a change to a block reaches every
 * day already stored.
 *
 * A block is one entry in `reportBlockSchemas` and one component in
 * `day-report-view.tsx`; the type of that component map makes the two agree.
 * `agent-area put` holds a document to this schema strictly, refusing unknown
 * keys. The page reads stored documents leniently, block by block
 * (`day-report-reader.ts`), so a block it doesn't know is shown as plain text
 * instead of breaking the page.
 */

import { Schema } from 'effect';

import {
  CellTextSchema,
  CountSchema,
  endsAfterStart,
  InstantSchema,
  MinutesSchema,
  ReportHeadingSchema,
  ReportLabelSchema,
  RichTextSchema,
  timeRangeFields,
} from './day-report-text.ts';
import { TimelineBlockSchema } from './day-report-timeline.ts';

/** The version this Postlude writes and reads; a change of shape needs a new one. */
export const reportDocumentVersion = 1;

/** How deep sections may nest: a section, a section in it, and one more. */
export const sectionDepthLimit = 3;

const blocksPerList = 400;
const paragraphsPerPart = 12;
const partsPerDay = 24;
const factsPerBlock = 40;
const detailsPerFact = 20;
const itemsPerList = 500;
const tilesPerBlock = 24;
const columnsPerTable = 12;
const rowsPerTable = 500;

const limited = <S extends Schema.Top>(item: S, limit: number) =>
  Schema.Array(item).check(Schema.isMinLength(1), Schema.isMaxLength(limit));

export const ParagraphBlockSchema = Schema.Struct({
  kind: Schema.Literal('paragraph'),
  text: RichTextSchema,
});

/**
 * The day in parts: each part's title and prose, and when it was. A part
 * lacks a title only in reports converted from pages that had none.
 */
export const PartsBlockSchema = Schema.Struct({
  kind: Schema.Literal('parts'),
  parts: limited(
    Schema.Struct({
      title: Schema.optionalKey(ReportHeadingSchema),
      ...timeRangeFields,
      text: limited(RichTextSchema, paragraphsPerPart),
    }).check(endsAfterStart),
    partsPerDay,
  ),
});

/** Terms and what is said about them, such as Output and Focus. */
export const FactsBlockSchema = Schema.Struct({
  kind: Schema.Literal('facts'),
  items: limited(
    Schema.Struct({
      term: ReportLabelSchema,
      details: limited(RichTextSchema, detailsPerFact),
    }),
    factsPerBlock,
  ),
});

/** When a list item happened: at a time, from one time to another, or all day. */
const ItemTimeSchema = Schema.Union([
  Schema.Struct({ at: InstantSchema }),
  Schema.Struct(timeRangeFields).check(endsAfterStart),
  Schema.Struct({ allDay: Schema.Literal(true) }),
]);

export type ItemTime = Schema.Schema.Type<typeof ItemTimeSchema>;

export const ListBlockSchema = Schema.Struct({
  kind: Schema.Literal('list'),
  items: limited(
    Schema.Struct({
      text: RichTextSchema,
      time: Schema.optionalKey(ItemTimeSchema),
      /** A few plain words after the text, such as a project or a number. */
      meta: Schema.optionalKey(ReportLabelSchema),
    }),
    itemsPerList,
  ),
});

/** A note beside the report, or a warning that asks for something to be done. */
export const CalloutBlockSchema = Schema.Struct({
  kind: Schema.Literal('callout'),
  tone: Schema.Literals(['note', 'warning']),
  text: RichTextSchema,
});

/** A measured value, or null when its source wasn't read. */
const TileValueSchema = Schema.Union([
  Schema.Struct({ minutes: MinutesSchema }),
  Schema.Struct({ count: CountSchema }),
  Schema.Null,
]);

export type TileValue = Schema.Schema.Type<typeof TileValueSchema>;

export const TilesBlockSchema = Schema.Struct({
  kind: Schema.Literal('tiles'),
  /** What the tiles are, for assistive technology; "The day in numbers" if left out. */
  label: Schema.optionalKey(ReportLabelSchema),
  tiles: limited(
    Schema.Struct({
      label: ReportLabelSchema,
      value: TileValueSchema,
      note: Schema.optionalKey(RichTextSchema),
    }),
    tilesPerBlock,
  ),
});

const rowsFitColumns = Schema.makeFilter(
  (table: {
    readonly columns: ReadonlyArray<unknown>;
    readonly rows: ReadonlyArray<ReadonlyArray<unknown>>;
  }) => table.rows.every((row) => row.length === table.columns.length),
  {
    identifier: 'RowsFitColumns',
    expected: 'rows with exactly one cell for each column',
  },
);

export const TableBlockSchema = Schema.Struct({
  kind: Schema.Literal('table'),
  caption: Schema.optionalKey(ReportLabelSchema),
  columns: limited(ReportLabelSchema, columnsPerTable),
  rows: limited(
    Schema.Array(CellTextSchema).check(Schema.isMaxLength(columnsPerTable)),
    rowsPerTable,
  ),
}).check(rowsFitColumns);

/** A section's own fields; its blocks are read on their own, one by one. */
export const sectionFields = {
  kind: Schema.Literal('section'),
  heading: ReportHeadingSchema,
  /** A few words beside the heading, such as how many items it holds. */
  note: Schema.optionalKey(ReportLabelSchema),
  /** Whether the section starts folded away, under a heading that opens it. */
  collapsed: Schema.optionalKey(Schema.Boolean),
};

/** Every block but the section, by kind. */
export const reportBlockSchemas = {
  paragraph: ParagraphBlockSchema,
  parts: PartsBlockSchema,
  facts: FactsBlockSchema,
  list: ListBlockSchema,
  callout: CalloutBlockSchema,
  tiles: TilesBlockSchema,
  timeline: TimelineBlockSchema,
  table: TableBlockSchema,
} as const;

type LeafSchemas = typeof reportBlockSchemas;
type BlockOf<Kind extends keyof LeafSchemas> = Schema.Schema.Type<
  LeafSchemas[Kind]
>;
export type LeafBlock = {
  readonly [Kind in keyof LeafSchemas]: BlockOf<Kind>;
}[keyof LeafSchemas];

export type ParagraphBlock = BlockOf<'paragraph'>;
export type PartsBlock = BlockOf<'parts'>;
export type FactsBlock = BlockOf<'facts'>;
export type ListBlock = BlockOf<'list'>;
export type CalloutBlock = BlockOf<'callout'>;
export type TilesBlock = BlockOf<'tiles'>;
export type TableBlock = BlockOf<'table'>;

export type SectionBlock = {
  readonly kind: 'section';
  readonly heading: string;
  readonly note?: string;
  readonly collapsed?: boolean;
  readonly blocks: ReadonlyArray<ReportBlock>;
};

export type ReportBlock = SectionBlock | LeafBlock;
export type ReportBlockKind = ReportBlock['kind'];

export const reportBlockKinds: ReadonlyArray<ReportBlockKind> = [
  'section',
  ...(Object.keys(reportBlockSchemas) as ReadonlyArray<keyof LeafSchemas>),
];

const BlockSchema: Schema.Codec<ReportBlock, unknown> = Schema.Union([
  Schema.Struct({
    ...sectionFields,
    blocks: limited(
      Schema.suspend((): Schema.Codec<ReportBlock, unknown> => BlockSchema),
      blocksPerList,
    ),
  }),
  ...Object.values(reportBlockSchemas),
]);

const depthOf = (blocks: ReadonlyArray<ReportBlock>): number =>
  Math.max(
    0,
    ...blocks.map((block) =>
      block.kind === 'section' ? 1 + depthOf(block.blocks) : 0,
    ),
  );

export const ReportDocumentSchema = Schema.Struct({
  version: Schema.Literal(reportDocumentVersion),
  blocks: limited(BlockSchema, blocksPerList),
}).check(
  Schema.makeFilter(
    (document: { readonly blocks: ReadonlyArray<ReportBlock> }) =>
      depthOf(document.blocks) <= sectionDepthLimit,
    {
      identifier: 'SectionDepth',
      expected: `sections nested at most ${sectionDepthLimit} deep`,
    },
  ),
);

export type ReportDocument = Schema.Schema.Type<typeof ReportDocumentSchema>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Where a document holds a block of a kind this Postlude doesn't know, as
 * paths such as `blocks[2].blocks[0]` with the kind found there. The schema
 * would only say that the block matches none of the kinds; this names it.
 */
export const unknownBlockKinds = (document: unknown): ReadonlyArray<string> => {
  const known = new Set<string>(reportBlockKinds);
  const walk = (blocks: unknown, path: string): ReadonlyArray<string> =>
    Array.isArray(blocks)
      ? blocks.flatMap((block: unknown, index) => {
          const at = `${path}[${index}]`;
          if (!isRecord(block)) {
            return [];
          }
          const { kind } = block;
          if (typeof kind === 'string' && !known.has(kind)) {
            return [`${at} is a block of kind "${kind}"`];
          }
          return kind === 'section' ? walk(block.blocks, `${at}.blocks`) : [];
        })
      : [];
  return isRecord(document) ? walk(document.blocks, 'blocks') : [];
};
