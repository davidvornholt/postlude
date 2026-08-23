# @postlude/db

Drizzle schema, migrations, and the shared Postgres pool factory.

- `src/schema.ts` — the `entry` table: one row per journal day, keyed by
  calendar date, with journal and scripture sections plus persisted word
  counts for the archive heatmap.
- `src/auth-schema.ts` — better-auth tables (user, session, account,
  verification).
- `src/pool.ts` — `createPool(connectionString)`; installs the DATE type
  parser so calendar dates never pass through a timezone.
- `src/migrate.ts` / `scripts/migrate.ts` — Effect-wrapped migration runner.

## Workflow

Migrations are always generated, never handwritten:

```sh
bun run db:generate        # drizzle-kit generate (reads .env.local)
bun run db:migrate         # apply locally (reads .env.local)
bun run db:migrate:deploy  # apply with DATABASE_URL from the environment
```

`.env.local` is composed by `just dev-env-generate`; the dev Postgres
container is managed by `just dev-db-start` (see the repo README).

## Environment

| Variable       | Purpose                                     |
| -------------- | ------------------------------------------- |
| `DATABASE_URL` | Postgres connection string for db:* scripts |
