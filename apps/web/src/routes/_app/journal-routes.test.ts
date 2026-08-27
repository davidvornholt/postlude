import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test';
import { isNotFound, isRedirect } from '@tanstack/react-router';

import type { JournalEntry } from '#/features/journal/schemas/entry.ts';
import {
  isIsolatedBunTestProcess,
  runIsolatedBunTest,
} from '#/shared/testing/isolated-bun-test.ts';

const isRouteProbeProcess = isIsolatedBunTestProcess(import.meta.dir);

type JournalDay = {
  readonly entry: JournalEntry;
  readonly today: JournalEntry['date'];
  readonly anniversaries: ReadonlyArray<never>;
};

const today = '2026-08-26';

const entryOn = (date: JournalEntry['date']): JournalEntry => ({
  date,
  journalMarkdown: '',
  journalWordCount: 0,
  journalFirstUsedAt: null,
  scriptureMarkdown: '',
  scriptureWordCount: 0,
  revision: 0,
  scriptureFirstUsedAt: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
});

let loadedDay: JournalDay = { entry: entryOn(today), today, anniversaries: [] };
let datedDisposition: 'readable' | 'today' | 'future' = 'readable';
let datedReadInputs: ReadonlyArray<unknown> = [];
let todayReadCount = 0;

if (isRouteProbeProcess) {
  mock.module('#/features/journal/services/journal-fns.ts', () => ({
    readDatedJournalDay: (input: unknown) => {
      datedReadInputs = [...datedReadInputs, input];
      return Promise.resolve(
        datedDisposition === 'readable'
          ? { disposition: 'readable', view: loadedDay }
          : { disposition: datedDisposition },
      );
    },
    readTodayJournalDay: () => {
      todayReadCount += 1;
      return Promise.resolve(loadedDay);
    },
    saveDraft: () => Promise.reject(new Error('A route test does not save.')),
  }));
}

beforeEach(() => {
  if (!isRouteProbeProcess) {
    return;
  }
  loadedDay = { entry: entryOn(today), today, anniversaries: [] };
  datedDisposition = 'readable';
  datedReadInputs = [];
  todayReadCount = 0;
});

afterAll(() => {
  if (isRouteProbeProcess) {
    mock.restore();
  }
});

const { Route: dayRoute } = await import('./day.$date.tsx');
const { Route: indexRoute } = await import('./index.tsx');

const {
  head: dayHead,
  loader: dayLoader,
  params: dayParams,
} = dayRoute.options;
const { head: indexHead, loader: indexLoader } = indexRoute.options;

if (
  dayParams === undefined ||
  typeof dayParams === 'function' ||
  dayParams.parse === undefined ||
  typeof dayLoader !== 'function' ||
  dayHead === undefined ||
  typeof indexLoader !== 'function' ||
  indexHead === undefined
) {
  throw new Error('The journal routes are missing a tested boundary.');
}

const parseDay = dayParams.parse;

const loadDay = (date: string) => {
  type LoaderInput = Parameters<typeof dayLoader>[0];
  return dayLoader({ params: { date } } as LoaderInput);
};

const captureThrown = (run: () => unknown): unknown => {
  try {
    run();
    return undefined;
  } catch (error) {
    return error;
  }
};

const captureRejected = async (run: () => Promise<unknown>): Promise<unknown> =>
  run().then(
    () => undefined,
    (error: unknown) => error,
  );

const datedRouteTests = () =>
  describe('dated journal route', () => {
  it('rejects malformed and impossible dates before loading', () => {
    const errors = ['not-a-date', '0000-01-01', '2026-02-30'].map((date) =>
      captureThrown(() => parseDay({ date })),
    );

    expect(errors.map(isNotFound)).toEqual([true, true, true]);
    expect(datedReadInputs).toEqual([]);
  });

  it('preserves every supported low year at the address boundary', () => {
    expect(
      ['0001-01-01', '0099-01-01', '0100-01-01'].map((date) =>
        parseDay({ date }),
      ),
    ).toEqual([
      { date: '0001-01-01' },
      { date: '0099-01-01' },
      { date: '0100-01-01' },
    ]);
  });

  it('loads a valid past date and names it in metadata', async () => {
    const past = '2026-08-25';
    loadedDay = { entry: entryOn(past), today, anniversaries: [] };

    expect(parseDay({ date: past })).toEqual({ date: past });
    await expect(loadDay(past)).resolves.toEqual(loadedDay);
    expect(datedReadInputs).toEqual([{ data: { date: past } }]);
    type HeadInput = Parameters<typeof dayHead>[0];
    const metadata = await dayHead({
      loaderData: loadedDay,
    } as unknown as HeadInput);
    expect(metadata.meta).toContainEqual({
      title: 'Tuesday, August 25, 2026 · Postlude',
    });
  });

  it('redirects the canonical address for today to the index', async () => {
    datedDisposition = 'today';
    const error = await captureRejected(() => loadDay(today));

    expect(isRedirect(error)).toBe(true);
    expect(error).toMatchObject({ options: { to: '/' } });
  });

  it('rejects a future day before a view is returned', async () => {
    const future = '2026-08-27';
    datedDisposition = 'future';

    const error = await captureRejected(() => loadDay(future));
    expect(isNotFound(error)).toBe(true);
  });

  it('does not describe an operational loader failure as a missing day', async () => {
    type HeadInput = Parameters<typeof dayHead>[0];
    const metadata = await dayHead({
      loaderData: undefined,
      match: { status: 'error' },
    } as HeadInput);
    expect(metadata.meta).toContainEqual({
      title: 'Journal unavailable · Postlude',
    });
  });
  });

const indexRouteTests = () =>
  describe('journal index route', () => {
  it('loads the day selected by the server and keeps Today metadata', async () => {
    type LoaderInput = NonNullable<Parameters<typeof indexLoader>[0]>;

    await expect(indexLoader({} as LoaderInput)).resolves.toEqual(loadedDay);
    expect(todayReadCount).toBe(1);
    expect(datedReadInputs).toEqual([]);
    type HeadInput = Parameters<typeof indexHead>[0];
    const metadata = await indexHead({
      loaderData: loadedDay,
    } as unknown as HeadInput);
    expect(metadata.meta).toContainEqual({ title: 'Today · Postlude' });
  });
  });

if (isRouteProbeProcess) {
  datedRouteTests();
  indexRouteTests();
} else {
  it('runs journal route module mocks in an isolated process', () => {
    runIsolatedBunTest(import.meta.path, import.meta.dir);
  });
}
