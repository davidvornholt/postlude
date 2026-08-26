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
 * needs a real GitHub OAuth round trip, so these two pages are rendered by no
 * other check in the repository.
 *
 * The pages are rendered rather than read, and no router is involved: neither
 * one reads the address, so the component is the whole of what a reader gets.
 */

import { expect, it } from 'bun:test';
import { type ComponentType, createElement } from 'react';
import { renderToString } from 'react-dom/server';

import { countRecipe } from '#/shared/testing/rendered-html.ts';
import { columnClass, wideColumnClass } from '#/shared/ui/design-classes.ts';
import { Route as archiveRoute } from './archive.tsx';
import { Route as todayRoute } from './index.tsx';

// A route's component is optional to the router's types and never absent here,
// so a missing one renders as no markup and fails the counts below rather than
// needing an assertion of its own.
const render = (component: ComponentType | undefined): string =>
  component === undefined ? '' : renderToString(createElement(component));

const today = render(todayRoute.options.component);
const archive = render(archiveRoute.options.component);

/*
 * Both measures are asserted on both pages, so re-narrowing the archive to the
 * text column fails here rather than reading as a page that simply kept the
 * default. Exactly one wrapper each: a page nested in two columns reads as an
 * indent rather than as a measure.
 */
it('keeps the writing page at the text column', () => {
  expect(countRecipe(today, columnClass)).toBe(1);
  expect(countRecipe(today, wideColumnClass)).toBe(0);
});

it('gives the archive the wider measure the year grid needs', () => {
  expect(countRecipe(archive, wideColumnClass)).toBe(1);
  expect(countRecipe(archive, columnClass)).toBe(0);
});
