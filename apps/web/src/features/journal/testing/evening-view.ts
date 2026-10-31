/** Evenings for pages rendered without a database. */

import { type AgentNoteView, emptyWrapArea } from '../schemas/agent-area.ts';
import type { DayMetrics } from '../schemas/day-metrics.ts';
import { emptyDayRating } from '../schemas/day-rating.ts';
import type { EveningActions, EveningView } from '../services/evening-fns.ts';

export const noAgentNote = (entryRevision = 0): AgentNoteView => ({
  status: 'none',
  note: null,
  model: null,
  basedOnRevision: null,
  entryRevision,
  error: null,
  requestedAt: null,
  generatedAt: null,
});

export const emptyEvening = (date: string, entryRevision = 0): EveningView => ({
  date,
  rating: emptyDayRating,
  wrap: emptyWrapArea(date),
  agentNote: noAgentNote(entryRevision),
});

const never = () => new Promise<never>(() => undefined);

/** Actions for a page whose evening is only looked at, never used. */
export const unansweredEveningActions: EveningActions = {
  readEvening: never,
  saveRating: never,
  closeDay: never,
  reopenDay: never,
  regenerateNote: never,
};

/** Made-up numbers in the shape /wrap writes, for tests and fixtures only. */
export const sampleDayMetrics = (date: string): DayMetrics => ({
  metricsVersion: 2,
  day: date,
  activeMinutes: 412,
  firstActivityAt: `${date}T07:12:00+02:00`,
  lastActivityAt: `${date}T22:40:00+02:00`,
  focusMinutes: 236,
  scatteredMinutes: 88,
  categories: [
    { id: 'writing', label: 'Writing', minutes: 140 },
    { id: 'reading', label: 'Reading', minutes: 96 },
    { id: 'admin', label: 'Admin', minutes: null },
  ],
  offComputerMinutes: 190,
  appointmentMinutes: 60,
  appointmentOffScreenMinutes: 45,
  landedPrs: 3,
  sentMails: [{ mailbox: 'Work', count: 4 }],
  coverage: [
    { source: 'activity', status: 'complete' },
    { source: 'calendar', status: 'unreachable' },
  ],
});
