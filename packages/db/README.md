# @postlude/db

Drizzle schema, migrations, and the shared Postgres pool factory.

- `src/schema.ts` — the `entry` table: one row per journal day, keyed by calendar date, with journal and scripture sections plus persisted word counts for the archive heatmap. Check constraints reject negative word counts, half-filled scripture references, and a scripture book that holds no letter at all (`~ '[[:alpha:]]'`), which also rules out a book built only from invisible characters such as a non-breaking space or a zero-width space. A reference is half-filled when it names a book without a chapter or a chapter without a book; the verse is genuinely optional, because a whole chapter such as "Psalms 23" is a reference a writer will type. A verse start still requires a chapter to belong to, and a verse end still requires a start it is not before. `created_at` is stamped by the database clock through its column default. `updated_at` carries the database clock's `now()` as well, but no database trigger stands behind it: the Drizzle client writes `now()` into the updates it issues, so a write that bypasses Drizzle, or one that sets `updatedAt` explicitly, sets the value itself.
- `search_vector` on the same table — the search index, as a stored generated column over three required visible-text projections: evening prose, morning notes, and rendered scripture references in every accepted English, German, and alias spelling. The app writes those projections with the entry, after removing Markdown that a result cannot display and normalizing Unicode to NFKC. The database then recomputes the vector as part of that statement, so the searchable lexemes cannot disagree with the result excerpt. It uses the two-argument `to_tsvector('simple', …)`, because the one-argument form depends on a session setting and is not immutable, which a generated column requires. `simple` means no stemming and no stopword list: the journal is written in more than one language, and every typed word is matched as a prefix instead. A GIN index makes the match a lookup rather than a scan.
- `src/auth-schema.ts` — better-auth tables (user, session, account, verification). The shape is dictated by better-auth's `getAuthTables()`; `account` carries `issuer` plus a unique index over (`issuer`, `account_id`), which better-auth reads on every OAuth callback.
- `src/pool.ts` — `createPool(connectionString)`; one shared pool per process, with an `error` listener so a dropped idle connection is logged instead of crashing the process.
- `src/postgres-date.ts` — `preservePostgresDates()`; installs pg's global DATE parser so a calendar date never passes through a timezone. It applies only to raw `pool.query` reads: Drizzle attaches its own per-query parser that already returns DATE as text, and a per-query parser wins over the global one. Nothing in the app reads outside Drizzle today, so the guard exists to make the first raw query correct by default.
- `src/effect-client.ts` — `pgClientLayer(pool)`; the Effect SQL client wrapped around a pool this package already created. It only hands the pool over and never opens or closes one, because better-auth's Drizzle adapter holds the same object: one process, one pool, one place the connection string is configured.
- `src/migrate.ts` — the staged Drizzle migration runner. It applies generated DDL through a named barrier, runs the application-owned data transformation supplied by the web entrypoint, then applies the remaining generated constraints and indexes.

## Workflow

Migrations are always generated, never handwritten:

```sh
bun run db:generate        # drizzle-kit generate (reads .env.local)
bun run --cwd ../../apps/web db:migrate # generated DDL plus application backfills
```

`.env.local` is composed by `just dev-env-generate`; the dev Postgres container is managed by `just dev-db-start` (see the repo README).

## Pre-release migration policy

Until the first deployment, generated migrations may be regenerated in place. Once a branch has a supported upgrade path, however, each phase must still carry existing local data forward; an empty development database is not an acceptable assumption.

Regenerating invalidates every database that already applied the previous version. Drizzle re-runs any migration whose folder timestamp is newer than the newest one it has recorded, so the regenerated migration runs a second time and fails at `CREATE TABLE` on tables that already exist. Each regeneration therefore requires dropping and re-migrating every local database, `postlude_dev` included:

```sh
podman exec postlude-dev-postgres psql -U postlude -d postgres \
  -c 'drop database postlude_dev' -c 'create database postlude_dev'
bun run --cwd ../../apps/web db:migrate
```

From the first deployment on, migrations are append-only: a schema change adds a new migration and never edits or replaces one that has already been applied anywhere.

## Environment

| Variable       | Purpose                                       | Required                                                                                         | Source                                                                       |
| -------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `DATABASE_URL` | Postgres connection string for Drizzle generation | Required, no default. `drizzle.config.ts` throws `DATABASE_URL is not set.` when it is missing or empty | `config/dev.yaml` under `packages.db`, generated into `.env.local` by `just dev-env-generate` |
