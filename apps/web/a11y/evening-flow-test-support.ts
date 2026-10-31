/**
 * Day pages with an evening in each state the server can hand over, built once
 * and shared by the evening tests. Every rating, report and note in them is
 * made up.
 */

import { scanWcag22AaViolations } from '@davidvornholt/a11y-testing/axe';
import type * as playwright from '@playwright/test';
import { expect } from '@playwright/test';
import { notConfiguredMessage } from '../src/features/journal/evening-messages.ts';
import { sampleDayMetrics } from '../src/features/journal/testing/evening-view.ts';
import { buildDayPageFixtures } from './day-page-fixture-build.ts';
import type {
  DayPageFixtureConfig,
  FixtureAgentNote,
  FixtureEvening,
} from './day-page-fixture-contract.ts';
import { fixtureConfig, mountFixture, today } from './day-page-mount.ts';
import { syntheticReportHtml } from './synthetic-report.ts';

const closedAt = '2026-08-26T21:00:00.000Z';
const entryRevision = 1;

export const noteModel = 'Synthetic Model 2';
export const readyNoteText = 'A synthetic note about a synthetic day.';

const noNote: FixtureAgentNote = {
  status: 'none',
  note: null,
  model: null,
  basedOnRevision: null,
  entryRevision,
  error: null,
  requestedAt: null,
  generatedAt: null,
};

const readyNote: FixtureAgentNote = {
  ...noNote,
  status: 'ready',
  note: readyNoteText,
  model: noteModel,
  basedOnRevision: entryRevision,
  generatedAt: closedAt,
};

const notConfiguredNote: FixtureAgentNote = {
  ...noNote,
  status: 'failed',
  error: notConfiguredMessage,
  requestedAt: closedAt,
};

const openRating: FixtureEvening['rating'] = {
  energy: null,
  progress: null,
  repeatDay: null,
  ratingVersion: null,
  closedAt: null,
};

const closedRating: FixtureEvening['rating'] = {
  energy: 'okay',
  progress: 'solid',
  repeatDay: 'partly',
  ratingVersion: 1,
  closedAt,
};

const noReport: FixtureEvening['wrap'] = {
  date: today,
  dayMetrics: null,
  metricsVersion: null,
  reportHtml: null,
  reportModel: null,
  reportGeneratedAt: null,
};

/** Every number made up, and one of them unmeasured, as /wrap leaves a gap. */
export const reportMetrics = { ...sampleDayMetrics(today), landedPrs: null };

const withReport: FixtureEvening['wrap'] = {
  date: today,
  dayMetrics: reportMetrics,
  metricsVersion: reportMetrics.metricsVersion,
  reportHtml: syntheticReportHtml,
  reportModel: 'Synthetic Model 1',
  reportGeneratedAt: closedAt,
};

const withEvening = (
  evening: FixtureEvening | 'unavailable',
): DayPageFixtureConfig => ({
  ...fixtureConfig(['stored'], ''),
  evening,
});

const configs = {
  /** Not yet rated, with a report waiting behind the energy rating. */
  report: withEvening({
    rating: openRating,
    wrap: withReport,
    agentNote: noNote,
    settledNote: readyNote,
  }),
  /** Closed while no note generator is set up. */
  notConfigured: withEvening({
    rating: closedRating,
    wrap: noReport,
    agentNote: notConfiguredNote,
    settledNote: notConfiguredNote,
  }),
  /** Closed, with writing saved after its note was written. */
  stale: withEvening({
    rating: closedRating,
    wrap: noReport,
    agentNote: {
      ...readyNote,
      status: 'stale',
      basedOnRevision: entryRevision - 1,
    },
  }),
  /** Open, with every rating save lost on the way. */
  failingRatings: withEvening({
    rating: openRating,
    wrap: noReport,
    agentNote: noNote,
    ratingSaves: 'failed',
  }),
  /** The evening couldn't be read with the day. */
  unavailable: withEvening('unavailable'),
} as const;

export type EveningFixture = keyof typeof configs;

const names = Object.keys(configs) as ReadonlyArray<EveningFixture>;
const built = await buildDayPageFixtures(names.map((name) => configs[name]));
const assets = new Map(names.map((name, index) => [name, built[index]]));

export const mountEvening = async (
  page: playwright.Page,
  name: EveningFixture,
): Promise<void> => {
  const fixtureAssets = assets.get(name);
  if (fixtureAssets === undefined) {
    throw new Error(`The ${name} evening fixture was not built.`);
  }
  const hydrationErrors: Array<string> = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      hydrationErrors.push(message.text());
    }
  });
  await mountFixture(page, configs[name], fixtureAssets);
  expect(hydrationErrors).toEqual([]);
};

export const scanPage = async (page: playwright.Page): Promise<void> => {
  expect(await scanWcag22AaViolations(page)).toEqual([]);
};

export const eveningCalls = (page: playwright.Page) =>
  page.locator('html').getAttribute('data-evening-calls');

export const choose = (
  page: playwright.Page,
  group: string,
  choice: string,
): Promise<void> =>
  page
    .getByRole('group', { name: group })
    .locator('label', { hasText: choice })
    .click();
