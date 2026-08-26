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

import { createContext, type ReactNode, useContext, useEffect } from 'react';

import { columnClass } from '#/shared/ui/design-classes.ts';
import { primaryButtonClass } from '#/shared/ui/form-classes.ts';
import { pageTitle } from '#/shared/ui/page-title.ts';
import { UnmarkedLink } from '#/shared/ui/unmarked-link.tsx';

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

const FallbackBody = ({ heading, message }: FallbackContent) => {
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
    <section>
      <h1 className="font-display text-4xl text-ink sm:text-5xl">{heading}</h1>
      <p className="mt-8 max-w-prose border-border border-t pt-8 text-ink-muted text-lg">
        {message}
      </p>
      {/* The way back is an action, and the failing address can be "/" itself
          — a bad search param on the home page, or an error inside it — so it
          goes through the link that never marks itself as the current page. */}
      <p className="mt-10">
        <UnmarkedLink
          activeProps={{ className: '' }}
          className={primaryButtonClass}
          to="/"
        >
          Back to Postlude
        </UnmarkedLink>
      </p>
    </section>
  );
};

/*
 * The shell sets no column — each page picks its own measure — so the fallback
 * sets the text column either way, and both branches below render that one
 * wrapper exactly once. What the branches decide is only the landmark: inside
 * the shell the fallback is already in the one <main> the page gets, and a
 * failure that never reached the shell has to open it, the way the sign-in
 * page does.
 */
const FallbackPage = ({ heading, message }: FallbackContent) => {
  const column = (
    <div className={columnClass}>
      <FallbackBody heading={heading} message={message} />
    </div>
  );

  return useContext(MainLandmarkContext) ? (
    column
  ) : (
    <main className="flex min-h-svh flex-col justify-center bg-background py-16">
      {column}
    </main>
  );
};

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
