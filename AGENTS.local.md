# Project-specific rules

## Effect posture in apps/web

`apps/web` has no app-owned async service boundaries yet, so no code in it uses Effect today. The posture is per surface:

- Route and feature code: the first app-owned feature brings in the Effect data layer. Feature services own the async work with typed error and requirement channels; route components stay plain React and consume those services at the boundary. Deferred to issue #7, "Adopt the Effect data layer with the first app-owned feature".
- better-auth glue in `src/shared/auth/*`: stays plain promises. better-auth calls these functions itself and awaits what they return, so it owns the calling convention, and an Effect signature would only be wrapped and unwrapped again at every call site.
- `scripts/serve.ts`: stays plain. It is the production entrypoint — it reads `PORT`, loads the built SSR bundle, serves the static client files, and boots the server — and the architecture boundaries in `AGENTS.md` scope entrypoints to routing, parsing initial inputs, wiring layers, and bridging to the runtime, not to owning service logic.

The deferred pattern is a single app runtime that holds the Effect layers plus a thin boundary that runs an Effect and hands React a promise, so services keep their typed channels while components keep their plain ones.
