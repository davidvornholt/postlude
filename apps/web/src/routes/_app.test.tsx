/**
 * The signed-in shell is the one surface nothing else in the repository can
 * see. Signing in runs through a real GitHub OAuth round trip, so the browser
 * accessibility suite in `a11y/routes.a11y.ts` stops at the sign-in page and
 * never renders this header at all. Without the assertions below, an edit that
 * takes the "you are here" marking down to a difference in hue, collapses the
 * page to two main landmarks, or points the skip link at nothing, passes every
 * gate the repository has.
 *
 * The shell is rendered through a real router rather than on its own, because
 * which link the router marks as current is the whole subject: the marking is
 * something the router decides from the address, not something the component
 * can be asked for.
 *
 * Two modules are replaced to get there:
 *
 * - `session-fn.ts` holds the route's `beforeLoad` guard, and importing it
 *   reaches better-auth, the Drizzle adapter, the connection pool, and the
 *   validated server environment. None of that decides a character of the
 *   markup, and leaving it in place would make rendering a header require a
 *   database URL and an OAuth secret.
 * - `useMutation` is where the sign-out control's pending and error states come
 *   from. Server rendering never dispatches a click, so handing the component
 *   the state a click would produce is the only way to see the in-flight markup
 *   at all. The hook is replaced rather than the control, because the wiring
 *   from mutation state to `aria-busy` is exactly what has to stay visible.
 */

import { expect, it, mock } from 'bun:test';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { renderToString } from 'react-dom/server';

import {
  attributeValue,
  classNames,
  countElements,
  elementAttributes,
  openingTag,
} from '#/shared/testing/rendered-html.ts';

type SignOutState = {
  readonly isError: boolean;
  readonly isPending: boolean;
};

const idle: SignOutState = { isError: false, isPending: false };
let signOutState: SignOutState = idle;

const reactQuery = await import('@tanstack/react-query');
mock.module('@tanstack/react-query', () => ({
  ...reactQuery,
  useMutation: () => ({ ...signOutState, mutate: () => undefined }),
}));

mock.module('#/shared/auth/session-fn.ts', () => ({
  hasAuthorizedSessionFn: () => Promise.resolve(true),
}));

const { Route } = await import('#/routes/_app.tsx');

const pageComponent = () => <h1>A page</h1>;

const rootRoute = createRootRoute();

const shellRoute = createRoute({
  component: Route.options.component,
  getParentRoute: () => rootRoute,
  id: 'shell',
});

const todayRoute = createRoute({
  component: pageComponent,
  getParentRoute: () => shellRoute,
  path: '/',
});

const archiveRoute = createRoute({
  component: pageComponent,
  getParentRoute: () => shellRoute,
  path: '/archive',
});

const routeTree = rootRoute.addChildren([
  shellRoute.addChildren([todayRoute, archiveRoute]),
]);

const renderAt = async (
  path: string,
  state: SignOutState = idle,
): Promise<string> => {
  signOutState = state;
  const router = createRouter({
    history: createMemoryHistory({ initialEntries: [path] }),
    routeTree,
  });
  await router.load();
  const html = renderToString(<RouterProvider router={router} />);
  signOutState = idle;
  return html;
};

/**
 * The design's "you are here" that is not a colour: a hairline rule under the
 * label, resting at full width on the page you are on and at zero width under
 * every other link. Both are asserted on both links, so removing the marking
 * fails here whether the replacement leaves the rule out or leaves it in at the
 * wrong resting width.
 */
const ruleAtFullWidth = 'after:scale-x-100';
const ruleAtZeroWidth = 'after:scale-x-0';

const navLink = (html: string, label: string): string =>
  elementAttributes(html, 'a', label);

it('marks the page you are on by more than its colour', async () => {
  const html = await renderAt('/');
  const current = navLink(html, 'Today');
  const other = navLink(html, 'Archive');

  expect(current).toContain('aria-current="page"');
  expect(classNames(current).has(ruleAtFullWidth)).toBe(true);
  expect(classNames(current).has(ruleAtZeroWidth)).toBe(false);

  expect(other).toContain('href="/archive"');
  expect(other).not.toContain('aria-current');
  expect(classNames(other).has(ruleAtZeroWidth)).toBe(true);
  expect(classNames(other).has(ruleAtFullWidth)).toBe(false);
});

/*
 * The same shape at the app's other address, because the marking has to follow
 * the address rather than sit on a link. A marker handed to every link, or one
 * baked into the first item in the list, still reads as correct at "/" and only
 * comes apart here, where the reader would be told they are in two places at
 * once.
 */
it('marks only one page as current away from home', async () => {
  const html = await renderAt('/archive');
  const current = navLink(html, 'Archive');
  const other = navLink(html, 'Today');

  expect(current).toContain('aria-current="page"');
  expect(classNames(current).has(ruleAtFullWidth)).toBe(true);

  expect(other).toContain('href="/"');
  expect(other).not.toContain('aria-current');
  expect(classNames(other).has(ruleAtFullWidth)).toBe(false);
});

it('opens one main landmark and points the skip link at it', async () => {
  const html = await renderAt('/');

  expect(countElements(html, 'main')).toBe(1);
  const target = attributeValue(openingTag(html, 'main'), 'id');
  expect(target).not.toBe('');
  expect(attributeValue(navLink(html, 'Skip to content'), 'href')).toBe(
    `#${target}`,
  );
});

/*
 * Postlude is read and written on a phone, and this button is the only way out
 * of the app. A `hover:` utility is emitted inside `@media (hover: hover)`, so
 * a coarse pointer never applies one: whatever says these words can be pressed
 * has to be in the resting class set. The rule is asserted as present and as
 * not resting at zero width, so a change that puts the affordance back behind
 * the pointer fails here rather than shipping as inert-looking type.
 */
it('gives the sign-out control a rule without waiting for a pointer', async () => {
  const html = await renderAt('/');
  const control = classNames(openingTag(html, 'button'));

  expect(control.has('after:h-px')).toBe(true);
  expect(control.has('after:bg-current')).toBe(true);
  expect(control.has(ruleAtZeroWidth)).toBe(false);
  expect(
    [...control].filter((name) => name.startsWith('hover:after:')),
  ).toEqual([]);
});

it('says the sign-out control is busy only while it is signing out', async () => {
  const resting = await renderAt('/');
  const signingOut = await renderAt('/', { isError: false, isPending: true });

  expect(countElements(resting, 'button')).toBe(1);
  expect(openingTag(resting, 'button')).toContain('type="button"');
  expect(openingTag(resting, 'button')).toContain('aria-busy="false"');
  expect(openingTag(signingOut, 'button')).toContain('aria-busy="true"');
});

it('raises a failed sign-out as an alert', async () => {
  const resting = await renderAt('/');
  const failed = await renderAt('/', { isError: true, isPending: false });

  expect(resting).not.toContain('role="alert"');
  expect(failed).toContain('role="alert"');
});
