import { afterAll, beforeEach, expect, it, mock } from 'bun:test';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  HeadContent,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { renderToString } from 'react-dom/server';
import {
  isIsolatedBunTestProcess,
  runIsolatedBunTest,
} from '#/shared/testing/isolated-bun-test.ts';
import { elementContent } from '#/shared/testing/rendered-html.ts';
import { RouterError, RouterNotFound } from '#/shared/ui/router-fallbacks.tsx';

const isFallbackProbeProcess = isIsolatedBunTestProcess(import.meta.dir);

type ReadOutcome = 'future' | 'failure';

let outcome: ReadOutcome = 'future';
let reads = 0;

if (isFallbackProbeProcess) {
  mock.module('#/features/journal/services/journal-fns.ts', () => ({
    readDatedJournalDay: () => {
      reads += 1;
      return outcome === 'future'
        ? Promise.resolve({ disposition: 'future' as const })
        : Promise.reject(new Error('The database is unavailable.'));
    },
    saveDraft: () =>
      Promise.reject(new Error('This route test does not save.')),
  }));
}
if (isFallbackProbeProcess) {
  beforeEach(() => {
    outcome = 'future';
    reads = 0;
  });

  afterAll(() => {
    mock.restore();
  });

  const { Route: sourceRoute } = await import('./day.$date.tsx');
  const { head, loader, params } = sourceRoute.options;

  if (
    head === undefined ||
    typeof loader !== 'function' ||
    params === undefined ||
    typeof params === 'function' ||
    params.parse === undefined ||
    params.stringify === undefined
  ) {
    throw new Error('The dated route is missing a tested boundary.');
  }

  const parseParams = params.parse;
  const stringifyParams = params.stringify;

  const rootRoute = createRootRoute({
    component: () => (
      <>
        <HeadContent />
        <Outlet />
      </>
    ),
    head: () => ({ meta: [{ title: 'Postlude' }] }),
  });

  const datedRoute = createRoute({
    component: () => <p>The day loaded.</p>,
    getParentRoute: () => rootRoute,
    head: (context) => head(context as unknown as Parameters<typeof head>[0]),
    loader: (context) =>
      loader(context as unknown as Parameters<typeof loader>[0]),
    params: {
      parse: (raw) => parseParams(raw),
      stringify: (parsed) => stringifyParams(parsed),
    },
    path: '/day/$date',
  });

  const renderAt = async (path: string): Promise<string> => {
    const router = createRouter({
      defaultErrorComponent: RouterError,
      defaultNotFoundComponent: RouterNotFound,
      history: createMemoryHistory({ initialEntries: [path] }),
      routeTree: rootRoute.addChildren([datedRoute]),
    });
    await router.load();
    return renderToString(<RouterProvider router={router} />);
  };

  const fallbackTests = () => {
    it('server-renders missing-page heading and metadata for a malformed date', async () => {
      const html = await renderAt('/day/not-a-date');

      expect(elementContent(html, 'h1')).toContain('Page not found');
      expect(elementContent(html, 'title')).toBe('Page not found · Postlude');
      expect(reads).toBe(0);
    });

    it('server-renders missing-page heading and metadata for a future date', async () => {
      const html = await renderAt('/day/2026-08-27');

      expect(elementContent(html, 'h1')).toContain('Page not found');
      expect(elementContent(html, 'title')).toBe('Page not found · Postlude');
      expect(reads).toBe(1);
    });

    it('keeps an operational failure out of missing-page metadata', async () => {
      outcome = 'failure';
      const html = await renderAt('/day/2026-08-25');

      expect(elementContent(html, 'h1')).toContain('Something went wrong');
      expect(elementContent(html, 'title')).toBe(
        'Journal unavailable · Postlude',
      );
      expect(reads).toBe(1);
    });
  };

  fallbackTests();
} else {
  it('runs dated fallback module mocks in an isolated process', () => {
    expect(() =>
      runIsolatedBunTest(import.meta.path, import.meta.dir),
    ).not.toThrow();
  });
}
