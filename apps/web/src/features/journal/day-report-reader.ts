/**
 * Reads a stored day report document for the page, block by block.
 *
 * `agent-area put` stores only documents that pass the schema, but a stored
 * document may come from a newer /wrap than this Postlude, or a block's rules
 * may since have tightened. So nothing here fails: each block is read on its
 * own, and one this Postlude can't read becomes a fallback that shows the
 * block's words as plain text. The rest of the report is shown as usual.
 *
 * `reportPlainText` is the report's words, which Postlude stores beside the
 * document for search and gives the agent note as /wrap's account of the day.
 */

import { Option, Schema } from 'effect';

import { minutesText } from './day-report-format.ts';
import {
  type LeafBlock,
  reportBlockSchemas,
  type SectionBlock,
  sectionDepthLimit,
  sectionFields,
  type TileValue,
} from './schemas/day-report-blocks.ts';
import { richTextPlain } from './schemas/day-report-text.ts';

/** A block this Postlude can't read, with the words it held. */
export type FallbackBlock = {
  readonly kind: 'fallback';
  readonly lines: ReadonlyArray<string>;
};

export type ReadSection = Omit<SectionBlock, 'blocks'> & {
  readonly blocks: ReadonlyArray<ReadBlock>;
};

export type ReadBlock = ReadSection | LeafBlock | FallbackBlock;

export type ReadDocument = { readonly blocks: ReadonlyArray<ReadBlock> };

type LeafKind = keyof typeof reportBlockSchemas;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isLeafKind = (kind: unknown): kind is LeafKind =>
  typeof kind === 'string' && Object.hasOwn(reportBlockSchemas, kind);

/** Keys whose strings are addresses or machine values, not words to show. */
const unspokenKeys = new Set(['kind', 'href', 'tone', 'version']);
const instantPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/u;
const fallbackLineLimit = 200;

/** Every string a value holds, in order, except addresses and instants. */
const wordsIn = (value: unknown): ReadonlyArray<string> => {
  if (typeof value === 'string') {
    return instantPattern.test(value) || value.trim() === '' ? [] : [value];
  }
  if (Array.isArray(value)) {
    const joined = value.every(
      (span) => typeof span === 'string' || isRecord(span),
    );
    return joined && value.some((span) => typeof span === 'string')
      ? [value.flatMap(wordsIn).join('')]
      : value.flatMap(wordsIn);
  }
  if (isRecord(value)) {
    return Object.entries(value).flatMap(([key, inner]) =>
      unspokenKeys.has(key) ? [] : wordsIn(inner),
    );
  }
  return [];
};

export const fallbackOf = (value: unknown): FallbackBlock => ({
  kind: 'fallback',
  lines: wordsIn(value).slice(0, fallbackLineLimit),
});

const decodeLeaf = <Kind extends LeafKind>(
  kind: Kind,
  value: unknown,
): Option.Option<LeafBlock> =>
  Schema.decodeUnknownOption(
    reportBlockSchemas[kind] as Schema.Codec<LeafBlock>,
  )(value);

const decodeSectionHead = Schema.decodeUnknownOption(
  Schema.Struct({ ...sectionFields, blocks: Schema.Array(Schema.Unknown) }),
);

const readBlock = (value: unknown, depth: number): ReadBlock => {
  if (!isRecord(value)) {
    return fallbackOf(value);
  }
  if (value.kind === 'section' && depth < sectionDepthLimit) {
    return Option.match(decodeSectionHead(value), {
      onNone: () => fallbackOf(value),
      onSome: (section) => ({
        ...section,
        blocks: section.blocks.map((block) => readBlock(block, depth + 1)),
      }),
    });
  }
  if (isLeafKind(value.kind)) {
    return Option.getOrElse(decodeLeaf(value.kind, value), () =>
      fallbackOf(value),
    );
  }
  return fallbackOf(value);
};

/** The document's blocks, each read on its own; anything else is one fallback. */
export const readReportDocument = (stored: unknown): ReadDocument =>
  isRecord(stored) && Array.isArray(stored.blocks)
    ? { blocks: stored.blocks.map((block) => readBlock(block, 0)) }
    : { blocks: [fallbackOf(stored)] };

export const tileValueText = (value: TileValue): string => {
  if (value === null) {
    return 'Not measured';
  }
  return 'minutes' in value ? minutesText(value.minutes) : String(value.count);
};

const blockWords = (block: ReadBlock): ReadonlyArray<string> => {
  switch (block.kind) {
    case 'section':
      return [
        block.heading,
        block.note ?? '',
        ...block.blocks.flatMap(blockWords),
      ];
    case 'paragraph':
    case 'callout':
      return [richTextPlain(block.text)];
    case 'parts':
      return block.parts.flatMap((part) => [
        part.title ?? '',
        ...part.text.map(richTextPlain),
      ]);
    case 'facts':
      return block.items.flatMap((item) => [
        item.term,
        ...item.details.map(richTextPlain),
      ]);
    case 'list':
      return block.items.flatMap((item) => [
        richTextPlain(item.text),
        item.meta ?? '',
      ]);
    case 'tiles':
      return block.tiles.flatMap((tile) => [
        tile.label,
        tileValueText(tile.value),
        tile.note === undefined ? '' : richTextPlain(tile.note),
      ]);
    case 'timeline':
      return [block.heading, ...(block.notes ?? [])];
    case 'table':
      return [
        block.caption ?? '',
        ...block.columns,
        ...block.rows.flatMap((row) => row.map(richTextPlain)),
      ];
    default:
      return block.lines;
  }
};

/**
 * The report's words in reading order, as one line: what search finds a day
 * by, and what the agent note is given. Links keep their words and lose their
 * addresses, as the text of a stored page did.
 */
export const reportPlainText = (document: ReadDocument): string =>
  document.blocks
    .flatMap(blockWords)
    .join(' ')
    .normalize('NFKC')
    .replace(/\s+/gu, ' ')
    .trim();
