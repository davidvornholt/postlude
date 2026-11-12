/**
 * The sections of an old report page as blocks: its header, the day in
 * parts, the day in figures, the pull requests landed, the measured sections
 * its script filled in, and every other section by its heading and lists.
 *
 * A measured section is drawn again from the day's metrics, the way /wrap now
 * builds it. "Focus and short stretches" is left out, as the tiles say the
 * same, and so is "Time by category" where there is a timeline, which now
 * shows each area's total beside its row.
 */

import { minutesText } from '../day-report-format.ts';
import {
  sentMailTable,
  sourcesSection,
} from '../day-report-measured-blocks.ts';
import type { DayMetrics } from '../schemas/day-metrics.ts';
import type {
  FactsBlock,
  PartsBlock,
  ReportBlock,
} from '../schemas/day-report-blocks.ts';
import {
  attributeOf,
  childElements,
  findElement,
  type HtmlElement,
  hasClass,
  is,
  textOf,
  textWithout,
} from './html-tree.ts';
import { journalClockSpan } from './legacy-clock.ts';
import {
  calloutNote,
  childBlocksOf,
  genericSectionOf,
  headingOf,
  isHeadingChild,
  walkChildren,
} from './legacy-report-generic.ts';
import { listBlockOf, listItemOf, listOf } from './legacy-report-lists.ts';
import { labelOf, richLinesOf } from './legacy-report-text.ts';
import type { AgentFacts } from './legacy-report-tiles.ts';
import { tilesBlockOf } from './legacy-report-tiles.ts';
import {
  isTimelineSection,
  timelineBlockOf,
} from './legacy-report-timeline.ts';

export type PageContext = {
  readonly day: string;
  readonly metrics: DayMetrics | null;
  readonly agents: AgentFacts | undefined;
  readonly hasTimeline: boolean;
};

const paragraphsPerPart = 12;
const partsPerDay = 24;
const factsPerBlock = 40;
const detailsPerFact = 20;

type Part = PartsBlock['parts'][number];

const partOf = (item: HtmlElement, day: string): Part | undefined => {
  const children = childElements(item);
  const head = children.find((child) => child.tag === 'h3');
  const headParts = head === undefined ? [] : childElements(head);
  const when =
    headParts.find((part) => hasClass(part, 'when')) ??
    children.find((child) => is(child, 'p', 'part-time'));
  const titleElement = headParts.find(
    (part) => !(hasClass(part, 'no') || hasClass(part, 'when')),
  );
  const span =
    when === undefined ? undefined : journalClockSpan(day, textOf(when));
  const text = richLinesOf(
    children
      .filter((child) => child.tag === 'p' && !hasClass(child, 'part-time'))
      .map(textOf),
  ).slice(0, paragraphsPerPart);
  const title =
    titleElement === undefined ? undefined : labelOf(textOf(titleElement));
  return span === undefined || text.length === 0
    ? undefined
    : { ...(title === undefined ? {} : { title }), ...span, text };
};

const partsSectionOf = (
  section: HtmlElement,
  list: HtmlElement,
  day: string,
): Array<ReportBlock> => {
  const parts = childElements(list)
    .filter((child) => child.tag === 'li')
    .flatMap((item) => partOf(item, day) ?? [])
    .slice(0, partsPerDay);
  return parts.length === 0
    ? genericSectionOf(section, day)
    : [
        {
          kind: 'section',
          heading: headingOf(section) ?? 'The day in parts',
          blocks: [{ kind: 'parts', parts }],
        },
      ];
};

const nestedListOf = (
  item: HtmlElement,
  day: string,
): ReportBlock | undefined => {
  const details = childElements(item).find((child) => child.tag === 'details');
  const summary =
    details && childElements(details).find((child) => child.tag === 'summary');
  const list =
    details && childElements(details).find((child) => child.tag === 'ul');
  const block = list === undefined ? undefined : listBlockOf(list, day);
  const said = summary === undefined ? '' : textOf(summary);
  return block === undefined
    ? undefined
    : {
        kind: 'section',
        heading:
          said === 'Show the threads'
            ? 'Lead time by thread'
            : (labelOf(said) ?? 'More'),
        collapsed: true,
        blocks: [block],
      };
};

type Fact = FactsBlock['items'][number];

/** One term's details, and the lists folded away in them. */
const factOf = (
  term: string,
  description: HtmlElement,
  day: string,
): { readonly fact?: Fact; readonly nested: ReadonlyArray<ReportBlock> } => {
  const list = childElements(description).find((part) => part.tag === 'ul');
  const lines = list === undefined ? [description] : childElements(list);
  const details = richLinesOf(
    lines.map((line) => textWithout(line, (part) => part.tag === 'details')),
  ).slice(0, detailsPerFact);
  return {
    ...(details.length === 0 ? {} : { fact: { term, details } }),
    nested: lines.flatMap((line) => nestedListOf(line, day) ?? []),
  };
};

const factsSectionOf = (
  section: HtmlElement,
  facts: HtmlElement,
  day: string,
): Array<ReportBlock> => {
  const items: Array<Fact> = [];
  const nested: Array<ReportBlock> = [];
  let term: string | undefined;
  for (const child of childElements(facts)) {
    if (child.tag === 'dt') {
      term = labelOf(textOf(child));
    } else if (child.tag === 'dd' && term !== undefined) {
      const read = factOf(term, child, day);
      items.push(...(read.fact === undefined ? [] : [read.fact]));
      nested.push(...read.nested);
    }
  }
  const blocks: Array<ReportBlock> = [
    ...(items.length === 0
      ? []
      : [{ kind: 'facts' as const, items: items.slice(0, factsPerBlock) }]),
    ...nested,
  ];
  return blocks.length === 0
    ? []
    : [
        {
          kind: 'section',
          heading: headingOf(section) ?? 'The day in figures',
          blocks,
        },
      ];
};

const numberMeta = /^#\d+$/u;

/** The pull requests landed, folded away, one list over every repository. */
const pullRequestsSectionOf = (
  details: HtmlElement,
  day: string,
): Array<ReportBlock> => {
  const children = childElements(details);
  const summary = children.find((child) => child.tag === 'summary');
  const summaryParts = summary === undefined ? [] : childElements(summary);
  const heading = summaryParts.find((part) => part.tag === 'h2');
  const note = summaryParts.find((part) => is(part, 'span', 'meta'));
  let repository = '';
  const items = children.flatMap((child) => {
    if (child.tag === 'h3') {
      repository = textWithout(child, (part) => is(part, 'span', 'meta'));
      return [];
    }
    if (child.tag !== 'ul') {
      return [];
    }
    const named = (meta: string): string => {
      if (meta === '') {
        return repository;
      }
      return numberMeta.test(meta)
        ? `${repository} ${meta}`
        : `${repository} · ${meta}`;
    };
    return childElements(child)
      .filter((item) => item.tag === 'li')
      .flatMap((item) => listItemOf(item, day, named) ?? []);
  });
  const list = listOf(items);
  const noteText = note === undefined ? undefined : labelOf(textOf(note));
  return list === undefined
    ? []
    : [
        {
          kind: 'section',
          heading:
            (heading === undefined ? undefined : labelOf(textOf(heading))) ??
            'Pull requests landed',
          ...(noteText === undefined ? {} : { note: noteText }),
          collapsed: true,
          blocks: [list],
        },
      ];
};

const categoryTable = (metrics: DayMetrics | null): Array<ReportBlock> =>
  metrics === null || metrics.categories.length === 0
    ? []
    : [
        {
          kind: 'table',
          caption: 'Time by category (estimates)',
          columns: ['Category', 'Time'],
          rows: metrics.categories.map(({ label, minutes }) => [
            [label],
            [minutes === null ? 'Not measured' : minutesText(minutes)],
          ]),
        },
      ];

const sourcesOf = (
  section: HtmlElement,
  metrics: DayMetrics | null,
): Array<ReportBlock> => {
  const notes = childElements(section)
    .filter((child) => is(child, 'p', 'meta'))
    .flatMap((child) => calloutNote(textOf(child)));
  if (metrics !== null) {
    return [...sourcesSection(metrics, notes)];
  }
  return notes.length === 0
    ? []
    : [{ kind: 'section', heading: 'Sources', collapsed: true, blocks: notes }];
};

/** The timeline, and what its section said below it. */
const timelineSectionOf = (
  section: HtmlElement,
  context: PageContext,
): Array<ReportBlock> => {
  const heading = headingOf(section) ?? 'Timeline';
  const children = childElements(section).filter(
    (child) => !isHeadingChild(child),
  );
  const timeline = children.find((child) => is(child, 'div', 'timeline'));
  const notes = children
    .filter((child) => is(child, 'p', 'meta'))
    .flatMap((child) => labelOf(textOf(child)) ?? []);
  const block = timelineBlockOf({ heading, timeline, notes, ...context });
  const { blocks, subsections } = walkChildren(
    children.filter((child) => child !== timeline && !is(child, 'p', 'meta')),
    (child) => childBlocksOf(child, context.day),
  );
  if (block !== undefined && block.groups.length > 0) {
    return [block, ...blocks, ...subsections];
  }
  const said = [...blocks, ...notes.flatMap(calloutNote)];
  return [
    ...(said.length === 0
      ? []
      : [{ kind: 'section' as const, heading, blocks: said }]),
    ...subsections,
  ];
};

const has = (
  section: HtmlElement,
  tag: string,
  className?: string,
): HtmlElement | undefined =>
  findElement(section, (element) => is(element, tag, className));

const hasMetric = (section: HtmlElement, metric: string): boolean =>
  findElement(
    section,
    (element) =>
      attributeOf(element, 'data-metric') === metric && element.tag === 'ul',
  ) !== undefined;

type SectionReader = (
  section: HtmlElement,
  context: PageContext,
) => Array<ReportBlock> | undefined;

/**
 * The readers of the sections our templates wrote, each answering only for
 * a section it knows, in the order they are tried.
 */
const sectionReaders: ReadonlyArray<SectionReader> = [
  (section, { metrics, agents }) => {
    if (!hasClass(section, 'tiles')) {
      return;
    }
    const tiles = tilesBlockOf(section, metrics, agents);
    return tiles === undefined ? [] : [tiles];
  },
  (section, context) =>
    isTimelineSection(section)
      ? timelineSectionOf(section, context)
      : undefined,
  (section, { day }) => {
    const parts = has(section, 'ol', 'arcs') ?? has(section, 'ol', 'parts');
    return parts === undefined
      ? undefined
      : partsSectionOf(section, parts, day);
  },
  (section, { day }) => {
    const facts = has(section, 'dl', 'facts');
    return facts === undefined
      ? undefined
      : factsSectionOf(section, facts, day);
  },
  (section, { day }) => {
    const details = has(section, 'details', 'prs');
    return details === undefined
      ? undefined
      : pullRequestsSectionOf(details, day);
  },
  (section) => (has(section, 'div', 'split') === undefined ? undefined : []),
  (section, { hasTimeline, metrics }) => {
    if (
      has(section, 'div', 'bars') === undefined &&
      !section.attributes.has('data-categories')
    ) {
      return;
    }
    return hasTimeline ? [] : categoryTable(metrics);
  },
  (section, { metrics }) => {
    if (!hasMetric(section, 'sentMails')) {
      return;
    }
    return metrics === null ? [] : [...sentMailTable(metrics)];
  },
  (section, { metrics }) =>
    section.attributes.has('data-sources') || hasMetric(section, 'coverage')
      ? sourcesOf(section, metrics)
      : undefined,
];

/** One section of an old page as blocks. */
export const sectionBlocksOf = (
  section: HtmlElement,
  context: PageContext,
): Array<ReportBlock> => {
  for (const read of sectionReaders) {
    const blocks = read(section, context);
    if (blocks !== undefined) {
      return blocks;
    }
  }
  return genericSectionOf(section, context.day);
};
