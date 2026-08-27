import { expect, it } from 'bun:test';
import { loadAfterConfirmedRevision } from './confirmed-revision-loader.ts';

import { createConfirmedRevisionTracker } from './confirmed-revisions.ts';

type RevisionedDay = {
  readonly entry: { readonly date: '2026-08-25'; readonly revision: number };
  readonly anniversaryRevisions: ReadonlyArray<{
    readonly date: '2025-08-25';
    readonly revision: number;
  }>;
};

const view = (anniversaryRevision: number): RevisionedDay => ({
  entry: { date: '2026-08-25', revision: 0 },
  anniversaryRevisions: [{ date: '2025-08-25', revision: anniversaryRevision }],
});

const deferred = () => {
  let resolve: (value: RevisionedDay) => void = () => undefined;
  const promise = new Promise<RevisionedDay>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

it('repeats a day read whose anniversary predates a confirmed save', async () => {
  const tracker = createConfirmedRevisionTracker();
  const stale = deferred();
  let reads = 0;
  const loading = loadAfterConfirmedRevision(() => {
    reads += 1;
    return reads === 1 ? stale.promise : Promise.resolve(view(2));
  }, tracker);

  tracker.record('2025-08-25', 2);
  stale.resolve(view(1));

  await expect(loading).resolves.toEqual(view(2));
  expect(reads).toBe(2);
  expect(tracker.observe('2025-08-25', 2)).toBe(true);
});

it('repeats a pre-confirmation read missing a new anniversary once', async () => {
  const tracker = createConfirmedRevisionTracker();
  const stale = deferred();
  const withoutAnniversary: RevisionedDay = {
    entry: { date: '2026-08-25', revision: 0 },
    anniversaryRevisions: [],
  };
  let reads = 0;
  const loading = loadAfterConfirmedRevision(() => {
    reads += 1;
    return reads === 1 ? stale.promise : Promise.resolve(withoutAnniversary);
  }, tracker);

  tracker.record('2025-08-25', 1);
  stale.resolve(withoutAnniversary);

  await expect(loading).resolves.toEqual(withoutAnniversary);
  expect(reads).toBe(2);
});
