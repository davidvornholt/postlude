import { expect, it } from 'bun:test';
import { searchUnavailableMessage } from '../search-contract.ts';
import { searchFailureKind, searchTransportBoundary } from './search-errors.ts';

it('removes internal causes before a search failure reaches transport', async () => {
  const internal = new Error(
    'password=database-secret select * from private_entry',
  );
  internal.cause = { connectionString: 'postgres://private-credential' };

  const failure = await searchTransportBoundary(Promise.reject(internal)).catch(
    (error: unknown) => error,
  );
  const transported = JSON.stringify(structuredClone(failure));

  expect(failure).toMatchObject({
    _tag: 'SearchUnavailableError',
    message: searchUnavailableMessage,
  });
  expect(failure).not.toBeInstanceOf(Error);
  expect(Object.keys(failure as object).sort()).toEqual(['_tag', 'message']);
  expect(transported).not.toContain('database-secret');
  expect(transported).not.toContain('private-credential');
  expect(transported).not.toContain('private_entry');
  expect(transported).not.toContain('cause');
});

it('recognizes an expired session only from its safe public status', () => {
  expect(
    searchFailureKind(new Response('Not authorized.', { status: 401 })),
  ).toBe('authentication');
  expect(searchFailureKind({ status: 403, private: 'must not be shown' })).toBe(
    'authentication',
  );
  expect(searchFailureKind(new Error('private database detail'))).toBe(
    'unavailable',
  );
});
