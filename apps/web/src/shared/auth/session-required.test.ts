import { expect, it, mock } from 'bun:test';
import { ProtectedCallError } from './protected-call-error.ts';
import { runSessionRequired } from './session-required.ts';

const internalServerError = 500;

it('rejects SSR function storage failures with a vetted error that hides the cause', async () => {
  const publishStatus = mock((_status: number) => undefined);
  const failure = await runSessionRequired({
    transport: 'server-function',
    authorize: () => Promise.resolve(true),
    next: () => Promise.reject(new Error('private database detail')),
    publishHeaders: () => undefined,
    publishStatus,
  }).catch((error: unknown) => error);
  expect(failure).toBeInstanceOf(ProtectedCallError);
  expect(failure).toMatchObject({
    message: 'The journal request could not be completed.',
    status: internalServerError,
  });
  expect(publishStatus).toHaveBeenCalledWith(internalServerError);
});

it('retains public authentication status for browser recovery without running the operation', async () => {
  const next = mock(() => Promise.resolve('private result'));
  const failure = await runSessionRequired({
    transport: 'server-function',
    authorize: () => Promise.resolve(false),
    next,
    publishHeaders: () => undefined,
    publishStatus: () => undefined,
  }).catch((error: unknown) => error);
  expect(failure).toBeInstanceOf(ProtectedCallError);
  expect(failure).toMatchObject({ message: 'Not authorized.', status: 401 });
  expect(next).not.toHaveBeenCalled();
});
