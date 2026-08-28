/**
 * That every page under the shell sets the same frame around itself.
 *
 * The shell does not set one, because the morning scripture's deep register has
 * to reach the viewport edges and cannot do that from inside a frame the shell
 * has already closed around the page. So each page sets the shared frame itself
 * — and a frame nothing central sets is one a page can silently lose, since
 * dropping a wrapper is a one-line edit that looks like tidying.
 *
 * The production-route browser scan stops at the sign-in page because getting
 * past it needs a real GitHub OAuth round trip. The isolated writing-page
 * fixture renders the real day component, but it does not own the archive's
 * measure or count the exact wrappers on either page. Those contracts stay
 * here.
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
import { pageFrameClass } from '#/shared/ui/design-classes.ts';

const emptyDay: JournalEntry = {
  date: '2026-08-26',
  journalMarkdown: '',
  journalWordCount: 0,
  journalFirstUsedAt: null,
  scriptureMarkdown: '',
  scriptureWordCount: 0,
  revision: 0,
  scriptureFirstUsedAt: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

// Nothing types during a render, so the save port is one that never resolves.
const neverSaves = () => new Promise<never>(() => undefined);

const today = await renderInRouter(
  <DayPage entry={emptyDay} save={neverSaves} today={emptyDay.date} />,
);
const archiveSeed = 20_260_826;
const sampleDays = 400;
const archive = await renderInRouter(
  <ArchivePage
    selectedYear={undefined}
    view={sampleArchiveView(
      sampleJournal(emptyDay.date, sampleDays, archiveSeed),
      emptyDay.date,
    )}
  />,
);

/*
 * Three frames, because the writing page is three blocks: the day's heading,
 * the deep register's own frame inside its edge-to-edge ground, and the
 * evening's writing. The register sets its own rather than sharing the page's,
 * which is the whole reason the shell sets none — a ground that has to reach
 * the viewport edges cannot do it from inside a frame.
 */
const writingPageFrames = 3;

it('wraps the writing page in the shared frame', () => {
  expect(countRecipe(today, pageFrameClass)).toBe(writingPageFrames);
});

/*
 * The register's ground is a sibling of the frames rather than a child of one,
 * and its own frame is inside it. Wrapping the page in a single frame instead
 * would leave the panel inset, which reads as a card — the one thing the design
 * has none of — and would show up here as a fourth wrapper.
 */
it('renders the deep register on its own ground', () => {
  expect(today).toContain('bg-deep-ground');
});

/*
 * The same recipe as the writing page, not a second one that happens to be the
 * same width today: the masthead sits above both, and a page that drifted to
 * its own frame would move the brand under the reader as they walk from one to
 * the other. That is the complaint this frame was made one to answer.
 */
it('wraps the archive in the frame the writing page uses', () => {
  expect(countRecipe(archive, pageFrameClass)).toBe(1);
});
