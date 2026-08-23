# @postlude/web

The Postlude application: TanStack Start + Vite on Bun, GitHub OAuth via
better-auth (restricted to a single allowed account), Tailwind with the
semantic tokens from `@postlude/ui`.

## Development

```sh
just dev-env-generate   # compose .env.local from config/dev.yaml + secrets/dev.yaml
just dev-db-start       # local Postgres container (postlude-dev-postgres)
bun run dev             # vite dev server on port 3000
```

## Environment

| Variable                    | Source            | Purpose                            |
| --------------------------- | ----------------- | ---------------------------------- |
| `DATABASE_URL`              | config/dev.yaml   | Postgres connection string         |
| `BETTER_AUTH_SECRET`        | secrets/dev.yaml  | better-auth signing secret         |
| `BETTER_AUTH_URL`           | config/dev.yaml   | Public base URL (optional in dev)  |
| `GITHUB_CLIENT_ID`          | config/dev.yaml   | GitHub OAuth app (public value)    |
| `GITHUB_CLIENT_SECRET`      | secrets/dev.yaml  | GitHub OAuth app secret            |
| `GITHUB_ALLOWED_ACCOUNT_ID` | config/dev.yaml   | The only GitHub account allowed in |

## Accessibility

`bun run test:a11y` builds nothing by itself — run `bun run build` first. The
Playwright config boots the production server with `.env.a11y` (fixture
values, no secrets) and scans the unauthenticated routes for WCAG 2.2 AA
violations.
