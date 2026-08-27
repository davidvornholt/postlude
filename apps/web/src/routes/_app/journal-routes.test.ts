import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test';
import { isNotFound, isRedirect } from '@tanstack/react-router';

import type { JournalEntry } from '#/features/journal/schemas/entry.ts';

type JournalDay = {
  readonly entry: JournalEntry;
  readonly today: JournalEntry['date'];
};

const today = '2026-08-26';

const entryOn = (date: JournalEntry['date']): JournalEntry => ({
  date,
  journalMarkdown: '',
  journalWordCount: 0,
  scriptureMarkdown: '',
  scriptureWordCount: 0,
  revision: 0,
  createdAt: new Date(0),
  updatedAt: new Date(0),
});

let loadedDay: JournalDay = { entry: entryOn(today), today };
let readInputs: ReadonlyArray<unknown> = [];

mock.module('#/features/journal/services/journal-fns.ts', () => ({
  readJournalDay: (input?: unknown) => {
    readInputs = [...readInputs, input];
    return Promise.resolve(loadedDay);
  },
  saveDraft: () => Promise.reject(new Error('A route test does not save.')),
}));

beforeEach(() => {
  loadedDay = { entry: entryOn(today), today };
  readInputs = [];
});

afterAll(() => {
  mock.restore();
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

describe('dated journal route', () => {
  it('rejects malformed and impossible dates before loading', () => {
    const errors = ['not-a-date', '2026-02-30'].map((date) =>
      captureThrown(() => parseDay({ date })),
    );

    expect(errors.map(isNotFound)).toEqual([true, true]);
    expect(readInputs).toEqual([]);
  });

  it('loads a valid past date and names it in metadata', async () => {
    const past = '2026-08-25';
    loadedDay = { entry: entryOn(past), today };

    expect(parseDay({ date: past })).toEqual({ date: past });
    await expect(loadDay(past)).resolves.toEqual(loadedDay);
    expect(readInputs).toEqual([{ data: { date: past } }]);
    type HeadInput = Parameters<typeof dayHead>[0];
    const metadata = await dayHead({ loaderData: loadedDay } as HeadInput);
    expect(metadata.meta).toContainEqual({
      title: 'Tuesday 25 August 2026 · Postlude',
    });
  });

  it('redirects the canonical address for today to the index', async () => {
    const error = await captureRejected(() => loadDay(today));

    expect(isRedirect(error)).toBe(true);
    expect(error).toMatchObject({ options: { to: '/' } });
  });

  it('rejects a future day selected by the server response', async () => {
    const future = '2026-08-27';
    loadedDay = { entry: entryOn(future), today };

    const error = await captureRejected(() => loadDay(future));
    expect(isNotFound(error)).toBe(true);
  });
});

describe('journal index route', () => {
  it('loads the day selected by the server and keeps Today metadata', async () => {
    type LoaderInput = NonNullable<Parameters<typeof indexLoader>[0]>;

    await expect(indexLoader({} as LoaderInput)).resolves.toEqual(loadedDay);
    expect(readInputs).toEqual([undefined]);
    type HeadInput = Parameters<typeof indexHead>[0];
    const metadata = await indexHead({ loaderData: loadedDay } as HeadInput);
    expect(metadata.meta).toContainEqual({ title: 'Today · Postlude' });
  });
});
