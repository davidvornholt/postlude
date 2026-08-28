import { afterAll, expect, it, mock } from 'bun:test';

import {
  isIsolatedBunTestProcess,
  runIsolatedBunTest,
} from '#/shared/testing/isolated-bun-test.ts';
import { emptyJournalEntry } from '../schemas/entry.ts';
import type { JournalDayView } from './journal-day-reader.ts';

const finalReadCount = 3;

const isServiceProbeProcess = isIsolatedBunTestProcess(import.meta.dir);

if (isServiceProbeProcess) {
  const requestedDate = '2026-08-25';
  type DatedReply = {
    readonly disposition: 'readable';
    readonly view: JournalDayView;
  };
  type ServerFnChain = {
    readonly handler: (
      handler: (context: { readonly data: unknown }) => unknown,
    ) => (input?: { readonly data?: unknown }) => unknown;
    readonly middleware: () => ServerFnChain;
    readonly validator: () => ServerFnChain;
  };

  const stale: JournalDayView = {
    entry: emptyJournalEntry(requestedDate),
    today: '2026-08-26',
  };
  const fresh: JournalDayView = {
    ...stale,
    entry: { ...stale.entry, revision: 1 },
  };

  let resolveFirst: (value: DatedReply) => void = () => undefined;
  const firstRequest = new Promise<DatedReply>((resolve) => {
    resolveFirst = resolve;
  });
  let reads = 0;

  mock.module('@tanstack/react-start', () => ({
    createServerFn: () => {
      const chain: ServerFnChain = {
        handler:
          (handler: (context: { readonly data: unknown }) => unknown) =>
          (input?: { readonly data?: unknown }) =>
            handler({ data: input?.data }),
        middleware: () => chain,
        validator: () => chain,
      };
      return chain;
    },
  }));
  mock.module('#/shared/auth/auth-middleware.ts', () => ({
    sessionRequired: {},
  }));
  mock.module('#/shared/env.ts', () => ({
    // biome-ignore lint/style/useNamingConvention: Mirrors the validated environment contract.
    env: { JOURNAL_TIME_ZONE: 'UTC' },
  }));
  mock.module('./journal-runtime.ts', () => ({
    runJournalEffect: () => Promise.reject(new Error('Unexpected effect run.')),
  }));
  mock.module('./journal-day-reader.ts', () => ({
    makeJournalDayReader: () => ({
      readDated: () => {
        reads += 1;
        return reads === 1
          ? firstRequest
          : Promise.resolve({
              disposition: 'readable' as const,
              view: fresh,
            });
      },
      readToday: () => Promise.reject(new Error('Unexpected today read.')),
    }),
  }));

  const { confirmedRevisions } = await import('../confirmed-revisions.ts');
  const { readDatedJournalDay } = await import('./journal-fns.ts');

  afterAll(() => {
    mock.restore();
  });

  it('tracks the first dated server request before that day is saved', async () => {
    const loading = readDatedJournalDay({ data: { date: requestedDate } });
    expect(reads).toBe(1);

    confirmedRevisions.record(requestedDate, 1);
    resolveFirst({ disposition: 'readable', view: stale });

    await expect(loading).resolves.toEqual({
      disposition: 'readable',
      view: fresh,
    });
    expect(reads).toBe(2);

    await expect(
      readDatedJournalDay({ data: { date: requestedDate } }),
    ).resolves.toEqual({
      disposition: 'readable',
      view: fresh,
    });
    expect(reads).toBe(finalReadCount);
  });
} else {
  it('runs the dated freshness probe in an isolated process', () => {
    expect(() =>
      runIsolatedBunTest(import.meta.path, import.meta.dir),
    ).not.toThrow();
  });
}
