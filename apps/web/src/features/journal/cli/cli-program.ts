/**
 * What each `postlude` command does, as the JSON it prints.
 *
 * The CLI connects as `postlude_agent`, so every query here stays inside that
 * role's grants: it reads entries, ratings, and the /wrap columns, and writes
 * only the /wrap columns. The agent note and the report are never part of a
 * day's output; the report is read on its own, through `agent-area get`.
 */

import { Effect, Schema } from 'effect';

import {
  JournalReadError,
  JournalValidationError,
  JournalWriteError,
} from '../errors/journal-errors.ts';
import { WrapPutSchema } from '../schemas/agent-area.ts';
import { emptyJournalEntry } from '../schemas/entry.ts';
import { formatScriptureReference } from '../scripture-reference.ts';
import { searchHitOf } from '../search-contract.ts';
import { searchTerms } from '../search-query.ts';
import { AgentAreaRepository } from '../services/agent-area-repository.ts';
import { DayRatingRepository } from '../services/day-rating-repository.ts';
import { EntryRepository } from '../services/entry-repository.ts';
import { EntrySearch } from '../services/entry-search.ts';
import { type CliCommand, UsageError, usage } from './command-line.ts';

/**
 * The most stdin `agent-area put` reads, 4 MiB: a full report, JSON-escaped,
 * and the metrics beside it.
 */
export const stdinByteLimit = 4_194_304;

/** Why a command failed, as the `code` an agent can branch on. */
export type CliErrorCode =
  | 'usage'
  | 'invalid_input'
  | 'refused'
  | 'unavailable'
  | 'internal';

export class CliInputError extends Schema.TaggedError<CliInputError>()(
  'CliInputError',
  { message: Schema.String },
) {}

export type CliFailure = {
  readonly error: { readonly code: CliErrorCode; readonly message: string };
};

export const cliFailureOf = (error: unknown): CliFailure => {
  const failure = (code: CliErrorCode, message: string): CliFailure => ({
    error: { code, message },
  });
  if (error instanceof UsageError) {
    return failure('usage', error.message);
  }
  if (error instanceof CliInputError) {
    return failure('invalid_input', error.message);
  }
  if (error instanceof JournalValidationError) {
    return failure('refused', error.message);
  }
  if (error instanceof JournalReadError || error instanceof JournalWriteError) {
    return failure('unavailable', error.message);
  }
  return failure('internal', 'The command failed unexpectedly.');
};

export type CliServices =
  | EntryRepository
  | EntrySearch
  | DayRatingRepository
  | AgentAreaRepository;

export type CliCommandError =
  | CliInputError
  | JournalReadError
  | JournalWriteError
  | JournalValidationError;

const decodePut = Schema.decodeUnknownEffect(WrapPutSchema);

/** Parses what `agent-area put` was given on stdin. */
const wrapPutOf = (stdin: string) =>
  Effect.try({
    try: (): unknown => JSON.parse(stdin),
    catch: () =>
      new CliInputError({ message: 'stdin is not a JSON document.' }),
  }).pipe(
    Effect.flatMap((json) =>
      decodePut(json, { onExcessProperty: 'error' }).pipe(
        Effect.mapError(
          (error) =>
            new CliInputError({
              message: `stdin does not match the agent-area input: ${error.message}`,
            }),
        ),
      ),
    ),
  );

const dayGet = (date: string) =>
  Effect.gen(function* () {
    const entries = yield* EntryRepository;
    const ratings = yield* DayRatingRepository;
    const [stored, rating] = yield* Effect.all([
      entries.read(date),
      ratings.read(date),
    ]);
    const entry = stored ?? emptyJournalEntry(date);
    return {
      date,
      revision: entry.revision,
      journalMarkdown: entry.journalMarkdown,
      journalWordCount: entry.journalWordCount,
      scriptureReference:
        entry.scriptureReference === undefined
          ? null
          : formatScriptureReference(entry.scriptureReference),
      scriptureMarkdown: entry.scriptureMarkdown,
      scriptureWordCount: entry.scriptureWordCount,
      rating: {
        energy: rating.energy,
        progress: rating.progress,
        repeatDay: rating.repeatDay,
        ratingVersion: rating.ratingVersion,
      },
      closedAt: rating.closedAt,
      updatedAt: stored === undefined ? null : stored.updatedAt,
    };
  });

const search = (query: string, limit: number) =>
  Effect.gen(function* () {
    const terms = searchTerms(query);
    if (terms.length === 0) {
      return { query, terms, limited: false, hits: [] };
    }
    const entrySearch = yield* EntrySearch;
    const matches = yield* entrySearch.search(terms, limit);
    return {
      query,
      terms,
      limited: matches.length === limit,
      hits: matches.map(searchHitOf).map((hit) => ({
        date: hit.date,
        words: hit.words,
        sources: hit.sources.map((source) => ({
          source: source.kind,
          snippets: source.excerpts.map((segments) =>
            segments.map((segment) => segment.text).join(''),
          ),
        })),
      })),
    };
  });

/** What `postlude help`, or `postlude` alone, prints. */
export const helpOutput = () => ({
  usage: usage.map((line) => `postlude ${line}`),
});

/**
 * Runs one command. `readStdin` is called only by the command that reads
 * stdin, so the others never wait on an input nobody sends.
 */
export const runCliCommand = <E>(
  command: CliCommand,
  readStdin: Effect.Effect<string, E>,
): Effect.Effect<unknown, E | CliCommandError, CliServices> => {
  switch (command.kind) {
    case 'day-get':
      return dayGet(command.date);
    case 'days-list':
      return AgentAreaRepository.pipe(
        Effect.flatMap((areas) => areas.listDays(command.from, command.to)),
        Effect.map((days) => ({ from: command.from, to: command.to, days })),
      );
    case 'search':
      return search(command.query, command.limit);
    case 'agent-area-get':
      return AgentAreaRepository.pipe(
        Effect.flatMap((areas) => areas.readWrap(command.date)),
      );
    case 'agent-area-put':
      return Effect.gen(function* () {
        const input = yield* readStdin.pipe(Effect.flatMap(wrapPutOf));
        const areas = yield* AgentAreaRepository;
        const stored = yield* areas.putWrap(command.date, input);
        // The report goes in but doesn't come back out: it can be a megabyte.
        const { reportHtml, ...rest } = stored;
        return {
          ...rest,
          reportHtmlBytes: new TextEncoder().encode(reportHtml ?? '')
            .byteLength,
        };
      });
    default:
      return Effect.succeed(helpOutput());
  }
};
