/**
 * An old day report page as a report document, for the one-time conversion
 * of the pages /wrap stored before Postlude drew day reports itself.
 *
 * It knows the shapes our own templates wrote, each by a mark only it has:
 *
 * - `wrap-47`, agent-skills #47, with the button that widened the timeline;
 * - `wrap-45`, #45, with the day in parts as titled arcs and the day in figures;
 * - `wrap-43`, #43, which first drew the timeline and the day in parts;
 * - `wrap-17`, #17, the first template, which #33 left as it was;
 * - `postlude-sample`, the page Postlude's sample days carried.
 *
 * Every shape is read by the same walk over the page's sections, since each
 * kept the sections of the one before. A page of any other shape becomes its
 * words as paragraphs, with a note that says so. Whatever comes out is held
 * to the document schema as strictly as `agent-area put` holds /wrap to it.
 */

import { Schema } from 'effect';

import { type DayMetrics, DayMetricsSchema } from '../schemas/day-metrics.ts';
import {
  type ReportBlock,
  type ReportDocument,
  ReportDocumentSchema,
  reportDocumentVersion,
} from '../schemas/day-report-blocks.ts';
import {
  attributeOf,
  childElements,
  findElement,
  type HtmlElement,
  is,
  parseHtml,
  textOf,
} from './html-tree.ts';
import { headerBlocksOf } from './legacy-report-generic.ts';
import { type PageContext, sectionBlocksOf } from './legacy-report-sections.ts';
import { paragraphsOf, richOf, textDocument } from './legacy-report-text.ts';
import { agentFactsOf, sampleTilesBlockOf } from './legacy-report-tiles.ts';

export const legacyShapes = [
  'wrap-47',
  'wrap-45',
  'wrap-43',
  'wrap-17',
  'postlude-sample',
] as const;

export type LegacyShape = (typeof legacyShapes)[number];

const blocksPerDocument = 400;

const has = (page: HtmlElement, matches: (element: HtmlElement) => boolean) =>
  findElement(page, matches) !== undefined;

/** Which of our templates wrote a page, or nothing for a page none of them did. */
export const legacyShapeOf = (page: HtmlElement): LegacyShape | undefined => {
  if (has(page, (element) => element.attributes.has('data-width-toggle'))) {
    return 'wrap-47';
  }
  if (
    has(
      page,
      (element) => is(element, 'ol', 'arcs') || is(element, 'dl', 'facts'),
    )
  ) {
    return 'wrap-45';
  }
  if (
    has(
      page,
      (element) => is(element, 'div', 'timeline') || is(element, 'ol', 'parts'),
    )
  ) {
    return 'wrap-43';
  }
  if (has(page, (element) => is(element, 'section', 'tiles'))) {
    return 'wrap-17';
  }
  if (
    has(
      page,
      (element) =>
        element.tag === 'dd' &&
        (attributeOf(element, 'data-minutes') !== undefined ||
          element.attributes.has('data-mail')),
    )
  ) {
    return 'postlude-sample';
  }
  return undefined;
};

/** The element that holds a page's content: its `main`, else its body. */
const contentOf = (page: HtmlElement): HtmlElement =>
  findElement(page, (element) => element.tag === 'main') ??
  findElement(page, (element) => element.tag === 'body') ??
  page;

const topBlocksOf = (
  element: HtmlElement,
  context: PageContext,
): ReadonlyArray<ReportBlock> => {
  if (element.tag === 'header') {
    return headerBlocksOf(element);
  }
  if (element.tag === 'section') {
    return sectionBlocksOf(element, context);
  }
  if (is(element, 'p', 'note')) {
    const text = richOf(textOf(element));
    return text === undefined ? [] : [{ kind: 'callout', tone: 'note', text }];
  }
  if (element.tag === 'dl') {
    const tiles = sampleTilesBlockOf(element, context.metrics);
    return tiles === undefined ? [] : [tiles];
  }
  if (element.tag === 'h1' || element.attributes.has('hidden')) {
    return [];
  }
  return paragraphsOf(element);
};

const strictly = { onExcessProperty: 'error' } as const;

const valid = (document: ReportDocument): ReportDocument | undefined => {
  const decoded = Schema.decodeUnknownExit(ReportDocumentSchema)(
    document,
    strictly,
  );
  return decoded._tag === 'Success' ? decoded.value : undefined;
};

const metricsOf = (dayMetrics: unknown): DayMetrics | null => {
  const decoded = Schema.decodeUnknownExit(DayMetricsSchema)(dayMetrics);
  return decoded._tag === 'Success' ? decoded.value : null;
};

const shapedDocument = (
  page: HtmlElement,
  day: string,
  metrics: DayMetrics | null,
): ReportDocument => {
  const content = contentOf(page);
  const context: PageContext = {
    day,
    metrics,
    agents: agentFactsOf(content),
    hasTimeline: has(content, (element) => is(element, 'div', 'timeline')),
  };
  return {
    version: reportDocumentVersion,
    blocks: childElements(content)
      .flatMap((element) => topBlocksOf(element, context))
      .slice(0, blocksPerDocument),
  };
};

export type ConvertedReport = {
  readonly shape: LegacyShape | 'text';
  readonly document: ReportDocument;
};

export type LegacyReport = {
  readonly html: string;
  /** The journal day the page reports on, `YYYY-MM-DD`. */
  readonly day: string;
  /** The metrics stored with the page, which its script filled in. */
  readonly dayMetrics: unknown;
};

const textOnly = (page: HtmlElement): ConvertedReport | undefined => {
  const words = textDocument(page);
  const document = words === undefined ? undefined : valid(words);
  return document === undefined ? undefined : { shape: 'text', document };
};

/**
 * A stored page as a document, or nothing for a page that holds no words at
 * all. A page of a known shape that doesn't come out as a valid document is
 * kept as its words, like a page of an unknown shape.
 */
export const convertLegacyReport = ({
  html,
  day,
  dayMetrics,
}: LegacyReport): ConvertedReport | undefined => {
  const page = parseHtml(html);
  const shape = legacyShapeOf(page);
  if (shape === undefined) {
    return textOnly(page);
  }
  try {
    const document = valid(shapedDocument(page, day, metricsOf(dayMetrics)));
    return document === undefined ? textOnly(page) : { shape, document };
  } catch {
    return textOnly(page);
  }
};
