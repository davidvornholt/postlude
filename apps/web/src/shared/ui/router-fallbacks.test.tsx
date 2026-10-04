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

import {
  countElements,
  countRecipe,
  elementAttributes,
  elementContent,
} from '#/shared/testing/rendered-html.ts';
import { BrandLink } from './brand-link.tsx';

import {
  InsideMainLandmark,
  RouterError,
  RouterNotFound,
} from './router-fallbacks.tsx';

const expectedPageFrame = 'mx-auto w-full max-w-4xl px-5 sm:px-8';

/**
 * Only the part of `_app` a fallback's position depends on: a wordmark it can
 * be marked against, and the one main landmark it can land inside. It is not
 * the shell — the real header sets the page frame around the masthead, and
 * this omits it — so the frame counts below read inside `<main>` only, and
 * what the real shell sets on `<main>` is pinned in `routes/_app.test.tsx`
 * against the real thing.
 */
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

const mainLandmarks = (html: string): number => countElements(html, 'main');

const frameWrappers = (html: string): number =>
  countRecipe(elementContent(html, 'main'), expectedPageFrame);

/** The attributes of the one anchor with this exact text. */
const linkAttributes = (html: string, text: string): string =>
  elementAttributes(html, 'a', text);

it.each([
  ['a route inside the shell fails', '/', 'Something went wrong'],
  ['a route inside the shell is not found', '/gone', 'Page not found'],
  ['an address never reached the shell', '/nowhere', 'Page not found'],
  ['the shell guard itself fails', '/guarded', 'Something went wrong'],
])(
  'renders exactly one main landmark when %s',
  async (_position, path, fallbackText) => {
    const html = await renderAt(path);

    expect(html).toContain(fallbackText);
    expect(mainLandmarks(html)).toBe(1);
  },
);

/*
 * The fallback owns its frame in both positions, because the shell hands the
 * page none. Two counts of one rather than a single count of two: a fallback
 * nested in a second frame reads as an indent, and one with no frame runs to
 * the viewport edges, and both would still total two across the pair.
 */
it('sets the page frame exactly once wherever a fallback lands', async () => {
  const insideShell = await renderAt('/gone');
  const neverReachedShell = await renderAt('/nowhere');

  expect(frameWrappers(insideShell)).toBe(1);
  expect(frameWrappers(neverReachedShell)).toBe(1);
});

/*
 * Both links render at "/", which is where they point: that is the only
 * position where the router would mark them, so it is the only position where
 * the assertion means anything. `href="/"` is asserted first so a renamed or
 * missing link fails there instead of passing an empty attribute string through
 * the negative assertions.
 */
it.each(['Wordmark', 'Back to Postlude'])(
  'leaves the %s link unmarked on the page it points at',
  async (text) => {
    const attributes = linkAttributes(await renderAt('/'), text);

    expect(attributes).toContain('href="/"');
    expect(attributes).not.toContain('aria-current');
    expect(attributes).not.toContain('data-status');
    expect(attributes).not.toContain(' active"');
  },
);
