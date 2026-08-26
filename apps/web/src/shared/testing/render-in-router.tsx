/**
 * Server-renders a piece of the app that contains links.
 *
 * A `<Link>` asks the router where it points, so a component holding one cannot
 * be rendered on its own: without a router around it there is nothing to build
 * an `href` from. Tests that are about the markup rather than about routing
 * still need one, and this is it — a router whose only job is to know the app's
 * addresses.
 *
 * The addresses are listed here rather than taken from the real route tree,
 * which would pull every route's loader, and with them the database and the
 * validated server environment, into a test about markup. The list is short and
 * a link to an address missing from it fails loudly.
 */

import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { renderToString } from 'react-dom/server';

const appPaths = ['/', '/archive', '/day/$date'] as const;

const emptyComponent = () => null;

/** The same small router for server markup and hydrated browser fixtures. */
export const createRenderingRouter = (element: ReactNode) => {
  // The subject is the root route's own component, so no `<Outlet />` is
  // rendered and the placeholder pages below never appear in the markup.
  const rootRoute = createRootRoute({ component: () => element });
  return createRouter({
    history: createMemoryHistory({ initialEntries: ['/'] }),
    routeTree: rootRoute.addChildren(
      appPaths.map((path) =>
        createRoute({
          component: emptyComponent,
          getParentRoute: () => rootRoute,
          path,
        }),
      ),
    ),
  });
};

export const renderInRouter = async (element: ReactNode): Promise<string> => {
  const router = createRenderingRouter(element);
  await router.load();
  return renderToString(<RouterProvider router={router} />);
};
