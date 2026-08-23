/**
 * Router-level fallbacks. TanStack Router's built-ins render an unlandmarked
 * "Not Found" string and an unthemed debug panel, so both states get a real
 * page here: one heading, a descriptive title, and a way back.
 *
 * A route's error or not-found component renders in place of that route's own
 * match, not at the top of the page. For a route under `_app` that place is
 * inside the shell's <main>, and a second <main> there would leave the page
 * with two main landmarks; for a failure that never reached the shell there is
 * no landmark yet and the fallback has to open the only one. Only the shell
 * knows which case a fallback is in, so it says so through `InsideMainLandmark`
 * and the fallback picks its wrapper from that.
 */

import { Link } from '@tanstack/react-router';
import { createContext, type ReactNode, useContext, useEffect } from 'react';

import { primaryButtonClass } from '#/shared/ui/form-classes.ts';
import { pageTitle } from '#/shared/ui/page-title.ts';

const MainLandmarkContext = createContext(false);

export const InsideMainLandmark = ({
  children,
}: {
  readonly children: ReactNode;
}) => <MainLandmarkContext value={true}>{children}</MainLandmarkContext>;

type FallbackContent = {
  readonly heading: string;
  readonly message: string;
};

const FallbackCard = ({ heading, message }: FallbackContent) => {
  // The document head is built from the head data of the matched routes, and a
  // fallback replaces a match rather than becoming one, so it has no way to
  // contribute a title through the router. Server-rendered markup therefore
  // keeps the title of the route that failed; this is what corrects the window
  // title once the page is live. Writing it here rather than rendering a
  // <title> element keeps the head to the one title the HTML spec allows — a
  // hoisted second title lands after the router's and browsers use the first,
  // so it would not fix the server-rendered case anyway.
  useEffect(() => {
    document.title = pageTitle(heading);
  }, [heading]);

  return (
    <div className="w-full max-w-sm border border-border bg-surface p-8 shadow-card">
      <h1 className="font-display text-3xl text-ink tracking-tight">
        {heading}
      </h1>
      <p className="mt-3 text-ink-muted">{message}</p>
      <Link className={`${primaryButtonClass} mt-8 w-full`} to="/">
        Back to Postlude
      </Link>
    </div>
  );
};

const FallbackPage = ({ heading, message }: FallbackContent) =>
  useContext(MainLandmarkContext) ? (
    <FallbackCard heading={heading} message={message} />
  ) : (
    <main className="flex min-h-svh items-center justify-center bg-background px-6">
      <FallbackCard heading={heading} message={message} />
    </main>
  );

export const RouterNotFound = () => (
  <FallbackPage
    heading="Page not found"
    message="There is nothing at this address, so the link that brought you here is either old or mistyped."
  />
);

export const RouterError = () => (
  <FallbackPage
    heading="Something went wrong"
    message="This page could not be loaded, and trying again is usually enough."
  />
);
