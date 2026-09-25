# @postlude/web

Setup and operations are in the [repository README](../../README.md).

Run `bun run build` to regenerate `src/routeTree.gen.ts`. TanStack Start owns the route tree and its framework registration footer together.

The server bundle requires the installed workspace dependencies beside it at runtime, including `@postlude/db` and its TypeScript source. The production Dockerfile supplies that installation; copying only `dist/server` is insufficient.
