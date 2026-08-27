import { describe, expect, it } from 'bun:test';
import { defaultParseSearch, isNotFound } from '@tanstack/react-router';

import { Route } from './day.index.tsx';

const { beforeLoad, head, validateSearch } = Route.options;

if (
  typeof beforeLoad !== 'function' ||
  head === undefined ||
  typeof validateSearch !== 'function'
) {
  throw new Error('The native day form route is missing a tested boundary.');
}

const captureThrown = (run: () => unknown): unknown => {
  try {
    run();
    return undefined;
  } catch (error) {
    return error;
  }
};

const load = (date: unknown) =>
  captureThrown(() => {
    type BeforeLoadInput = Parameters<typeof beforeLoad>[0];
    const search = validateSearch({ date });
    beforeLoad({ search } as BeforeLoadInput);
  });

const loadQuery = (query: string) => {
  const search = defaultParseSearch(query);
  return captureThrown(() => {
    type BeforeLoadInput = Parameters<typeof beforeLoad>[0];
    beforeLoad({ search: validateSearch(search) } as BeforeLoadInput);
  });
};

describe('native day form route', () => {
  it('rejects year zero and malformed dates before redirecting', () => {
    expect(
      ['0000-01-01', '2026-02-30'].map((date) => isNotFound(load(date))),
    ).toEqual([true, true]);
  });

  it('redirects an empty form to today and a named day to its path', () => {
    expect(loadQuery('')).toMatchObject({ options: { to: '/' } });
    expect(loadQuery('?date=')).toMatchObject({ options: { to: '/' } });
    expect(load('2026-08-25')).toMatchObject({
      options: { params: { date: '2026-08-25' }, to: '/day/$date' },
    });
  });

  it('rejects every present non-string query instead of treating it as empty', () => {
    expect(
      [
        '?date=42',
        '?date=2026-08-25&date=2026-08-26',
        '?date=%7B%22value%22%3A1%7D',
      ].map((query) => isNotFound(loadQuery(query))),
    ).toEqual([true, true, true]);
  });

  it('uses useful metadata when the submitted date is not found', async () => {
    type HeadInput = Parameters<typeof head>[0];
    const metadata = await head({} as HeadInput);
    expect(metadata.meta).toContainEqual({
      title: 'Day not found · Postlude',
    });
  });
});
