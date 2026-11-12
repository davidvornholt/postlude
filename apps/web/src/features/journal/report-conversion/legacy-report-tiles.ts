/**
 * The tiles of an old report page as a tiles block.
 *
 * A tile that showed a metric was empty in the stored page, filled in by its
 * script from the day's metrics, so its value is taken from the metrics
 * again; a note's placeholders are filled in the same way. A tile /wrap wrote
 * out, such as Prompts, is read from its words. "Tracked time" (and "Off the
 * computer" before it) is left out, as /wrap now leaves it out.
 *
 * The sample page's first and last activity becomes the Active tile's note,
 * as /wrap now notes them under screen time.
 *
 * Agent time becomes what /wrap now shows: the clock time with at least one
 * agent running, which the page's facts gave, with the sum over threads in
 * its note, so the tile agrees with the facts beside it.
 */

import { minutesText } from '../day-report-format.ts';
import type { DayMetrics } from '../schemas/day-metrics.ts';
import type { TilesBlock, TileValue } from '../schemas/day-report-blocks.ts';
import type { RichText } from '../schemas/day-report-text.ts';
import {
  attributeOf,
  childElements,
  descendants,
  type HtmlElement,
  hasClass,
  is,
  isElement,
  textOf,
} from './html-tree.ts';
import { berlinClock } from './legacy-clock.ts';
import { labelOf, richOf } from './legacy-report-text.ts';

type Tile = TilesBlock['tiles'][number];

const minuteFields = new Set([
  'activeMinutes',
  'focusMinutes',
  'scatteredMinutes',
  'appointmentMinutes',
  'appointmentOffScreenMinutes',
]);
const instantFields = new Set(['firstActivityAt', 'lastActivityAt']);
/** Super Productivity's tracked time, which /wrap no longer shows as a tile. */
const droppedFields = new Set(['offComputerMinutes']);
const unmeasured = 'Not measured';

const fieldOf = (
  metrics: DayMetrics,
  field: string,
): number | string | null | undefined =>
  (metrics as unknown as Record<string, number | string | null | undefined>)[
    field
  ];

/** The mail sent from the mailboxes that were read, as the old pages added it up. */
const sentMailTotal = (metrics: DayMetrics): number | null => {
  const counted = metrics.sentMails.flatMap(({ count }) =>
    count === null ? [] : [count],
  );
  return counted.length === 0
    ? null
    : counted.reduce((sum, count) => sum + count, 0);
};

const sentMailNote = (metrics: DayMetrics | null): RichText | undefined => {
  if (metrics === null || sentMailTotal(metrics) === null) {
    return undefined;
  }
  const unread = metrics.sentMails.some(({ count }) => count === null);
  return [
    unread
      ? "Without the mailboxes that weren't measured"
      : 'Across all mailboxes',
  ];
};

const metricValue = (metrics: DayMetrics | null, field: string): TileValue => {
  if (metrics === null) {
    return null;
  }
  if (field === 'sentMails') {
    const total = sentMailTotal(metrics);
    return total === null ? null : { count: total };
  }
  const value = fieldOf(metrics, field);
  if (typeof value !== 'number') {
    return null;
  }
  return minuteFields.has(field) ? { minutes: value } : { count: value };
};

/** What a page's script wrote into a placeholder in a note. */
const metricText = (metrics: DayMetrics | null, field: string): string => {
  const value = metrics === null ? null : fieldOf(metrics, field);
  if (instantFields.has(field)) {
    return typeof value === 'string' ? berlinClock(value) : unmeasured;
  }
  return typeof value === 'number' ? minutesText(value) : unmeasured;
};

const noteOf = (
  note: HtmlElement | undefined,
  metrics: DayMetrics | null,
): RichText | undefined => {
  if (note === undefined) {
    return undefined;
  }
  if (attributeOf(note, 'data-metric') === 'sentMails') {
    return sentMailNote(metrics);
  }
  const placeholders = descendants(note).some(
    (child) => attributeOf(child, 'data-metric') !== undefined,
  );
  if (metrics === null && placeholders) {
    return undefined;
  }
  const words = note.children
    .map((child) => {
      const field = isElement(child)
        ? attributeOf(child, 'data-metric')
        : undefined;
      return field === undefined ? textOf(child) : metricText(metrics, field);
    })
    .join(' ');
  return richOf(words);
};

const hoursAndMinutes = /^(?:(?<hours>\d+) h)?\s*(?:(?<minutes>\d+) min)?$/u;
const wholeNumber = /^\d+$/u;

/** Minutes written as the old pages wrote them, such as "3 h 55 min". */
export const minutesOf = (text: string): number | undefined => {
  const groups = hoursAndMinutes.exec(text.trim())?.groups;
  if (
    groups === undefined ||
    (groups.hours === undefined && groups.minutes === undefined)
  ) {
    return undefined;
  }
  const minutesPerHour = 60;
  return (
    Number(groups.hours ?? 0) * minutesPerHour + Number(groups.minutes ?? 0)
  );
};

/** A tile value /wrap wrote out, or undefined for words that are no value. */
const writtenValue = (value: HtmlElement): TileValue | undefined => {
  const text = textOf(value);
  if (
    text === unmeasured ||
    descendants(value).some((child) => hasClass(child, 'unmeasured'))
  ) {
    return null;
  }
  if (wholeNumber.test(text)) {
    return { count: Number(text) };
  }
  const minutes = minutesOf(text);
  return minutes === undefined ? undefined : { minutes };
};

/** What the page's facts said about agents, and its tile about their peak. */
export type AgentFacts = {
  readonly threads: number;
  readonly runMinutes: number;
  readonly wallMinutes: number;
};

const agentFactPattern =
  /^Agents ran in (?<threads>\d+) threads? for (?<run>.+?) in all; at least one was running for (?<wall>.+?)\.$/u;
const peakPattern = /^Up to (?<peak>\d+) threads? at once/u;

export const agentFactsOf = (page: HtmlElement): AgentFacts | undefined => {
  for (const item of descendants(page)) {
    const groups =
      item.tag === 'li'
        ? agentFactPattern.exec(textOf(item))?.groups
        : undefined;
    const runMinutes = minutesOf(groups?.run ?? '');
    const wallMinutes = minutesOf(groups?.wall ?? '');
    if (runMinutes !== undefined && wallMinutes !== undefined) {
      return { threads: Number(groups?.threads), runMinutes, wallMinutes };
    }
  }
  return undefined;
};

const agentTile = (
  label: string,
  facts: AgentFacts,
  note: HtmlElement | undefined,
): Tile => {
  const peak = peakPattern.exec(note === undefined ? '' : textOf(note))?.groups
    ?.peak;
  const threads = `${facts.threads} ${facts.threads === 1 ? 'thread' : 'threads'}`;
  return {
    label,
    value: { minutes: facts.wallMinutes },
    note: [
      `${minutesText(facts.runMinutes)} across ${threads}${peak === undefined ? '' : ` · up to ${peak} at once`}`,
    ],
  };
};

/** A tile whose value /wrap wrote out in words, such as Prompts or Agent time. */
const writtenTileOf = (
  label: string,
  value: HtmlElement,
  note: RichText | undefined,
): Tile => {
  const written = writtenValue(value);
  if (written !== undefined) {
    return { label, value: written, ...(note === undefined ? {} : { note }) };
  }
  const words = richOf([textOf(value), ...(note ?? [])].join(' · '));
  return {
    label,
    value: null,
    ...(words === undefined ? {} : { note: words }),
  };
};

const tileOf = (
  tile: HtmlElement,
  metrics: DayMetrics | null,
  agents: AgentFacts | undefined,
): ReadonlyArray<Tile> => {
  const children = childElements(tile);
  const labelElement = children.find((child) => hasClass(child, 'tile-label'));
  const value = children.find((child) => hasClass(child, 'tile-value'));
  const note = children.find((child) => hasClass(child, 'tile-note'));
  const label =
    labelElement === undefined ? undefined : labelOf(textOf(labelElement));
  if (label === undefined || value === undefined) {
    return [];
  }
  const field = attributeOf(value, 'data-metric');
  if (field === undefined) {
    return [
      label === 'Agent time' && agents !== undefined
        ? agentTile(label, agents, note)
        : writtenTileOf(label, value, noteOf(note, metrics)),
    ];
  }
  if (droppedFields.has(field)) {
    return [];
  }
  const noteText = noteOf(note, metrics);
  return [
    {
      label,
      value: metricValue(metrics, field),
      ...(noteText === undefined ? {} : { note: noteText }),
    },
  ];
};

const tilesPerBlock = 24;

export const tilesBlockOf = (
  section: HtmlElement,
  metrics: DayMetrics | null,
  agents: AgentFacts | undefined,
): TilesBlock | undefined => {
  const tiles = childElements(section)
    .filter((child) => is(child, 'div', 'tile'))
    .flatMap((tile) => tileOf(tile, metrics, agents))
    .slice(0, tilesPerBlock);
  return tiles.length === 0 ? undefined : { kind: 'tiles', tiles };
};

/** The sample page's figures: a term and a placeholder its script filled in. */
const sampleValue = (
  value: HtmlElement,
  metrics: DayMetrics | null,
): TileValue | undefined => {
  const minutes = attributeOf(value, 'data-minutes');
  const count = attributeOf(value, 'data-count');
  if (minutes !== undefined) {
    return droppedFields.has(minutes)
      ? undefined
      : metricValue(metrics, minutes);
  }
  if (count !== undefined) {
    return metricValue(metrics, count);
  }
  if (!value.attributes.has('data-mail')) {
    return undefined;
  }
  const counts = metrics?.sentMails.map((mailbox) => mailbox.count) ?? [];
  return counts.length === 0 || counts.includes(null)
    ? null
    : { count: counts.reduce((sum: number, sent) => sum + (sent ?? 0), 0) };
};

/** The sample page's first and last activity, as /wrap now notes them. */
const activitySpanNote = (
  list: HtmlElement,
  metrics: DayMetrics | null,
): RichText | undefined => {
  const first = metrics?.firstActivityAt;
  const last = metrics?.lastActivityAt;
  const shown = descendants(list).some((element) =>
    element.attributes.has('data-span'),
  );
  return shown && typeof first === 'string' && typeof last === 'string'
    ? [`From ${berlinClock(first)} to ${berlinClock(last)}`]
    : undefined;
};

export const sampleTilesBlockOf = (
  list: HtmlElement,
  metrics: DayMetrics | null,
): TilesBlock | undefined => {
  const spanNote = activitySpanNote(list, metrics);
  const tiles = descendants(list).flatMap((term): ReadonlyArray<Tile> => {
    if (term.tag !== 'dt') {
      return [];
    }
    const label = labelOf(textOf(term));
    const siblings = childElements(
      descendants(list).find((parent) => parent.children.includes(term)) ??
        list,
    );
    const value = siblings[siblings.indexOf(term) + 1];
    const read = value === undefined ? undefined : sampleValue(value, metrics);
    if (label === undefined || read === undefined) {
      return [];
    }
    const active =
      value !== undefined &&
      attributeOf(value, 'data-minutes') === 'activeMinutes';
    return [
      {
        label,
        value: read,
        ...(active && spanNote !== undefined ? { note: spanNote } : {}),
      },
    ];
  });
  return tiles.length === 0 ? undefined : { kind: 'tiles', tiles };
};
