/**
 * A made-up evening entry of about a given length, as the journal stores it:
 * Markdown, mostly paragraphs, now and then a heading, a list, a checklist or a
 * small table, because the reading view and the editor show each of those
 * differently and a preview should show them all.
 *
 * Everything is written the way the editor would save it, so opening a sample
 * day doesn't turn it into an edit.
 */

import { parseJournalDate } from '../journal-day.ts';
import { isWeekend } from './sample-clock.ts';
import {
  closingSentences,
  type EveningTopic,
  eveningTopics,
  inSeason,
  listItems,
} from './sample-evening-topics.ts';
import {
  between,
  chance,
  pick,
  type Random,
  shuffled,
} from './sample-random.ts';
import { fillTemplate, roughWordCount } from './sample-text.ts';

const headingWords = 350;
const headingChance = 0.4;
const checklistWords = 150;
const checklistChance = 0.25;
const goodThingsChance = 0.15;
const reminderChance = 0.2;
const tableWords = 300;
const tableChance = 0.05;
const closingChance = 0.8;
const tickedChance = 0.5;
const shortestRide = 8;
const longestRide = 42;
const keepChance = 0.7;
const shortestParagraph = 2;
const longestParagraph = 4;
const shortestList = 2;
const longestList = 4;
/** A pipe table's divider has at least three dashes per column. */
const narrowestColumn = 3;

const goodThings: ReadonlyArray<string> = [
  'der Kaffee mit Mira',
  'die Sonne am Nachmittag',
  'Leas Lachen beim Abendessen',
  'ein ruhiger Heimweg',
  'frisches Brot aus dem Ofen',
  'eine Stunde ohne Termine',
  'der Anruf von Oma Hilde',
  'ein aufgeräumter Schreibtisch',
];

const reminders: ReadonlyArray<string> = [
  'Nicht alles muss heute fertig werden.',
  'Erst fragen, dann planen.',
  'Pausen gehören zur Arbeit dazu.',
  'Kleine Schritte zählen auch.',
];

const weekdays = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag'];
const routes = ['Kanal', 'Deich', 'Stadtwald', 'Felder'];

const topicsFor = (random: Random, date: string) => {
  const { month } = parseJournalDate(date);
  const workday = !isWeekend(date);
  return shuffled(
    random,
    eveningTopics.filter(
      (topic) =>
        (topic.season === undefined || inSeason(topic.season, month)) &&
        (workday || topic.workdaysOnly !== true),
    ),
  );
};

/**
 * Some of a topic's sentences, in the order the topic tells them, split into
 * paragraphs of a few sentences each.
 */
const paragraphsOf = (
  random: Random,
  topic: EveningTopic,
): ReadonlyArray<string> => {
  const sentences = topic.sentences
    .filter(
      (_, index) => index < shortestParagraph || chance(random, keepChance),
    )
    .map((template) => fillTemplate(random, template));
  const paragraphs: Array<string> = [];
  while (sentences.length > 0) {
    const size =
      sentences.length <= longestParagraph
        ? sentences.length
        : between(random, shortestParagraph, longestParagraph);
    paragraphs.push(sentences.splice(0, size).join(' '));
  }
  return paragraphs;
};

const listOf = (random: Random, items: ReadonlyArray<string>) =>
  shuffled(random, items).slice(0, between(random, shortestList, longestList));

const checklist = (random: Random) =>
  [
    'Noch offen für {die Woche|morgen|das Wochenende}:',
    listOf(random, listItems)
      .map((item) => `- [${chance(random, tickedChance) ? 'x' : ' '}] ${item}`)
      .join('\n'),
  ]
    .map((block) => fillTemplate(random, block))
    .join('\n\n');

const goodThingsList = (random: Random) =>
  [
    'Gute Dinge heute:',
    listOf(random, goodThings)
      .map((item) => `- ${item}`)
      .join('\n'),
  ].join('\n\n');

/** A pipe table padded the way the editor pads one when it saves. */
export const markdownTable = (
  rows: ReadonlyArray<ReadonlyArray<string>>,
): string => {
  const [header, ...body] = rows;
  if (header === undefined) {
    return '';
  }
  const widths = header.map((_, column) =>
    Math.max(narrowestColumn, ...rows.map((row) => (row[column] ?? '').length)),
  );
  const line = (cells: ReadonlyArray<string>) =>
    `| ${cells.map((cell, column) => cell.padEnd(widths[column] ?? 0)).join(' | ')} |`;
  return [
    line(header),
    line(widths.map((width) => '-'.repeat(width))),
    ...body.map(line),
  ].join('\n');
};

const rideTable = (random: Random) =>
  [
    'Die Radwoche in Zahlen:',
    markdownTable([
      ['Tag', 'Strecke', 'Kilometer'],
      ...shuffled(random, weekdays)
        .slice(0, between(random, shortestList, longestList))
        .map((day) => [
          day,
          pick(random, routes),
          String(between(random, shortestRide, longestRide)),
        ]),
    ]),
  ].join('\n\n');

type Extras = {
  readonly headings: boolean;
  readonly blocks: ReadonlyArray<string>;
};

const extrasFor = (random: Random, targetWords: number): Extras => {
  const blocks: Array<string> = [];
  if (targetWords >= checklistWords && chance(random, checklistChance)) {
    blocks.push(checklist(random));
  }
  if (chance(random, goodThingsChance)) {
    blocks.push(goodThingsList(random));
  }
  if (chance(random, reminderChance)) {
    blocks.push(`**Merken:** ${pick(random, reminders)}`);
  }
  if (targetWords >= tableWords && chance(random, tableChance)) {
    blocks.push(rideTable(random));
  }
  return {
    headings: targetWords >= headingWords && chance(random, headingChance),
    blocks,
  };
};

/** About `targetWords` words of evening for `date`, in Markdown. */
export const sampleEvening = (
  random: Random,
  date: string,
  targetWords: number,
): string => {
  const extras = extrasFor(random, targetWords);
  const blocks: Array<string> = [];
  let words = 0;
  for (const topic of topicsFor(random, date)) {
    if (words >= targetWords) {
      break;
    }
    if (extras.headings) {
      blocks.push(`## ${topic.heading}`);
    }
    for (const paragraph of paragraphsOf(random, topic)) {
      if (words < targetWords) {
        blocks.push(paragraph);
        words += roughWordCount(paragraph);
      }
    }
  }
  blocks.push(...extras.blocks);
  if (chance(random, closingChance)) {
    blocks.push(fillTemplate(random, pick(random, closingSentences)));
  }
  return blocks.join('\n\n');
};
