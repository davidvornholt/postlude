# Project-specific rules

## Effect in apps/web

- `src/features/journal/services/entry-repository.ts` is the pattern for a feature service.
- Each feature composes its services into one runtime beside them. For the journal that is `journal-runtime.ts`, and its `runJournalEffect` is the only place a journal Effect becomes a promise. Add a new service to that runtime's layer instead of running it ad hoc.
- The better-auth glue in `src/shared/auth/*` keeps plain promise signatures, because better-auth calls those functions itself and awaits them, so an Effect signature would only be unwrapped again at every call.
- `scripts/serve.ts`, the production entrypoint, stays plain. It boots and stops the server and owns no service logic.

## Database access in apps/web

`@postlude/db/connections` is the only place a pool is configured or sized. Server code takes both pools from `src/shared/db/database.ts`. Scripts and tests open their own through `@postlude/db/connections` and close them.

Tests that need a database use `src/shared/testing/test-database.ts`. They fail rather than skip when `DATABASE_URL` is absent.

## Corners

Corners are square or fully rounded. App code uses only `rounded-none` and `rounded-full` and declares no corner radius in CSS or inline styles. Radius declarations belong to the shared UI theme.

## Styling

Style components with Tailwind utilities and keep shared tokens in the UI theme. Application CSS is only for global defaults, generated editor content, and small behavior rules such as native dialog transitions. Share repeated controls and layouts through components with explicit variants, not exported class bundles. Small typography and focus utilities may be shared across unrelated elements.
