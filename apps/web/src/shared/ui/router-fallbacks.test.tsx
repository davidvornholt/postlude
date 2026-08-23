/**
 * The fallbacks are rendered through a real router rather than on their own,
 * because what they get wrong is only visible in place: a route's error or
 * not-found component replaces that route's match, so whether the fallback
 * lands inside the shell's <main> depends on which route failed. The tree below
 * is the smallest one that reproduces all four positions, and the assertions
 * count landmarks and read link attributes off the rendered HTML.
 *
 * `BrandLink` is asserted here too rather than beside its own file: the only
 * position where the router would mark it as the current page is a position
 * this tree already builds, and a second copy of the tree would be the cost of
 * moving it.
 *
 * The route components are named in camelCase because they are passed to the
 * router as option values and never written as a JSX tag.
 */

import { expect, it } from 'bun:test';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  notFound,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { renderToString } from 'react-dom/server';

import { BrandLink } from './brand-link.tsx';
import {
  InsideMainLandmark,
  RouterError,
  RouterNotFound,
} from './router-fallbacks.tsx';

/** The shape `_app` gives the page: a wordmark, then the one main landmark. */
const shellComponent = () => (
  <div>
    <BrandLink>Wordmark</BrandLink>
    <main>
      <InsideMainLandmark>
        <Outlet />
      </InsideMainLandmark>
    </main>
  </div>
);

const unreachedComponent = () => <p>never rendered</p>;

const rootRoute = createRootRoute();

const shellRoute = createRoute({
  component: shellComponent,
  getParentRoute: () => rootRoute,
  id: 'shell',
});

const failingIndexRoute = createRoute({
  component: unreachedComponent,
  getParentRoute: () => shellRoute,
  loader: () => {
    throw new Error('the home page loader failed');
  },
  path: '/',
});

const missingChildRoute = createRoute({
  component: unreachedComponent,
  getParentRoute: () => shellRoute,
  loader: () => {
    throw notFound();
  },
  path: '/gone',
});

/** The shell's own guard failing, which is what `_app`'s `beforeLoad` can do. */
const guardedShellRoute = createRoute({
  beforeLoad: () => {
    throw new Error('the shell guard failed');
  },
  component: shellComponent,
  getParentRoute: () => rootRoute,
  path: '/guarded',
});

const guardedChildRoute = createRoute({
  component: unreachedComponent,
  getParentRoute: () => guardedShellRoute,
  path: '/',
});

const routeTree = rootRoute.addChildren([
  shellRoute.addChildren([failingIndexRoute, missingChildRoute]),
  guardedShellRoute.addChildren([guardedChildRoute]),
]);

const renderAt = async (path: string): Promise<string> => {
  const router = createRouter({
    defaultErrorComponent: RouterError,
    defaultNotFoundComponent: RouterNotFound,
    history: createMemoryHistory({ initialEntries: [path] }),
    routeTree,
  });
  await router.load();
  return renderToString(<RouterProvider router={router} />);
};

const mainLandmarks = (html: string): number =>
  html.match(/<main\b/gu)?.length ?? 0;

/**
 * The attributes of the one anchor with this exact text. Attribute order is
 * React's to choose and it varies between renders, so callers match on
 * substrings rather than on a whole tag.
 */
const linkAttributes = (html: string, text: string): string =>
  Array.from(
    html.matchAll(/<a(?<attributes>[^>]*)>(?<text>[^<]*)</gu),
    (match) => ({
      attributes: match.groups?.attributes ?? '',
      text: match.groups?.text ?? '',
    }),
  ).find((anchor) => anchor.text === text)?.attributes ?? '';

it('keeps one main landmark when a route inside the shell fails', async () => {
  const html = await renderAt('/');

  expect(html).toContain('Something went wrong');
  expect(mainLandmarks(html)).toBe(1);
});

it('keeps one main landmark when a route inside the shell is not found', async () => {
  const html = await renderAt('/gone');

  expect(html).toContain('Page not found');
  expect(mainLandmarks(html)).toBe(1);
});

it('opens a main landmark for an address that never reached the shell', async () => {
  const html = await renderAt('/nowhere');

  expect(html).toContain('Page not found');
  expect(mainLandmarks(html)).toBe(1);
});

it('opens a main landmark when the shell guard itself fails', async () => {
  const html = await renderAt('/guarded');

  expect(html).toContain('Something went wrong');
  expect(mainLandmarks(html)).toBe(1);
});

/*
 * Both of the next two render at "/", which is where the two links point: that
 * is the only position where the router would mark them, so it is the only
 * position where the assertion means anything. `href="/"` is asserted first so
 * a renamed or missing link fails there instead of passing an empty attribute
 * string through the negative assertions.
 */
it('leaves the wordmark unmarked on the page it points at', async () => {
  const attributes = linkAttributes(await renderAt('/'), 'Wordmark');

  expect(attributes).toContain('href="/"');
  expect(attributes).not.toContain('aria-current');
  expect(attributes).not.toContain('data-status');
  expect(attributes).not.toContain(' active"');
});

it('leaves the way back unmarked on the page it points at', async () => {
  const attributes = linkAttributes(await renderAt('/'), 'Back to Postlude');

  expect(attributes).toContain('href="/"');
  expect(attributes).not.toContain('aria-current');
  expect(attributes).not.toContain('data-status');
  expect(attributes).not.toContain(' active"');
});
