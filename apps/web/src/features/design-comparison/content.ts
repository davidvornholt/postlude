/**
 * The one journal day both comparison themes render, so the two directions are
 * judged on design rather than on different words.
 *
 * A journal day runs 04:00 to 04:00, so this is the evening half of Saturday
 * 22 August 2026: the morning's scripture section, already noted, and the
 * evening's writing.
 */

export type ScripturePassage = {
  readonly book: string;
  readonly chapter: number;
  readonly verses: string;
  readonly translation: string;
  readonly href: string;
  readonly notes: ReadonlyArray<string>;
};

export const scriptureReference = (passage: ScripturePassage): string =>
  `${passage.book} ${passage.chapter}:${passage.verses}`;

const whitespaceRun = /\s+/u;
/** Every position that has three digits, or a multiple of three, after it. */
const thousandsBoundary = /\B(?=(?:\d{3})+$)/gu;

/** Words as a person counts them: runs of non-whitespace. */
export const countWords = (text: string): number =>
  text.split(whitespaceRun).filter((word) => word.length > 0).length;

/**
 * Characters as code points rather than the UTF-16 units a string is stored
 * in, so a character outside the basic plane counts once here and twice in
 * `String.prototype.length`.
 */
export const countCharacters = (text: string): number =>
  Array.from(text).length;

/**
 * Digits grouped in threes, so a four-figure count reads at a glance. Written
 * out rather than left to `Intl.NumberFormat`, because the server rendering the
 * page and the browser hydrating it have to produce the same characters, and a
 * formatter only agrees if both resolve the same locale data.
 */
export const groupDigits = (value: number): string =>
  String(value).replace(thousandsBoundary, ',');

const journalParagraphs = [
  'Walked the long way to the allotments after lunch, past the yard where they are relaying the drain. The blackberries along the fence are two weeks early and mostly seeds, but there were enough good ones to fill the bottom of a paper cup. On the way back the yard was already backfilled and swept.',
  'Rang Dad about the car. He had booked it in for Tuesday before I called, and wanted to talk about the fence instead, so we talked about the fence for twenty minutes. He sounded better than last week. He was in the garden the whole call and kept putting the phone down to move something.',
  'The invoice I had been avoiding since Wednesday turned out to be for the deposit I paid in June. Ten minutes with the folder and it was closed. The thing itself took ten minutes; carrying it took three days. Worth remembering which of those two is the expensive part.',
  'Ate late with the window open and the kitchen light off. Grateful for cold water at the standpipe, for a father who would rather discuss a fence than his own week, and for a day that asked me to decide nothing.',
] as const;

export const sampleDay = {
  weekdayLabel: 'Saturday evening',
  dateLabel: '22 August 2026',
  autosaveState: 'Saved just now',
  scripture: {
    book: 'Proverbs',
    chapter: 12,
    verses: '5-13',
    translation: 'NeÜ',
    href: 'https://www.bibleserver.com/NeÜ/Proverbs12',
    notes: [
      'v.9 — better a nobody with a servant than a somebody with nothing to eat. The cost of looking capable.',
      'v.10 — the line about caring for your animals sits oddly among the courtroom verses. Measured where nobody is watching.',
      'v.13 — trapped by your own words. Reread the Monday email before it goes.',
    ],
  },
  journalParagraphs,
} as const satisfies {
  readonly weekdayLabel: string;
  readonly dateLabel: string;
  readonly autosaveState: string;
  readonly scripture: ScripturePassage;
  readonly journalParagraphs: ReadonlyArray<string>;
};

/** What the editor holds: the paragraphs as one document, blank line between. */
export const journalText = journalParagraphs.join('\n\n');
