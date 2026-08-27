import { expect, it } from 'bun:test';
import {
  createConfirmedRevisionTracker,
  loadAfterConfirmedRevision,
} from './confirmed-revisions.ts';
import type { JournalDate } from './journal-day.ts';

const day = (date: JournalDate, revision: number) => ({
  entry: { date, revision },
});

const deferred = <Value>() => {
  let resolve: (value: Value) => void = () => undefined;
  const promise = new Promise<Value>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

it('repeats a stale read and keeps its checkpoint until the page mounts', async () => {
  const tracker = createConfirmedRevisionTracker();
  tracker.record('2026-08-27', 2);
  const replies = [day('2026-08-27', 1), day('2026-08-27', 2)];
  let calls = 0;

  const loaded = await loadAfterConfirmedRevision(() => {
    const reply = replies[calls] ?? day('2026-08-27', 0);
    calls += 1;
    return Promise.resolve(reply);
  }, tracker);

  expect(loaded).toEqual(day('2026-08-27', 2));
  expect(calls).toBe(2);
  expect(tracker.known('2026-08-27')).toBe(2);
  expect(tracker.observe('2026-08-27', loaded.entry.revision)).toBe(true);
  expect(tracker.known('2026-08-27')).toBeUndefined();
});

it('refuses every bounded read that predates a confirmed save', async () => {
  const tracker = createConfirmedRevisionTracker();
  tracker.record('2026-08-27', 2);

  await expect(
    loadAfterConfirmedRevision(
      () => Promise.resolve(day('2026-08-27', 1)),
      tracker,
    ),
  ).rejects.toThrow('did not include the confirmed save');
  expect(tracker.known('2026-08-27')).toBe(2);
});

it('keeps parallel pre-confirmation loads ordered independently', async () => {
  const tracker = createConfirmedRevisionTracker();
  const firstReply = deferred<ReturnType<typeof day>>();
  const staleReply = deferred<ReturnType<typeof day>>();
  const refreshedReply = deferred<ReturnType<typeof day>>();
  let secondCalls = 0;
  const firstLoad = loadAfterConfirmedRevision(
    () => firstReply.promise,
    tracker,
  );
  const secondLoad = loadAfterConfirmedRevision(() => {
    secondCalls += 1;
    return secondCalls === 1 ? staleReply.promise : refreshedReply.promise;
  }, tracker);

  tracker.record('2026-08-27', 2);
  firstReply.resolve(day('2026-08-27', 2));
  const first = await firstLoad;
  expect(tracker.observe('2026-08-27', first.entry.revision)).toBe(true);
  expect(tracker.known('2026-08-27')).toBe(2);

  staleReply.resolve(day('2026-08-27', 1));
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(secondCalls).toBe(2);
  refreshedReply.resolve(day('2026-08-27', 2));
  await expect(secondLoad).resolves.toEqual(day('2026-08-27', 2));
  expect(tracker.known('2026-08-27')).toBeUndefined();
});

it('fails closed instead of evicting a checkpoint under capacity pressure', async () => {
  const tracker = createConfirmedRevisionTracker(2);
  const pending = deferred<ReturnType<typeof day>>();
  const load = loadAfterConfirmedRevision(() => pending.promise, tracker);

  tracker.record('2026-08-25', 2);
  tracker.record('2026-08-26', 1);
  tracker.record('2026-08-27', 1);
  pending.resolve(day('2026-08-25', 1));

  await expect(load).rejects.toThrow('cannot be tracked safely');
  expect(tracker.known('2026-08-25')).toBe(2);
  expect(tracker.known('2026-08-26')).toBe(1);
  expect(tracker.known('2026-08-27')).toBeUndefined();
  expect(tracker.observe('2026-08-25', 2)).toBe(false);
});

it('does not let an older confirmation lower a known revision', () => {
  const tracker = createConfirmedRevisionTracker();
  const newestRevision = 3;
  tracker.record('2026-08-27', newestRevision);
  tracker.record('2026-08-27', 2);

  expect(tracker.known('2026-08-27')).toBe(newestRevision);
});
