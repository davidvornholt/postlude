/**
 * Insights as it reaches the page, server-rendered, for an invented journal.
 *
 * These pages sit behind the sign-in, so the browser accessibility suite in
 * `a11y/routes.a11y.ts` never reaches them without a real GitHub OAuth round
 * trip. What matters about each range — the opening sentence, the picture that
 * fits it, the folds that have something to say, and a structure a screen
 * reader can follow — is asserted here instead.
 */

import { expect, it } from 'bun:test';

import { renderInRouter } from '#/shared/testing/render-in-router.tsx';
import {
  attributeValue,
  countElements,
  elementAttributes,
  plainText,
} from '#/shared/testing/rendered-html.ts';
import type { InsightsView } from '../insights-view.ts';
import { sampleDayMetrics } from '../testing/evening-view.ts';
import {
  allTimeOf,
  blankDay,
  sampleInsightsMonth,
  sampleInsightsView,
  sampleInsightsWeek,
  sampleJournal,
} from '../testing/insights-view.ts';
import { InsightsPage } from './insights-page.tsx';

const today = '2026-08-26';
const seed = 20_260_826;
/** Long enough that the journal opens two calendar years before this one. */
const sampleDays = 900;
/** March 2024, when the sample journal opens, to August 2026. */
const monthsSoFar = 30;
const heatStepCount = 4;
const foldTitlePattern =
  /<summary\b[^>]*><span\b[^>]*>(?<title>[^<]*)<\/span>/gu;
const monthLinkPattern =
  /<a\b[^>]*aria-label="[A-Z][a-z]+ \d+ · written on[^"]*"[^>]*>/gu;
const currentYearLeadPattern =
  /So far you have written on \d+ of 238 days, [\d,]+ words in all\./u;
const pastYearLeadPattern =
  /You wrote on \d+ of 365 days, [\d,]+ words in all\./u;
const freshDaysPattern = /\d+ days? felt fresh/u;
const measureRadioPattern = /value="(?:writing|energy|progress)"/gu;
const heatStepPattern = /bg-heat-q[1-4]/gu;
const headingOnePattern = /<h1\b/gu;

const journal = sampleJournal(today, sampleDays, seed);
const yearView = sampleInsightsView(
  journal,
  { kind: 'year', year: 2026 },
  today,
);
const pastYearView = sampleInsightsView(
  journal,
  { kind: 'year', year: 2025 },
  today,
);
const emptyView: InsightsView = sampleInsightsView(
  [],
  { kind: 'year', year: 2026 },
  today,
);

const render = (view: InsightsView) =>
  renderInRouter(<InsightsPage view={view} />);

const year = await render(yearView);
const pastYear = await render(pastYearView);
const allTime = await render(
  sampleInsightsView(journal, allTimeOf(journal, today), today),
);
const month = await render(sampleInsightsMonth);
const week = await render(sampleInsightsWeek);
const empty = await render(emptyView);
const insightsToday = '2026-10-30';
/** A month with nothing written: one answer, and a report without screen time. */
const unwrittenMonth = await render(
  sampleInsightsView(
    [
      { ...blankDay('2026-10-05'), progress: 'solid' },
      {
        ...blankDay('2026-10-06'),
        report: {
          ...sampleDayMetrics('2026-10-06'),
          activeMinutes: null,
          focusMinutes: null,
          scatteredMinutes: null,
          appointmentMinutes: 90,
        },
      },
    ],
    { kind: 'month', month: '2026-10' },
    insightsToday,
  ),
);
/** A week whose screen time was measured but not sorted into categories. */
const unsortedWeek = await render(
  sampleInsightsView(
    [
      {
        ...blankDay('2026-10-26'),
        journalWords: 120,
        report: {
          ...sampleDayMetrics('2026-10-26'),
          categories: [
            { id: 'work', label: 'Work', minutes: null },
            { id: 'leisure', label: 'Leisure', minutes: null },
          ],
        },
      },
    ],
    { kind: 'week', start: '2026-10-26' },
    insightsToday,
  ),
);

/** The opening tag of the link a screen reader names `label`. */
const anchorLabelled = (html: string, label: string): string =>
  html.match(new RegExp(`<a\\b[^>]*aria-label="${label}"[^>]*>`, 'u'))?.[0] ??
  '';

const foldTitles = (html: string): ReadonlyArray<string> =>
  Array.from(html.matchAll(foldTitlePattern), (match) =>
    plainText(match.groups?.title ?? ''),
  );

it('opens on a sentence that says how much was written', () => {
  expect(plainText(year)).toMatch(currentYearLeadPattern);
  expect(plainText(pastYear)).toMatch(pastYearLeadPattern);
  expect(plainText(year)).toMatch(freshDaysPattern);
});

/*
 * An empty journal gets one sentence, not a grid of outlines under a stack of
 * folds that each say there is nothing in them.
 */
it('says an empty journal is empty and draws nothing else', () => {
  expect(plainText(empty)).toContain(
    'Nothing written yet. Insights fill in as the days do.',
  );
  expect(empty).not.toContain('role="img"');
  expect(countElements(empty, 'details')).toBe(0);
  expect(empty).not.toContain('Download the journal');
});

it('draws the picture that fits the range', () => {
  expect(plainText(week)).toContain('How the days felt');
  expect(week).toContain('aria-label="Ratings chart"');
  expect(plainText(month)).toContain('How the days felt');
  expect(plainText(year)).toContain('The year at a glance');
  expect(year).toContain('Journal activity from January 2026 to August 2026');
  expect(plainText(allTime)).toContain('Month by month');
});

it('lets the year and all time be shaded by writing, energy or progress', () => {
  for (const html of [year, allTime]) {
    expect(html.match(measureRadioPattern)).toHaveLength(3);
    expect(plainText(html)).toContain('WritingEnergyProgress');
  }
  expect(week).not.toContain('value="energy"');
});

it('separates no writing from the four-step Less–More ramp', () => {
  const legendStart = year.indexOf('<figcaption');
  const legend = year.slice(
    legendStart,
    year.indexOf('</figcaption>', legendStart),
  );

  expect(plainText(legend)).toContain('No writingLessMore');
  expect(legend.match(heatStepPattern)).toHaveLength(heatStepCount);
});

/*
 * Each fold is shown only when it has something to say about the range, and
 * says its finding while closed so the page can be skimmed without opening one.
 */
it('folds the detail away and keeps only what has something to say', () => {
  expect(countElements(month, 'details')).toBeGreaterThan(0);
  expect(month).not.toContain('<details open');
  expect(foldTitles(week)).toEqual([
    'Ratings',
    'Streaks',
    'Scripture',
    'Screen time',
    'Where it went',
    'Day by day',
  ]);
  expect(plainText(week)).toContain('No run going · longest');
  expect(plainText(week)).not.toContain('Weekdays');
  expect(plainText(week)).not.toContain('Entry length');
  expect(plainText(month)).toContain('Most often written on');
  expect(plainText(month)).toContain('on an average written day');
  expect(plainText(month)).toContain('mornings with scripture, most often');
  expect(plainText(month)).toContain('on an average measured day');
  expect(plainText(month)).toContain('Most of it: Writing');
  expect(plainText(pastYear)).not.toContain('Streaks');
  expect(plainText(allTime)).not.toContain('Day by day');
});

/*
 * Ratings and /wrap's totals stand on their own: a month with nothing written
 * still shows them, and categories without minutes never name a winner.
 */
it('keeps ratings and measured totals without writing or screen time', () => {
  expect(plainText(unwrittenMonth)).toContain(
    'Nothing written yet this month.',
  );
  expect(foldTitles(unwrittenMonth)).toEqual([
    'Ratings',
    'Screen time',
    'Day by day',
  ]);
  expect(plainText(unwrittenMonth)).toContain('1 of 30 days rated');
  expect(plainText(unwrittenMonth)).not.toContain('No day rated yet');
  expect(plainText(unwrittenMonth)).toContain(
    'Not measured · other totals from 1 report',
  );
  expect(plainText(unwrittenMonth)).toContain('In appointments1 h 30 min');
  expect(foldTitles(unsortedWeek)).not.toContain('Where it went');
  expect(plainText(unsortedWeek)).not.toContain('Most of it');
});

it('offers the four ranges on one track and marks the one shown', () => {
  expect(year).toContain('<nav aria-label="Insights range"');
  const current = elementAttributes(year, 'a', 'Year');
  expect(attributeValue(current, 'aria-current')).toBe('page');
  expect(attributeValue(current, 'href')).toBe('/insights');
  expect(attributeValue(elementAttributes(year, 'a', 'All time'), 'href')).toBe(
    '/insights?range=all',
  );
  for (const other of ['Week', 'Month', 'All time']) {
    expect(
      attributeValue(elementAttributes(year, 'a', other), 'aria-current'),
    ).toBe('');
  }
});

it('steps back from the current range and offers the way home from a past one', () => {
  expect(attributeValue(anchorLabelled(year, 'Previous year'), 'href')).toBe(
    '/insights?year=2025',
  );
  // The step past today keeps its place, dimmed and announced as unavailable.
  const next = anchorLabelled(year, 'Next year');
  expect(attributeValue(next, 'aria-disabled')).toBe('true');
  expect(attributeValue(next, 'href')).toBe('');
  expect(plainText(year)).not.toContain('This year');
  expect(pastYear).toContain('aria-label="Next year"');
  expect(plainText(pastYear)).toContain('This year');
  expect(plainText(week)).toContain('Week 44');
});

/*
 * All time is a month to a square and every square opens its month, but the
 * squares are one stop in the tab order, the arrow keys moving between them.
 */
it('makes all time a grid of months that is one tab stop', () => {
  const months = allTime.match(monthLinkPattern) ?? [];
  expect(months).toHaveLength(monthsSoFar);
  const stops = months.filter((link) => link.includes('tabindex="0"'));
  expect(stops).toHaveLength(1);
  expect(stops[0]).toContain('aria-label="August 2026');
  expect(allTime).toContain('href="/insights?year=2025"');
  expect(allTime).toContain('href="/insights?range=month&amp;month=2025-03"');
});

/* One page, one first-level heading, with every section a level below it. */
it('names the page and the range once and puts every section under it', () => {
  expect(year.match(headingOnePattern)?.length).toBe(1);
  expect(plainText(year)).toContain('Insights: 2026');
  expect(plainText(month)).toContain('Insights: October 2026');
  expect(plainText(year)).toContain('In detail');
  expect(plainText(year)).toContain('Download the journal');
});
