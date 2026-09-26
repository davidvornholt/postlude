import { expect, it, mock } from 'bun:test';
import { runSessionRequired } from './session-required.ts';

const internalServerError = 500;

it('keeps SSR function storage failures serializable without leaking the cause', async () => {
  const publishStatus = mock((_status: number) => undefined);
  const failure = await runSessionRequired({
    transport: 'server-function',
    authorize: () => Promise.resolve(true),
    next: () => Promise.reject(new Error('private database detail')),
    publishHeaders: () => undefined,
    publishStatus,
  }).catch((error: unknown) => error);
  expect(failure).toBeInstanceOf(Error);
  expect((failure as Error).message).toBe(
    'The journal request could not be completed.',
  );
  expect((failure as Error).cause).toBeUndefined();
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
  expect(failure).toBeInstanceOf(Error);
  expect(failure).toMatchObject({ message: 'Not authorized.', status: 401 });
  expect(next).not.toHaveBeenCalled();
});
