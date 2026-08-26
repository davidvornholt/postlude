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
const describedBy = /aria-describedby="(?<id>[^"]+)"/u;
const dayLinks = /href="\/day\/\d{4}-\d{2}-\d{2}"/gu;

const journal = sampleJournal(today, sampleDays, seed);

/*
 * The download is a prop rather than the real server function, which is what
 * lets the page be rendered here at all: the route owns which function the page
 * talks to, and nothing on the server side of it is reachable from a test about
 * markup.
 */
const noDownload = () => Promise.resolve(new Response());

const filled = await renderInRouter(
  <ArchivePage
    download={noDownload}
    selectedYear={undefined}
    view={sampleArchiveView(journal, today)}
  />,
);

const emptyView: ArchiveView = {
  today,
  window: activityWindow(today),
  days: [],
  years: [],
  journalStreak: { current: 0, longest: 0 },
  scriptureStreak: { current: 0, longest: 0 },
  totals: { daysWritten: 0, words: 0 },
  anniversaries: [],
};
const empty = await renderInRouter(
  <ArchivePage
    download={noDownload}
    selectedYear={undefined}
    view={emptyView}
  />,
);

/*
 * A grid of 371 outlines under two zeroes says nothing except that the writer
 * has not started, so a journal with nothing in it gets a sentence instead.
 */
it('says the journal is empty rather than drawing an empty one', () => {
  expect(empty).toContain('Nothing has been written yet');
  expect(empty).not.toContain('Streaks');
  expect(empty).not.toContain('role="img"');
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

it('points the grid at the description that stands in for it', () => {
  const described = describedBy.exec(filled)?.groups?.id;
  expect(described).toBeDefined();
  expect(filled).toContain(`id="${described}"`);
});

/*
 * The squares are not links — 371 of them in the tab order would put the whole
 * year between the writer and the next thing on the page — so the way into a
 * day is the table, and every day written has to be a link in it.
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
  expect(rolling).toContain('after:scale-x-100');
});

/*
 * "On this day" is the one part of the archive that is there to be read. It
 * leads with the writer's own words, and the whole line opens the day, because
 * the reason to go back is the sentence and not the date above it.
 */
it('reads back an earlier year and opens the day it came from', async () => {
  const withMemory = await renderInRouter(
    <ArchivePage
      download={noDownload}
      selectedYear={undefined}
      view={{
        ...sampleArchiveView(journal, today),
        anniversaries: [
          {
            date: '2025-08-26',
            yearsAgo: 1,
            words: 210,
            snippet: 'Moved the desk under the window.',
          },
        ],
      }}
    />,
  );
  expect(withMemory).toContain('On this day');
  expect(withMemory).toContain('Moved the desk under the window.');
  expect(plainText(withMemory)).toContain('1 year ago');
  expect(withMemory).toContain('href="/day/2025-08-26"');
});

it('leaves out on this day in a journal with no earlier years', () => {
  expect(filled).not.toContain('On this day');
});

/* One page, one first-level heading, with every section a level below it. */
it('names the page once and puts every section under it', () => {
  expect(filled.match(/<h1\b/gu)?.length).toBe(1);
  expect(elementAttributes(filled, 'h1', 'Archive')).not.toBe('');
  expect(elementAttributes(filled, 'h2', 'Activity')).not.toBe('');
});

/*
 * The way out of the app is on the page that says what is in it. A journal with
 * nothing written has nothing to hand over, so the offer is not made there —
 * being told an empty download is available is worse than not being told.
 */
it('offers the journal as a download, and not before there is one', () => {
  expect(plainText(filled)).toContain('Download the journal');
  expect(elementAttributes(filled, 'h2', 'Your own copy')).not.toBe('');
  expect(empty).not.toContain('Download the journal');
});
