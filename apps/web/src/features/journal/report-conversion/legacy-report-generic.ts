/**
 * What an old report page said in words, read section by section: a
 * section's heading, its lists, notes, and paragraphs, and each `h3` in it as
 * a section of its own. The header is read here too, its summary as
 * paragraphs and an alert as a warning.
 */

import type {
  ReportBlock,
  SectionBlock,
} from '../schemas/day-report-blocks.ts';
import {
  childElements,
  type HtmlElement,
  hasClass,
  is,
  textOf,
  textWithout,
} from './html-tree.ts';
import { listBlockOf } from './legacy-report-lists.ts';
import { labelOf, paragraphsOf, richOf } from './legacy-report-text.ts';

export const calloutNote = (text: string): Array<ReportBlock> => {
  const rich = richOf(text);
  return rich === undefined
    ? []
    : [{ kind: 'callout', tone: 'note', text: rich }];
};

/** A section's heading, in it or in the row that holds it beside a button. */
export const headingOf = (section: HtmlElement): string | undefined => {
  const children = childElements(section);
  const heading =
    children.find((child) => child.tag === 'h2') ??
    children
      .filter((child) => is(child, 'div', 'section-head'))
      .flatMap(childElements)
      .find((child) => child.tag === 'h2');
  return heading === undefined
    ? undefined
    : labelOf(textWithout(heading, (child) => hasClass(child, 'estimate')));
};

export const isHeadingChild = (child: HtmlElement): boolean =>
  child.tag === 'h2' || is(child, 'div', 'section-head');

/** What one child of a section says, as blocks. */
export const childBlocksOf = (
  child: HtmlElement,
  day: string,
): Array<ReportBlock> => {
  if (is(child, 'ul', 'legend') || child.tag === 'button') {
    return [];
  }
  if (child.tag === 'ul' || child.tag === 'ol') {
    const list = listBlockOf(child, day);
    return list === undefined ? [] : [list];
  }
  if (is(child, 'p', 'meta')) {
    return calloutNote(textOf(child));
  }
  return [...paragraphsOf(child)];
};

type Walked = {
  readonly blocks: Array<ReportBlock>;
  readonly subsections: Array<SectionBlock & { blocks: Array<ReportBlock> }>;
};

/** A section's children as blocks, each `h3` starting a section of its own. */
export const walkChildren = (
  children: ReadonlyArray<HtmlElement>,
  blocksOf: (child: HtmlElement) => Array<ReportBlock>,
): Walked => {
  const walked: Walked = { blocks: [], subsections: [] };
  for (const child of children) {
    const heading = child.tag === 'h3' ? labelOf(textOf(child)) : undefined;
    if (heading === undefined) {
      (walked.subsections.at(-1)?.blocks ?? walked.blocks).push(
        ...blocksOf(child),
      );
    } else {
      walked.subsections.push({ kind: 'section', heading, blocks: [] });
    }
  }
  return {
    blocks: walked.blocks,
    subsections: walked.subsections.filter(
      (section) => section.blocks.length > 0,
    ),
  };
};

/** Any other section: its heading over its lists, notes, and paragraphs. */
export const genericSectionOf = (
  section: HtmlElement,
  day: string,
): Array<ReportBlock> => {
  const heading = headingOf(section);
  const { blocks, subsections } = walkChildren(
    childElements(section).filter((child) => !isHeadingChild(child)),
    (child) => childBlocksOf(child, day),
  );
  const all = [...blocks, ...subsections];
  if (heading === undefined) {
    return all;
  }
  return all.length === 0 ? [] : [{ kind: 'section', heading, blocks: all }];
};

export const headerBlocksOf = (header: HtmlElement): Array<ReportBlock> =>
  childElements(header).flatMap((child): Array<ReportBlock> => {
    if (is(child, 'div', 'alert')) {
      const text = richOf(
        textWithout(child, (part) => hasClass(part, 'alert-icon')),
      );
      return text === undefined
        ? []
        : [{ kind: 'callout', tone: 'warning', text }];
    }
    if (
      child.tag === 'h1' ||
      is(child, 'p', 'eyebrow') ||
      is(child, 'p', 'notice')
    ) {
      return [];
    }
    return [...paragraphsOf(child)];
  });
