/**
 * The archive as it reaches the page, server-rendered.
 *
 * These pages sit behind the sign-in, so the browser accessibility suite in
 * `a11y/routes.a11y.ts` never reaches them: getting past it needs a real GitHub
 * OAuth round trip. The states that matter — an empty journal, a grid that has
 * to be readable without being looked at, and a year of days that has to be
 * reachable from a keyboard — are asserted here instead.
 */

import { expect, it } from 'bun:test';

import { renderInRouter } from '#/shared/testing/render-in-router.tsx';
import {
  attributeValue,
  elementAttributes,
  plainText,
} from '#/shared/testing/rendered-html.ts';
import { activityWindow } from '../activity.ts';
import type { ArchiveView } from '../services/archive-fns.ts';
import { sampleArchiveView, sampleJournal } from '../testing/archive-view.ts';
import { ArchivePage } from './archive-page.tsx';

const today = '2026-08-26';
const seed = 20_260_826;
const sampleDays = 400;
const todayYear = 2026;
const heatStepCount = 4;
const describedBy = /aria-describedby="(?<id>[^"]+)"/u;
const dayLinks = /href="\/day\/\d{4}-\d{2}-\d{2}"/gu;
const currentPage = /aria-current="page"/gu;

const journal = sampleJournal(today, sampleDays, seed);

const filled = await renderInRouter(
  <ArchivePage
    selectedYear={undefined}
    view={sampleArchiveView(journal, today)}
  />,
);

const emptyView: ArchiveView = {
  today,
  exportAvailable: false,
  window: activityWindow(today),
  days: [],
  years: [],
  journalStreak: { current: 0, longest: 0 },
  scriptureStreak: { current: 0, longest: 0 },
  totals: { daysWritten: 0, words: 0 },
};
const empty = await renderInRouter(
  <ArchivePage selectedYear={undefined} view={emptyView} />,
);

/*
 * A grid of 371 outlines under two zeroes says nothing except that the writer
 * has not started, so a journal with no activity gets a sentence instead.
 */
it('says the journal is empty rather than drawing an empty one', () => {
  expect(empty).toContain('No writing activity yet');
  expect(empty).not.toContain('Streaks');
  expect(empty).not.toContain('role="img"');
});

it('shows reference-only scripture activity instead of the empty journal', async () => {
  const scriptureOnly = await renderInRouter(
    <ArchivePage
      selectedYear={undefined}
      view={{
        ...emptyView,
        exportAvailable: true,
        days: [
          {
            date: today,
            journalWords: 0,
            scriptureWords: 0,
            hasScripture: true,
            journalWrittenOnTheDay: false,
            scriptureUsedOnTheDay: true,
          },
        ],
        years: [todayYear],
      }}
    />,
  );

  expect(scriptureOnly).not.toContain('No writing activity yet');
  expect(scriptureOnly).toContain('Activity');
  expect(scriptureOnly).toContain('role="img"');
  expect(scriptureOnly).toContain('Download the journal');
});

it('uses singular counts in the archive summary', async () => {
  const oneDay = await renderInRouter(
    <ArchivePage
      selectedYear={undefined}
      view={{
        ...emptyView,
        exportAvailable: true,
        days: [
          {
            date: today,
            journalWords: 1,
            scriptureWords: 0,
            hasScripture: false,
            journalWrittenOnTheDay: true,
            scriptureUsedOnTheDay: false,
          },
        ],
        years: [todayYear],
        totals: { daysWritten: 1, words: 1 },
      }}
    />,
  );

  expect(plainText(oneDay)).toContain('1 day written, 1 word in all.');
});

it('states both runs, each with the longest it has ever been', () => {
  const view = sampleArchiveView(journal, today);
  expect(filled).toContain('Evening journal');
  expect(filled).toContain('Morning scripture');
  expect(filled).toContain(`Longest run: ${view.journalStreak.longest} days`);
});

/*
 * The grid is one image rather than 371 unlabelled squares. Its label says what
 * the year holds and its description breaks the year down by month, so the page
 * carries the same information read aloud as it does looked at.
 */
it('gives the grid a summary and a described breakdown', () => {
  expect(filled).toContain('role="img"');
  expect(filled).toContain('Journal activity from');
  expect(filled).toContain('Monthly breakdown.');
});

it('shows daily entry size and explains its seven-day trend', () => {
  expect(elementAttributes(filled, 'h2', 'Entry length')).not.toBe('');
  expect(filled).toContain('aria-label="Entry size chart"');
  expect(plainText(filled)).toContain('Seven-day average');
  expect(plainText(filled)).toContain(
    'Entry length rangeActivity rangeSince first entry',
  );
});

it('points the grid at the description that stands in for it', () => {
  const described = describedBy.exec(filled)?.groups?.id;
  expect(described).toBeDefined();
  for (const id of described?.split(' ') ?? []) {
    expect(filled).toContain(`id="${id}"`);
  }
});

/*
 * The chart stays one keyboard stop rather than exposing 371 links. Pointer
 * clicks and Enter can open its active square, while the prose route into every
 * day written remains the table below it.
 */
it('opens every day written from the list below the grid', () => {
  const written = journal.filter(
    (day) => day.journalWords + day.scriptureWords > 0,
  );
  const links = filled.match(dayLinks) ?? [];
  expect(links.length).toBeGreaterThan(0);
  expect(links.length).toBeLessThanOrEqual(written.length);
  expect(filled).toContain(`href="/day/${written.at(-1)?.date}"`);
});

it('offers the rolling year and every year the journal covers', () => {
  const view = sampleArchiveView(journal, today);
  expect(plainText(filled)).toContain('Past year');
  expect(filled).toContain(`>${view.years[0]}</a>`);
});

it('marks the year being shown so it is not told apart by colour alone', () => {
  const rolling = elementAttributes(filled, 'a', 'Past year');
  expect(attributeValue(rolling, 'href')).toBe('/archive');
  expect(attributeValue(rolling, 'aria-current')).toBe('page');
  expect(rolling).toContain('after:scale-x-100');
  expect(filled.match(currentPage)).toHaveLength(1);
});

it('separates no writing from the four-step Less–More ramp', () => {
  const legendStart = filled.indexOf('<figcaption');
  const legendEnd = filled.indexOf('</figcaption>', legendStart);
  const legend = filled.slice(legendStart, legendEnd);

  expect(plainText(legend)).toContain('No writingLessMore');
  expect(legend.match(/bg-heat-q[1-4]/gu)).toHaveLength(heatStepCount);
  expect(legend).toContain('border-heat-none-mark');
});

/*
 * The years behind a date belong on that date's own page, where they are the
 * same day being read again. Here they could only ever mean today, which is the
 * one day the writer did not come to the archive to find.
 */
it('leaves the years behind a date to the page for that date', () => {
  expect(filled).not.toContain('On this day');
  expect(empty).not.toContain('On this day');
});

/* One page, one first-level heading, with every section a level below it. */
it('names the page once and puts every section under it', () => {
  expect(filled.match(/<h1\b/gu)?.length).toBe(1);
  expect(elementAttributes(filled, 'h1', 'Archive')).not.toBe('');
  expect(elementAttributes(filled, 'h2', 'Activity')).not.toBe('');
});
