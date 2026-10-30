import { describe, expect, it } from 'bun:test';

import {
  parseCommand,
  searchLimitDefault,
  splitShellWords,
  UsageError,
} from './command-line.ts';

const commandOf = (line: string) => {
  const words = splitShellWords(line);
  return words instanceof UsageError ? words : parseCommand(words);
};

describe('splitting a command line', () => {
  it('splits on runs of whitespace', () => {
    expect(splitShellWords('  day   get\t2026-10-09 ')).toEqual([
      'day',
      'get',
      '2026-10-09',
    ]);
  });

  it('keeps single-quoted text literal', () => {
    expect(splitShellWords(`search 'a "b" $c \\d'`)).toEqual([
      'search',
      'a "b" $c \\d',
    ]);
  });

  it('reads the quoting that bash @Q expansion produces', () => {
    expect(splitShellWords(`'search' 'it'\\''s late'`)).toEqual([
      'search',
      "it's late",
    ]);
  });

  it('unescapes only what a shell unescapes in double quotes', () => {
    expect(splitShellWords(`search "a \\"b\\" \\n \\$"`)).toEqual([
      'search',
      'a "b" \\n $',
    ]);
  });

  it('keeps an empty quoted word', () => {
    expect(splitShellWords(`search ''`)).toEqual(['search', '']);
  });

  it('expands nothing', () => {
    expect(splitShellWords('search $(id) `id` ~ *')).toEqual([
      'search',
      '$(id)',
      '`id`',
      '~',
      '*',
    ]);
  });

  it('refuses an unclosed quote or a trailing backslash', () => {
    expect(splitShellWords(`search 'open`)).toBeInstanceOf(UsageError);
    expect(splitShellWords('search open\\')).toBeInstanceOf(UsageError);
  });
});

describe('reading a command', () => {
  it('reads each command', () => {
    expect(commandOf('day get 2026-10-09')).toEqual({
      kind: 'day-get',
      date: '2026-10-09',
    });
    expect(commandOf('days list --from 2026-10-01 --to=2026-10-09')).toEqual({
      kind: 'days-list',
      from: '2026-10-01',
      to: '2026-10-09',
    });
    expect(commandOf('agent-area get 2026-10-30')).toEqual({
      kind: 'agent-area-get',
      date: '2026-10-30',
    });
    expect(commandOf('agent-area put 2026-10-30')).toEqual({
      kind: 'agent-area-put',
      date: '2026-10-30',
    });
  });

  it('shows help when asked, or when given nothing', () => {
    expect(commandOf('')).toEqual({ kind: 'help' });
    expect(commandOf('help')).toEqual({ kind: 'help' });
    expect(commandOf('--help')).toEqual({ kind: 'help' });
  });

  it('joins the words of a search, with a default limit', () => {
    expect(commandOf("search 'grace and' peace")).toEqual({
      kind: 'search',
      query: 'grace and peace',
      limit: searchLimitDefault,
    });
    expect(commandOf('search --limit 5 peace')).toEqual({
      kind: 'search',
      query: 'peace',
      limit: 5,
    });
    expect(commandOf('search -- --limit')).toEqual({
      kind: 'search',
      query: '--limit',
      limit: searchLimitDefault,
    });
  });

  it('refuses a limit out of range', () => {
    expect(commandOf('search peace --limit 0')).toBeInstanceOf(UsageError);
    expect(commandOf('search peace --limit 51')).toBeInstanceOf(UsageError);
    expect(commandOf('search peace --limit 2.5')).toBeInstanceOf(UsageError);
  });

  it('refuses an empty or overlong search', () => {
    expect(commandOf("search ''")).toBeInstanceOf(UsageError);
    expect(commandOf(`search ${'a'.repeat(201)}`)).toBeInstanceOf(UsageError);
  });

  it('refuses dates that are not calendar dates', () => {
    expect(commandOf('day get 2026-02-30')).toBeInstanceOf(UsageError);
    expect(commandOf('day get today')).toBeInstanceOf(UsageError);
    expect(commandOf('day get')).toBeInstanceOf(UsageError);
    expect(commandOf('days list --from 2026-10-01')).toBeInstanceOf(UsageError);
  });

  it('refuses extra words and unknown options', () => {
    expect(commandOf('day get 2026-10-09 2026-10-10')).toBeInstanceOf(
      UsageError,
    );
    expect(commandOf('day get 2026-10-09 --note')).toBeInstanceOf(UsageError);
    expect(
      commandOf(
        'days list --from 2026-10-01 --from 2026-10-02 --to 2026-10-09',
      ),
    ).toBeInstanceOf(UsageError);
  });

  it('refuses commands it does not have', () => {
    expect(commandOf('entry put 2026-10-09')).toBeInstanceOf(UsageError);
    expect(commandOf('agent-area delete 2026-10-09')).toBeInstanceOf(
      UsageError,
    );
    expect(commandOf('sh')).toBeInstanceOf(UsageError);
  });
});
