# @postlude/db

Drizzle schema, migrations, and the shared Postgres pool factory.

- `src/schema.ts` — the `entry` table: one row per journal day, keyed by calendar date, with journal and scripture sections plus persisted word counts for the archive heatmap. Each upsert increments the row's positive `revision`, which orders saves even when PostgreSQL gives adjacent writes the same JavaScript millisecond timestamp. Check constraints reject non-positive revisions, negative word counts, half-filled scripture references, and a scripture book that holds no letter at all (`~ '[[:alpha:]]'`), which also rules out a book built only from invisible characters such as a non-breaking space or a zero-width space. A reference is half-filled when it names a book without a chapter or a chapter without a book; the verse is genuinely optional, because a whole chapter such as "Psalms 23" is a reference a writer will type. A verse start still requires a chapter to belong to, and a verse end still requires a start it is not before. `created_at` is stamped by the database clock through its column default. `updated_at` carries the database clock's `now()` as well, but no database trigger stands behind it: the Drizzle client writes `now()` into the updates it issues, so a write that bypasses Drizzle, or one that sets `updatedAt` explicitly, sets the value itself.
- `src/auth-schema.ts` — better-auth tables (user, session, account, verification). The shape is dictated by better-auth's `getAuthTables()`; `account` carries `issuer` plus a unique index over (`issuer`, `account_id`), which better-auth reads on every OAuth callback.
- `src/pool.ts` — `createPool(connectionString)`; one shared pool per process, with an `error` listener so a dropped idle connection is logged instead of crashing the process.
- `src/postgres-date.ts` — `preservePostgresDates()`; installs pg's global DATE parser so a calendar date never passes through a timezone. It applies only to raw `pool.query` reads: Drizzle attaches its own per-query parser that already returns DATE as text, and a per-query parser wins over the global one. Nothing in the app reads outside Drizzle today, so the guard exists to make the first raw query correct by default.
- `src/effect-client.ts` — `pgClientLayer(pool)`; the Effect SQL client wrapped around a pool this package already created. It only hands the pool over and never opens or closes one, because better-auth's Drizzle adapter holds the same object: one process, one pool, one place the connection string is configured.
- `src/migrate.ts` / `scripts/migrate.ts` — Effect-wrapped migration runner.

## Workflow

Migrations are always generated, never handwritten:

```sh
bun run db:generate        # drizzle-kit generate (reads .env.local)
bun run db:migrate         # apply locally (reads .env.local)
bun run db:migrate:deploy  # apply with DATABASE_URL from the environment
```

`.env.local` is composed by `just dev-env-generate`; the dev Postgres container is managed by `just dev-db-start` (see the repo README).

## Migration history

The checked-in migration history is append-only because journal databases already carry its Drizzle timestamps. Keep existing migrations and snapshots unchanged. Change the schema source, run `bun run db:generate`, and commit the next migration with its snapshot and journal entry.

## Environment

| Variable       | Purpose                                       | Required                                                                                         | Source                                                                       |
| -------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `DATABASE_URL` | Postgres connection string for the db:* scripts | Required, no default. `drizzle.config.ts` and `scripts/migrate.ts` throw `DATABASE_URL is not set.` when it is missing or empty | `config/dev.yaml` under `packages.db`, generated into `.env.local` by `just dev-env-generate` |
