import { describe, expect, it } from 'bun:test';

import {
  authenticationSaveMessage,
  autosaveFailureOf,
} from './autosave-error.ts';
import { journalWriteConflictMessage } from './errors/journal-errors.ts';

describe('autosave failure boundary', () => {
  it('recognizes authentication and the one safe validation message', () => {
    expect(autosaveFailureOf(new Response('', { status: 401 }))).toEqual({
      kind: 'authentication',
      message: authenticationSaveMessage,
    });
    expect(
      autosaveFailureOf({
        message:
          'FiberFailure: Check the scripture reference and use a form such as Proverbs 12:5-13.',
      }),
    ).toEqual({
      kind: 'validation',
      field: 'scriptureReference',
      message:
        'Check the scripture reference and use a form such as Proverbs 12:5-13.',
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
