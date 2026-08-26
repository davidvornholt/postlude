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
 * The writing page is rendered as its component rather than through its route,
 * because the route's whole body is that component and reaching it through the
 * route would need a loader, and with it a database.
 */

import { expect, it } from 'bun:test';
import { type ComponentType, createElement } from 'react';
import { renderToString } from 'react-dom/server';
import type { JournalEntry } from '#/features/journal/schemas/entry.ts';
import { DayPage } from '#/features/journal/ui/day-page.tsx';
import { renderInRouter } from '#/shared/testing/render-in-router.tsx';
import { countRecipe } from '#/shared/testing/rendered-html.ts';
import { columnClass, wideColumnClass } from '#/shared/ui/design-classes.ts';
import { Route as archiveRoute } from './archive.tsx';

const emptyDay: JournalEntry = {
  date: '2026-08-26',
  journalMarkdown: '',
  journalWordCount: 0,
  scriptureMarkdown: '',
  scriptureWordCount: 0,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

// A route's component is optional to the router's types and never absent here,
// so a missing one renders as no markup and fails the counts below rather than
// needing an assertion of its own.
const render = (component: ComponentType | undefined): string =>
  component === undefined ? '' : renderToString(createElement(component));

// Nothing types during a render, so the save port is one that never resolves.
const neverSaves = () => new Promise<never>(() => undefined);

const today = await renderInRouter(
  <DayPage entry={emptyDay} save={neverSaves} today={emptyDay.date} />,
);
const archive = render(archiveRoute.options.component);

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
