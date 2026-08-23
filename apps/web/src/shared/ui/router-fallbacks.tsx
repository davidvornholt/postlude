/**
 * Router-level fallbacks. TanStack Router's built-ins render an unlandmarked
 * "Not Found" string and an unthemed debug panel, so both states get a real
 * page here: one landmark, one heading, and a way back.
 */

import { Link } from '@tanstack/react-router';

import { primaryButtonClass } from '#/shared/ui/form-classes.ts';

const FallbackPage = ({
  heading,
  message,
}: {
  readonly heading: string;
  readonly message: string;
}) => (
  <main className="flex min-h-svh items-center justify-center bg-background px-6">
    <div className="w-full max-w-sm border border-border bg-surface p-8 shadow-card">
      <h1 className="font-display text-3xl text-ink tracking-tight">
        {heading}
      </h1>
      <p className="mt-3 text-ink-muted">{message}</p>
      <Link className={`${primaryButtonClass} mt-8 w-full`} to="/">
        Back to Postlude
      </Link>
    </div>
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
