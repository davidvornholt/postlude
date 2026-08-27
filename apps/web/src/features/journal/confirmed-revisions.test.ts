import { expect, it } from 'bun:test';
import {
  createConfirmedRevisionTracker,
  loadAfterConfirmedRevision,
} from './confirmed-revisions.ts';
import type { JournalDate } from './journal-day.ts';

const day = (date: JournalDate, revision: number) => ({
  entry: { date, revision },
});
const secondConfirmedRevision = 3;
const expectedLoaderReads = 3;

it('repeats a stale loader read and clears a caught-up checkpoint', async () => {
  const tracker = createConfirmedRevisionTracker();
  tracker.record('2026-08-27', 2);
  const replies = [day('2026-08-27', 1), day('2026-08-27', 2)];
  let calls = 0;

  await expect(
    loadAfterConfirmedRevision(() => {
      const reply = replies[calls] ?? day('2026-08-27', 0);
      calls += 1;
      return Promise.resolve(reply);
    }, tracker),
  ).resolves.toEqual(day('2026-08-27', 2));
  expect(calls).toBe(2);
  expect(tracker.known('2026-08-27')).toBeUndefined();
});

it('refuses a second read that still predates a confirmed save', async () => {
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

it('catches a second save that confirms during the refresh', async () => {
  const tracker = createConfirmedRevisionTracker();
  tracker.record('2026-08-27', 2);
  let calls = 0;
  const load = (): Promise<ReturnType<typeof day>> => {
    calls += 1;
    if (calls === 1) {
      return Promise.resolve(day('2026-08-27', 1));
    }
    if (calls === 2) {
      tracker.record('2026-08-27', secondConfirmedRevision);
      return Promise.resolve(day('2026-08-27', 2));
    }
    return Promise.resolve(day('2026-08-27', secondConfirmedRevision));
  };

  await expect(loadAfterConfirmedRevision(load, tracker)).resolves.toEqual(
    day('2026-08-27', secondConfirmedRevision),
  );
  expect(calls).toBe(expectedLoaderReads);
  expect(tracker.known('2026-08-27')).toBeUndefined();
});

it('keeps only the newest bounded set during a long session', () => {
  const tracker = createConfirmedRevisionTracker(2);
  tracker.record('2026-08-25', 1);
  tracker.record('2026-08-26', 1);
  tracker.record('2026-08-27', 1);

  expect(tracker.known('2026-08-25')).toBeUndefined();
  expect(tracker.known('2026-08-26')).toBe(1);
  expect(tracker.known('2026-08-27')).toBe(1);
});

it('does not let an older confirmation lower a known revision', () => {
  const tracker = createConfirmedRevisionTracker();
  tracker.record('2026-08-27', secondConfirmedRevision);
  tracker.record('2026-08-27', 2);

  expect(tracker.known('2026-08-27')).toBe(secondConfirmedRevision);
});
