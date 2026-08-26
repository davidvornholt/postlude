# Project-specific rules

## Effect posture in apps/web

The Effect data layer is in place, adopted with the journal feature (issue #7). The posture is per surface:

- Route and feature code: feature services own the async work with typed error and requirement channels; route components stay plain React and consume those services at the boundary. `src/features/journal/services/entry-repository.ts` is the pattern to follow — an `Effect.Service` over `SqlClient`, with `Data.TaggedError` failures in its error channel and no clock of its own.
- Each feature owns its runtime composition beside its services. For the journal, `src/features/journal/services/journal-runtime.ts` holds one lazily built `ManagedRuntime`, and `runJournalEffect` is the only place a journal Effect becomes a promise. Add a journal service to the layer there rather than running it ad hoc, so the layers are built once per process and a service is never unwrapped twice. Shared code remains feature-agnostic and may provide infrastructure such as the database pool to feature runtimes.
- better-auth glue in `src/shared/auth/*`: stays plain promises. better-auth calls these functions itself and awaits what they return, so it owns the calling convention, and an Effect signature would only be wrapped and unwrapped again at every call site.
- `scripts/serve.ts`: stays plain. It is the production entrypoint — it reads `PORT`, loads the built SSR bundle, serves the static client files, and boots the server — and the architecture boundaries in `AGENTS.md` scope entrypoints to routing, parsing initial inputs, wiring layers, and bridging to the runtime, not to owning service logic.

## Database access in apps/web

One process, one pool. `@postlude/db`'s `createPool` owns the connection string; better-auth's Drizzle adapter and the Effect SQL client both receive that same pool through `pgClientLayer`, which never opens or closes one of its own. A second pool would be a second copy of configuration the package already owns.

Tests that need a database use `src/shared/testing/test-database.ts`, which creates and migrates the configured database with `_test` appended and rolls each test body back. They fail rather than skip when `DATABASE_URL` is absent.
