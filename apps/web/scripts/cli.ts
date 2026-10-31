/**
 * `postlude`: the journal's command line for agents.
 *
 * On prod-1 it runs in the current release's image, started by the
 * `postlude-agent` SSH door, which connects it to the database as the
 * `postlude_agent` role. The door passes the command the agent typed as
 * `SSH_ORIGINAL_COMMAND`; run directly, the CLI reads its arguments instead.
 *
 * It prints one JSON document on stdout and exits 0, or prints
 * `{"error":{"code","message"}}` on stderr and exits 1. Nothing else is
 * written to either, so an agent can parse what it gets.
 *
 * `skills/postlude/SKILL.md` documents each command for agents.
 */

import process from 'node:process';
import { pgClientLayer } from '@postlude/db/connections';
import { Cause, Effect, Layer, References } from 'effect';
import {
  CliInputError,
  cliFailureOf,
  helpOutput,
  runCliCommand,
  stdinByteLimit,
} from '../src/features/journal/cli/cli-program.ts';
import {
  parseCommand,
  splitShellWords,
  UsageError,
} from '../src/features/journal/cli/command-line.ts';
import { JournalReadError } from '../src/features/journal/errors/journal-errors.ts';
import { AgentAreaRepository } from '../src/features/journal/services/agent-area-repository.ts';
import { DayRatingRepository } from '../src/features/journal/services/day-rating-repository.ts';
import { EntryRepository } from '../src/features/journal/services/entry-repository.ts';
import { EntrySearch } from '../src/features/journal/services/entry-search.ts';

class StdinTooLarge extends Error {}

const readStdin = Effect.tryPromise({
  try: async () => {
    const chunks: Array<Uint8Array> = [];
    let size = 0;
    for await (const chunk of Bun.stdin.stream()) {
      size += chunk.byteLength;
      if (size > stdinByteLimit) {
        throw new StdinTooLarge();
      }
      chunks.push(chunk);
    }
    return new TextDecoder('utf-8', { fatal: true }).decode(
      Buffer.concat(chunks),
    );
  },
  catch: (error) =>
    new CliInputError({
      message:
        error instanceof StdinTooLarge
          ? `stdin is larger than ${stdinByteLimit} bytes.`
          : 'stdin could not be read as UTF-8 text.',
    }),
});

const commandWords = (): ReadonlyArray<string> | UsageError => {
  const line = Bun.env.SSH_ORIGINAL_COMMAND;
  return line === undefined ? Bun.argv.slice(2) : splitShellWords(line);
};

const program = Effect.gen(function* () {
  const words = commandWords();
  if (words instanceof UsageError) {
    return yield* words;
  }
  const command = parseCommand(words);
  if (command instanceof UsageError) {
    return yield* command;
  }
  if (command.kind === 'help') {
    return helpOutput();
  }
  const databaseUrl = Bun.env.DATABASE_URL;
  if (databaseUrl === undefined || databaseUrl === '') {
    return yield* new JournalReadError({
      message: 'DATABASE_URL is not set, so the journal cannot be reached.',
      cause: undefined,
    });
  }
  const services = Layer.provide(
    Layer.mergeAll(
      EntryRepository.layer,
      EntrySearch.layer,
      DayRatingRepository.layer,
      AgentAreaRepository.layer,
    ),
    pgClientLayer(databaseUrl),
  );
  return yield* runCliCommand(command, readStdin).pipe(
    Effect.provide(services),
    Effect.mapError((error) =>
      error._tag === 'SqlError'
        ? new JournalReadError({
            message: 'The journal could not be reached.',
            cause: error,
          })
        : error,
    ),
  );
});

const exit = await Effect.runPromiseExit(
  program.pipe(Effect.provideService(References.MinimumLogLevel, 'None')),
);

if (exit._tag === 'Success') {
  process.stdout.write(`${JSON.stringify(exit.value, null, 2)}\n`);
} else {
  const error = Cause.findErrorOption(exit.cause);
  const failure = cliFailureOf(error._tag === 'Some' ? error.value : undefined);
  process.stderr.write(`${JSON.stringify(failure)}\n`);
  if (Bun.env.POSTLUDE_CLI_DEBUG === '1') {
    process.stderr.write(`${Cause.pretty(exit.cause)}\n`);
  }
  process.exitCode = 1;
}
