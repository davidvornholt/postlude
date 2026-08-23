# @postlude/db

Drizzle schema, migrations, and the shared Postgres pool factory.

- `src/schema.ts` — the `entry` table: one row per journal day, keyed by calendar date, with journal and scripture sections plus persisted word counts for the archive heatmap. Check constraints reject negative word counts, half-filled scripture references, and a scripture book that holds no non-whitespace character. `created_at` and `updated_at` are both stamped by the database clock — `updated_at` is restamped with `now()` on every update — so the pair cannot invert when an app process disagrees with the database about the time.
- `src/auth-schema.ts` — better-auth tables (user, session, account, verification). The shape is dictated by better-auth's `getAuthTables()`; `account` carries `issuer` plus a unique index over (`issuer`, `account_id`), which better-auth reads on every OAuth callback.
- `src/pool.ts` — `createPool(connectionString)`; one shared pool per process, with an `error` listener so a dropped idle connection is logged instead of crashing the process.
- `src/postgres-date.ts` — `preservePostgresDates()`; installs pg's global DATE parser so a calendar date never passes through a timezone. It applies only to raw `pool.query` reads: Drizzle attaches its own per-query parser that already returns DATE as text, and a per-query parser wins over the global one. Nothing in the app reads outside Drizzle today, so the guard exists to make the first raw query correct by default.
- `src/migrate.ts` / `scripts/migrate.ts` — Effect-wrapped migration runner.

## Workflow

Migrations are always generated, never handwritten:

```sh
bun run db:generate        # drizzle-kit generate (reads .env.local)
bun run db:migrate         # apply locally (reads .env.local)
bun run db:migrate:deploy  # apply with DATABASE_URL from the environment
```

`.env.local` is composed by `just dev-env-generate`; the dev Postgres container is managed by `just dev-db-start` (see the repo README).

## Environment

| Variable       | Purpose                                       | Required                                                                                         | Source                                                                       |
| -------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `DATABASE_URL` | Postgres connection string for the db:* scripts | Required, no default. `drizzle.config.ts` and `scripts/migrate.ts` throw `DATABASE_URL is not set.` when it is missing or empty | `config/dev.yaml` under `packages.db`, generated into `.env.local` by `just dev-env-generate` |
