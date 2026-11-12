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
import {
  reportDocumentBytes,
  type WrapPut,
  WrapPutSchema,
} from '../schemas/agent-area.ts';
import {
  reportBlockKinds,
  unknownBlockKinds,
} from '../schemas/day-report-blocks.ts';
import { emptyJournalEntry } from '../schemas/entry.ts';
import { formatScriptureReference } from '../scripture-reference.ts';
import { searchHitOf } from '../search-contract.ts';
import { searchTerms } from '../search-query.ts';
import {
  AgentAreaRepository,
  metricsDayMismatchMessage,
} from '../services/agent-area-repository.ts';
import { DayRatingRepository } from '../services/day-rating-repository.ts';
import { EntryRepository } from '../services/entry-repository.ts';
import { EntrySearch } from '../services/entry-search.ts';
import { type CliCommand, UsageError, usage } from './command-line.ts';

/**
 * The most stdin `agent-area put` and `check` read, 4 MiB: a full report and
 * the metrics beside it.
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const inputError = (message: string) => new CliInputError({ message });

/**
 * Parses what `agent-area put` or `check` was given on stdin, for `date`.
 *
 * A block of a kind this Postlude doesn't draw is named on its own, with the
 * kinds it does; the schema alone would say only that the block matches none
 * of them. Every other way the input is wrong is listed with where it is.
 */
const wrapPutOf = (date: string, stdin: string) =>
  Effect.gen(function* () {
    const json = yield* Effect.try({
      try: (): unknown => JSON.parse(stdin),
      catch: () => inputError('stdin is not a JSON document.'),
    });
    const unknown = isRecord(json)
      ? unknownBlockKinds(json.reportDocument)
      : [];
    if (unknown.length > 0) {
      return yield* inputError(
        `reportDocument has blocks this Postlude doesn't draw: ${unknown.join('; ')}. It draws ${reportBlockKinds.join(', ')}.`,
      );
    }
    const input = yield* decodePut(json, {
      onExcessProperty: 'error',
      errors: 'all',
    }).pipe(
      Effect.mapError((error) =>
        inputError(
          `stdin does not match the agent-area input: ${error.message}`,
        ),
      ),
    );
    if (input.dayMetrics.day !== date) {
      return yield* new JournalValidationError({
        message: metricsDayMismatchMessage,
      });
    }
    return input;
  });

/** What `check` says of input `put` would store. */
const checked = (date: string, input: WrapPut) => ({
  date,
  valid: true,
  metricsVersion: input.metricsVersion,
  reportDocumentVersion: input.reportDocument.version,
  reportDocumentBytes: reportDocumentBytes(input.reportDocument),
});

/**
 * `agent-area check`: reads the input `put` would, and says whether `put`
 * would take it, without storing anything or reaching the database.
 */
export const checkWrap = <E>(
  date: string,
  readStdin: Effect.Effect<string, E>,
) =>
  readStdin.pipe(
    Effect.flatMap((stdin) => wrapPutOf(date, stdin)),
    Effect.map((input) => checked(date, input)),
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
      scriptureTopic: entry.scriptureTopic ?? null,
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
    case 'days-changed':
      return EntryRepository.pipe(
        Effect.flatMap((entries) => entries.listChangedSince(command.since)),
        Effect.map((days) => ({ since: command.since, days })),
      );
    case 'search':
      return search(command.query, command.limit);
    case 'agent-area-get':
      return AgentAreaRepository.pipe(
        Effect.flatMap((areas) => areas.readWrap(command.date)),
      );
    case 'agent-area-check':
      return checkWrap(command.date, readStdin);
    case 'agent-area-put':
      return Effect.gen(function* () {
        const stdin = yield* readStdin;
        const input = yield* wrapPutOf(command.date, stdin);
        const areas = yield* AgentAreaRepository;
        const stored = yield* areas.putWrap(command.date, input);
        // The report goes in but doesn't come back out: it can be a megabyte.
        const { reportDocument, reportHtml: _page, ...rest } = stored;
        return {
          ...rest,
          reportDocumentBytes: reportDocumentBytes(reportDocument),
        };
      });
    default:
      return Effect.succeed(helpOutput());
  }
};
