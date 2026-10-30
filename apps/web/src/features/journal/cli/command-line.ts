/**
 * The `postlude` command line: from the words an agent typed to one command.
 *
 * Over SSH the words arrive as a single line in `SSH_ORIGINAL_COMMAND`, the way
 * the client's shell would have quoted them, so `splitShellWords` takes them
 * apart by the same rules: single quotes, double quotes, and backslashes. It
 * never runs a shell, and nothing it reads is ever given to one.
 */

import { Schema } from 'effect';

import { JournalDateSchema } from '../schemas/entry.ts';
import { searchQueryLengthLimit } from '../search-contract.ts';

export const searchLimitDefault = 20;
export const searchLimitMax = 50;

export type CliCommand =
  | { readonly kind: 'help' }
  | { readonly kind: 'day-get'; readonly date: string }
  | { readonly kind: 'days-list'; readonly from: string; readonly to: string }
  | { readonly kind: 'search'; readonly query: string; readonly limit: number }
  | { readonly kind: 'agent-area-get'; readonly date: string }
  | { readonly kind: 'agent-area-put'; readonly date: string };

export const usage = [
  'day get <date>',
  'days list --from <date> --to <date>',
  `search <query> [--limit <1-${searchLimitMax}>]`,
  'agent-area get <date>',
  'agent-area put <date>   (reads {dayMetrics, metricsVersion, reportHtml, reportModel} as JSON on stdin)',
] as const;

/** The command line could not be read as a command; the message says why. */
export class UsageError extends Schema.TaggedError<UsageError>()('UsageError', {
  message: Schema.String,
}) {}

const usageError = (message: string) => new UsageError({ message });

/**
 * One piece of a shell line, matched where the previous one ended: blanks
 * between words, a backslash before a newline, which joins two lines, or a
 * part of a word.
 */
const shellPiece = () =>
  /(?<blank>[ \t\n]+)|(?<continuation>\\\n)|'(?<single>[^']*)'|"(?<double>(?:[^"\\]|\\[\s\S])*)"|\\(?<escaped>[\s\S])|(?<plain>[^ \t\n'"\\]+)/uy;

/** Inside double quotes a backslash escapes only these; before a newline it removes both. */
const doubleQuoteEscape = /\\(?<escaped>[\\"$`\n])/gu;

type ShellPiece = {
  readonly blank?: string;
  readonly continuation?: string;
  readonly single?: string;
  readonly double?: string;
  readonly escaped?: string;
  readonly plain?: string;
};

const wordPartOf = ({ single, double, escaped, plain }: ShellPiece) =>
  single ??
  escaped ??
  plain ??
  (double ?? '').replace(doubleQuoteEscape, (_match, character: string) =>
    character === '\n' ? '' : character,
  );

/** Splits a line into words as a POSIX shell would, without expanding anything. */
export const splitShellWords = (line: string): Array<string> | UsageError => {
  const words: Array<string> = [];
  const pieces = shellPiece();
  let word: string | undefined;
  while (pieces.lastIndex < line.length) {
    const at = pieces.lastIndex;
    const piece: ShellPiece | undefined = pieces.exec(line)?.groups;
    if (piece === undefined) {
      // Only an unclosed quote or a final backslash matches nothing.
      return usageError(
        line.charAt(at) === '\\'
          ? 'The command line ends in a backslash.'
          : 'The command line has a quote that is never closed.',
      );
    }
    if (piece.blank !== undefined && word !== undefined) {
      words.push(word);
      word = undefined;
    } else if (piece.blank === undefined && piece.continuation === undefined) {
      word = (word ?? '') + wordPartOf(piece);
    }
  }
  if (word !== undefined) {
    words.push(word);
  }
  return words;
};

const isDate = Schema.is(JournalDateSchema);

type Parsed = {
  readonly positional: ReadonlyArray<string>;
  readonly options: ReadonlyMap<string, string>;
};

/**
 * Reads the option at `index`, `--name value` or `--name=value`, into
 * `options`, and returns the index of the word after it.
 */
const readOption = (
  words: ReadonlyArray<string>,
  index: number,
  known: ReadonlyArray<string>,
  options: Map<string, string>,
): number | UsageError => {
  const word = words[index] ?? '';
  const equals = word.indexOf('=');
  const name = equals === -1 ? word.slice(2) : word.slice(2, equals);
  if (!known.includes(name)) {
    return usageError(`Unknown option --${name}.`);
  }
  if (options.has(name)) {
    return usageError(`--${name} is given twice.`);
  }
  const value = equals === -1 ? words[index + 1] : word.slice(equals + 1);
  if (value === undefined) {
    return usageError(`--${name} needs a value.`);
  }
  options.set(name, value);
  return equals === -1 ? index + 2 : index + 1;
};

/** Separates the options from the other words; `--` ends the options. */
const parseOptions = (
  words: ReadonlyArray<string>,
  known: ReadonlyArray<string>,
): Parsed | UsageError => {
  const positional: Array<string> = [];
  const options = new Map<string, string>();
  let index = 0;
  while (index < words.length) {
    const word = words[index] ?? '';
    if (word === '--') {
      positional.push(...words.slice(index + 1));
      index = words.length;
    } else if (word.startsWith('--')) {
      const next = readOption(words, index, known, options);
      if (next instanceof UsageError) {
        return next;
      }
      index = next;
    } else {
      positional.push(word);
      index += 1;
    }
  }
  return { positional, options };
};

const dateArgument = (
  value: string | undefined,
  name: string,
): string | UsageError => {
  if (value === undefined) {
    return usageError(`Give the ${name} as YYYY-MM-DD.`);
  }
  return isDate(value)
    ? value
    : usageError(`${value} is not a date of the form YYYY-MM-DD.`);
};

const oneDate = (
  kind: 'day-get' | 'agent-area-get' | 'agent-area-put',
  words: ReadonlyArray<string>,
): CliCommand | UsageError => {
  const parsed = parseOptions(words, []);
  if (parsed instanceof UsageError) {
    return parsed;
  }
  if (parsed.positional.length > 1) {
    return usageError('Give exactly one date.');
  }
  const date = dateArgument(parsed.positional[0], 'date');
  return date instanceof UsageError ? date : { kind, date };
};

const daysList = (words: ReadonlyArray<string>): CliCommand | UsageError => {
  const parsed = parseOptions(words, ['from', 'to']);
  if (parsed instanceof UsageError) {
    return parsed;
  }
  if (parsed.positional.length > 0) {
    return usageError('days list takes only --from and --to.');
  }
  const from = dateArgument(parsed.options.get('from'), '--from date');
  if (from instanceof UsageError) {
    return from;
  }
  const to = dateArgument(parsed.options.get('to'), '--to date');
  return to instanceof UsageError ? to : { kind: 'days-list', from, to };
};

const search = (words: ReadonlyArray<string>): CliCommand | UsageError => {
  const parsed = parseOptions(words, ['limit']);
  if (parsed instanceof UsageError) {
    return parsed;
  }
  const query = parsed.positional.join(' ').trim();
  if (query === '') {
    return usageError('Give something to search for.');
  }
  if (query.length > searchQueryLengthLimit) {
    return usageError(
      `Search for at most ${searchQueryLengthLimit} characters at a time.`,
    );
  }
  const limitText = parsed.options.get('limit');
  const limit =
    limitText === undefined ? searchLimitDefault : Number(limitText);
  if (!Number.isInteger(limit) || limit < 1 || limit > searchLimitMax) {
    return usageError(
      `--limit must be a whole number from 1 to ${searchLimitMax}.`,
    );
  }
  return { kind: 'search', query, limit };
};

/** Reads the words after `postlude` as one command. */
export const parseCommand = (
  words: ReadonlyArray<string>,
): CliCommand | UsageError => {
  const [group, action, ...rest] = words;
  if (
    group === undefined ||
    group === 'help' ||
    group === '--help' ||
    group === '-h'
  ) {
    return { kind: 'help' };
  }
  if (group === 'search') {
    return search(words.slice(1));
  }
  const name = `${group} ${action ?? ''}`.trim();
  switch (name) {
    case 'day get':
      return oneDate('day-get', rest);
    case 'days list':
      return daysList(rest);
    case 'agent-area get':
      return oneDate('agent-area-get', rest);
    case 'agent-area put':
      return oneDate('agent-area-put', rest);
    default:
      return usageError(`Unknown command: ${name}. Run "postlude help".`);
  }
};
