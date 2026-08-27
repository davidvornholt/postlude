import { describe, expect, it } from 'bun:test';
import { isNotFound } from '@tanstack/react-router';

import { Route } from './day.index.tsx';

const { beforeLoad, head } = Route.options;

if (typeof beforeLoad !== 'function' || head === undefined) {
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

const load = (date: string | undefined) =>
  captureThrown(() => {
    type BeforeLoadInput = Parameters<typeof beforeLoad>[0];
    beforeLoad({ search: { date } } as BeforeLoadInput);
  });

describe('native day form route', () => {
  it('rejects year zero and malformed dates before redirecting', () => {
    expect(
      ['0000-01-01', '2026-02-30'].map((date) => isNotFound(load(date))),
    ).toEqual([true, true]);
  });

  it('redirects an empty form to today and a named day to its path', () => {
    expect(load('')).toMatchObject({ options: { to: '/' } });
    expect(load('2026-08-25')).toMatchObject({
      options: { params: { date: '2026-08-25' }, to: '/day/$date' },
    });
  });

  it('uses useful metadata when the submitted date is not found', async () => {
    type HeadInput = Parameters<typeof head>[0];
    const metadata = await head({} as HeadInput);
    expect(metadata.meta).toContainEqual({
      title: 'Day not found · Postlude',
    });
  });
});
