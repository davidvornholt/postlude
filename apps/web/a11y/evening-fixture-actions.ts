/**
 * Evening actions held in memory for the day-page fixture, answering as the
 * server functions do. Every call is recorded on the root element, so a test
 * can see what the page asked for and in which order.
 *
 * A test can hold back the answers to a call, as a slow connection would. The
 * call still takes effect when it is made, and only its answer waits.
 */

import {
  dayClosedMessage,
  ratingsNeededMessage,
} from '../src/features/journal/evening-messages.ts';
import type { AgentNoteView } from '../src/features/journal/schemas/agent-area.ts';
import {
  canCloseDay,
  type DayRating,
  type DayRatingChange,
} from '../src/features/journal/schemas/day-rating.ts';
import type {
  EveningActions,
  EveningView,
} from '../src/features/journal/services/evening-fns.ts';
import { unansweredEveningActions } from '../src/features/journal/testing/evening-view.ts';
import {
  agentNoteFromFixture,
  type DayPageFixtureConfig,
  type DayPageFixtureWindow,
  eveningFromFixture,
} from './day-page-fixture-contract.ts';

/** What `fetch` throws when the connection drops. */
const connectionFailure = 'Failed to fetch';
const closedAt = new Date('2026-08-26T21:00:00.000Z');
const minuteMs = 60_000;

const changeText = (change: DayRatingChange): string =>
  Object.entries(change)
    .filter(([key]) => key !== 'date')
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(',');

export const eveningFixtureActions = (
  config: DayPageFixtureConfig,
): EveningActions => {
  const initial = eveningFromFixture(config);
  const fixture = config.evening;
  if (
    initial === undefined ||
    fixture === undefined ||
    fixture === 'unavailable'
  ) {
    return unansweredEveningActions;
  }
  const settled =
    fixture.settledNote === undefined
      ? undefined
      : agentNoteFromFixture(fixture.settledNote);
  const calls: Array<string> = [];
  let rating: DayRating = initial.rating;
  let agentNote: AgentNoteView = initial.agentNote;

  /** The answers each held call is waiting to send. */
  const holds = new Map<string, Array<() => void>>();
  const fixtureWindow = globalThis as unknown as DayPageFixtureWindow;
  fixtureWindow.postludeHoldEveningCalls = (call) => {
    holds.set(call, []);
  };
  fixtureWindow.postludeReleaseEveningCalls = (call) => {
    const waiting = holds.get(call) ?? [];
    holds.delete(call);
    for (const send of waiting) {
      send();
    }
  };

  const record = (call: string): void => {
    calls.push(call);
    document.documentElement.dataset.eveningCalls = calls.join(' ');
  };
  const answer = <A>(call: string, value: A): Promise<A> => {
    const waiting = holds.get(call);
    return waiting === undefined
      ? Promise.resolve(value)
      : new Promise((resolve) => {
          waiting.push(() => resolve(value));
        });
  };
  let requests = 0;
  /** A new note request, a minute after the one before, as the server never repeats a request's time. */
  const pending = (): AgentNoteView => {
    requests += 1;
    return {
      ...agentNote,
      status: 'pending',
      error: null,
      requestedAt: new Date(closedAt.getTime() + requests * minuteMs),
    };
  };
  const view = (): EveningView => ({ ...initial, rating, agentNote });

  return {
    readEvening: () => {
      record('read');
      if (agentNote.status === 'pending' && settled !== undefined) {
        agentNote = settled;
      }
      return answer('read', view());
    },
    saveRating: (change) => {
      const call = `rate:${changeText(change)}`;
      record(call);
      if (rating.closedAt !== null) {
        return Promise.reject(new Error(dayClosedMessage));
      }
      if (fixture.ratingSaves === 'failed') {
        return Promise.reject(new TypeError(connectionFailure));
      }
      const { date: _date, ...values } = change;
      rating = { ...rating, ...values, ratingVersion: 1 };
      return answer(call, rating);
    },
    closeDay: () => {
      record('close');
      if (!canCloseDay(rating)) {
        return Promise.reject(new Error(ratingsNeededMessage));
      }
      rating = { ...rating, closedAt };
      agentNote = pending();
      return answer('close', { rating, agentNote });
    },
    reopenDay: () => {
      record('reopen');
      rating = { ...rating, closedAt: null };
      return answer('reopen', rating);
    },
    regenerateNote: () => {
      record('regenerate');
      agentNote = pending();
      return answer('regenerate', agentNote);
    },
  };
};
