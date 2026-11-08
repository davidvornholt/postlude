import { describe, expect, it } from 'bun:test';
import { runSessionRequired } from '#/shared/auth/session-required.ts';

import {
  authenticationSaveMessage,
  autosaveFailureOf,
} from './autosave-error.ts';
import { journalWriteConflictMessage } from './errors/journal-errors.ts';

describe('autosave failure boundary', () => {
  it('recognizes an ended sign-in', () => {
    expect(autosaveFailureOf(new Response('', { status: 401 }))).toEqual({
      kind: 'authentication',
      message: authenticationSaveMessage,
    });
  });

  it('does not carry an unknown server message to the page', () => {
    const failure = autosaveFailureOf(
      new Error('password leaked in a database error'),
    );

    expect(failure.kind).toBe('network');
    expect(failure.message).not.toContain('password');
    expect(failure.message).toContain('check your connection');
  });

  it('classifies a compare-and-swap conflict without calling it saved', () => {
    expect(
      autosaveFailureOf(
        new Error(`FiberFailure: ${journalWriteConflictMessage}`),
      ),
    ).toEqual({
      kind: 'conflict',
      message: journalWriteConflictMessage,
    });
  });
});

it('recognizes an expired session from the server-function error boundary', async () => {
  const failure = await runSessionRequired({
    transport: 'server-function',
    authorize: () => Promise.resolve(false),
    next: () => Promise.reject(new Error('must not run')),
    publishHeaders: () => undefined,
    publishStatus: () => undefined,
  }).catch((error: unknown) => error);
  expect(autosaveFailureOf(failure)).toEqual({
    kind: 'authentication',
    message: authenticationSaveMessage,
  });
});
