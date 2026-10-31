/**
 * Evening actions held in memory for the day-page fixture, answering as the
 * server functions do. Every call is recorded on the root element, so a test
 * can see what the page asked for and in which order.
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
  eveningFromFixture,
} from './day-page-fixture-contract.ts';

/** What `fetch` throws when the connection drops. */
const connectionFailure = 'Failed to fetch';
const closedAt = new Date('2026-08-26T21:00:00.000Z');

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

  const record = (call: string): void => {
    calls.push(call);
    document.documentElement.dataset.eveningCalls = calls.join(' ');
  };
  const pending = (): AgentNoteView => ({
    ...agentNote,
    status: 'pending',
    error: null,
    requestedAt: closedAt,
  });
  const view = (): EveningView => ({ ...initial, rating, agentNote });

  return {
    readEvening: () => {
      record('read');
      if (agentNote.status === 'pending' && settled !== undefined) {
        agentNote = settled;
      }
      return Promise.resolve(view());
    },
    saveRating: (change) => {
      record(`rate:${changeText(change)}`);
      if (rating.closedAt !== null) {
        return Promise.reject(new Error(dayClosedMessage));
      }
      if (fixture.ratingSaves === 'failed') {
        return Promise.reject(new TypeError(connectionFailure));
      }
      const { date: _date, ...values } = change;
      rating = { ...rating, ...values, ratingVersion: 1 };
      return Promise.resolve(rating);
    },
    closeDay: () => {
      record('close');
      if (!canCloseDay(rating)) {
        return Promise.reject(new Error(ratingsNeededMessage));
      }
      rating = { ...rating, closedAt };
      agentNote = pending();
      return Promise.resolve({ rating, agentNote });
    },
    reopenDay: () => {
      record('reopen');
      rating = { ...rating, closedAt: null };
      return Promise.resolve(rating);
    },
    regenerateNote: () => {
      record('regenerate');
      agentNote = pending();
      return Promise.resolve(agentNote);
    },
  };
};
