/**
 * Which measure each page under the shell sets around itself.
 *
 * The shell used to set one column for every page. It stopped, so that the
 * archive can take the wider measure a year of days needs and the morning
 * scripture's deep register can reach the viewport edges — but a measure the
 * shell no longer sets is one nothing sets unless each page sets its own, and
 * dropping a page's wrapper is a one-line edit that looks like tidying.
 *
 * Nothing else would notice. The browser accessibility suite in
 * `a11y/routes.a11y.ts` stops at the sign-in page, because getting past it
 * needs a real GitHub OAuth round trip, so these pages are rendered by no other
 * check in the repository.
 *
 * Both pages are rendered as their components rather than through their routes,
 * because a route's whole body is its component and reaching it through the
 * route would need a loader, and with it a database.
 */

import { expect, it } from 'bun:test';
import type { JournalEntry } from '#/features/journal/schemas/entry.ts';
import {
  sampleArchiveView,
  sampleJournal,
} from '#/features/journal/testing/archive-view.ts';
import { ArchivePage } from '#/features/journal/ui/archive-page.tsx';
import { DayPage } from '#/features/journal/ui/day-page.tsx';
import { renderInRouter } from '#/shared/testing/render-in-router.tsx';
import { countRecipe } from '#/shared/testing/rendered-html.ts';
import { columnClass, wideColumnClass } from '#/shared/ui/design-classes.ts';

const emptyDay: JournalEntry = {
  date: '2026-08-26',
  journalMarkdown: '',
  journalWordCount: 0,
  journalFirstUsedAt: null,
  scriptureMarkdown: '',
  scriptureWordCount: 0,
  scriptureFirstUsedAt: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

// Nothing types during a render, so the save port is one that never resolves.
const neverSaves = () => new Promise<never>(() => undefined);

// Nothing is pressed during a render either, so the download is never called.
const neverDownloads = () => new Promise<never>(() => undefined);

const today = await renderInRouter(
  <DayPage entry={emptyDay} save={neverSaves} today={emptyDay.date} />,
);
const archiveSeed = 20_260_826;
const sampleDays = 400;
const archive = await renderInRouter(
  <ArchivePage
    download={neverDownloads}
    selectedYear={undefined}
    view={sampleArchiveView(
      sampleJournal(emptyDay.date, sampleDays, archiveSeed),
      emptyDay.date,
    )}
  />,
);

/*
 * Three columns, because the writing page is three blocks: the day's heading,
 * the deep register's own column inside its edge-to-edge ground, and the
 * evening's writing. The register sets its own rather than sharing the page's,
 * which is the whole reason the shell gave the measure up — a ground that has
 * to reach the viewport edges cannot do it from inside a column.
 *
 * Both measures are asserted on both pages, so re-narrowing the archive to the
 * text column fails here rather than reading as a page that simply kept the
 * default.
 */
const writingPageColumns = 3;

it('keeps the writing page at the text column', () => {
  expect(countRecipe(today, columnClass)).toBe(writingPageColumns);
  expect(countRecipe(today, wideColumnClass)).toBe(0);
});

/*
 * The register's ground is a sibling of the columns rather than a child of one,
 * and its own column is inside it. Wrapping the page in a single column instead
 * would leave the panel inset, which reads as a card — the one thing the design
 * has none of — and would show up here as a fourth wrapper.
 */
it('renders the deep register on its own ground', () => {
  expect(today).toContain('bg-deep-ground');
});

it('gives the archive the wider measure the year grid needs', () => {
  expect(countRecipe(archive, wideColumnClass)).toBe(1);
  expect(countRecipe(archive, columnClass)).toBe(0);
});
