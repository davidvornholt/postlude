/**
 * The lists of an old report page as list blocks. An item there was its
 * words, a `span.time` before them, and a `span.meta` after them starting
 * with "· ". A time was a clock time, a clock range, "All day", or, in the
 * list of threads behind the lead time, a duration, which stays a few words
 * beside the item rather than a time.
 */

import type { ItemTime, ListBlock } from '../schemas/day-report-blocks.ts';
import {
  childElements,
  type HtmlElement,
  is,
  textOf,
  textWithout,
} from './html-tree.ts';
import {
  isClock,
  isClockRange,
  journalClockInstant,
  journalClockSpan,
} from './legacy-clock.ts';
import { labelOf, richOf } from './legacy-report-text.ts';

const itemsPerList = 500;
const metaLead = /^·\s*/u;

type ListItem = ListBlock['items'][number];

const timeOf = (day: string, text: string): ItemTime | undefined => {
  if (text === 'All day') {
    return { allDay: true };
  }
  if (isClock(text)) {
    const at = journalClockInstant(day, text);
    return at === undefined ? undefined : { at };
  }
  return isClockRange(text) ? journalClockSpan(day, text) : undefined;
};

/** The words after an item's text, without the dot that led them in. */
export const metaTextOf = (element: HtmlElement | undefined): string =>
  element === undefined ? '' : textOf(element).replace(metaLead, '');

/**
 * One item of an old list. `metaFor` may rewrite the words beside it, as the
 * list of pull requests does to name each one's repository.
 */
export const listItemOf = (
  item: HtmlElement,
  day: string,
  metaFor: (meta: string) => string = (meta) => meta,
): ListItem | undefined => {
  const children = childElements(item);
  const timeElement = children.find((child) => is(child, 'span', 'time'));
  const metaElement = children.find((child) => is(child, 'span', 'meta'));
  const timeText = timeElement === undefined ? '' : textOf(timeElement);
  const time = timeText === '' ? undefined : timeOf(day, timeText);
  const meta = [
    time === undefined ? timeText : '',
    metaFor(metaTextOf(metaElement)),
  ]
    .filter((part) => part !== '')
    .join(' · ');
  const words = textWithout(
    item,
    (child) =>
      child === timeElement ||
      child === metaElement ||
      child.tag === 'details' ||
      child.tag === 'ul',
  );
  const text = richOf(words === '' ? meta : words);
  if (text === undefined) {
    return undefined;
  }
  const label = words === '' ? undefined : labelOf(meta);
  return {
    text,
    ...(time === undefined ? {} : { time }),
    ...(label === undefined ? {} : { meta: label }),
  };
};

export const listOf = (
  items: ReadonlyArray<ListItem>,
): ListBlock | undefined =>
  items.length === 0
    ? undefined
    : { kind: 'list', items: items.slice(0, itemsPerList) };

/** A `ul` or `ol` of an old page as a list block, if it has any items. */
export const listBlockOf = (
  list: HtmlElement,
  day: string,
): ListBlock | undefined =>
  listOf(
    childElements(list)
      .filter((child) => child.tag === 'li')
      .flatMap((item) => listItemOf(item, day) ?? []),
  );
