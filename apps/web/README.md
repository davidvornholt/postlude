# @postlude/web

The Postlude application: TanStack Start + Vite on Bun, GitHub OAuth via better-auth (restricted to a single allowed account), Tailwind with the semantic tokens from `@postlude/ui`.

## Development

```sh
just dev-env-generate   # compose .env.local from config/dev.yaml + secrets/dev.yaml
just dev-db-start       # local Postgres container (postlude-dev-postgres)
bun run dev             # vite dev server on port 3000
```

`config/dev.yaml` still carries a placeholder `GITHUB_CLIENT_ID`. The app boots and every unauthenticated page works, but sign-in fails until a real dev GitHub OAuth app value lands there.

## Environment

| Variable                    | Source           | Required          | Purpose                                                 |
| --------------------------- | ---------------- | ----------------- | ------------------------------------------------------- |
| `DATABASE_URL`              | config/dev.yaml  | Yes               | Postgres connection string, validated as a URL          |
| `BETTER_AUTH_SECRET`        | secrets/dev.yaml | Yes               | better-auth signing secret, at least 32 characters      |
| `BETTER_AUTH_URL`           | config/dev.yaml  | Yes               | Public base URL for OAuth callbacks, validated as a URL |
| `GITHUB_CLIENT_ID`          | config/dev.yaml  | Yes               | GitHub OAuth app client ID (public value)               |
| `GITHUB_CLIENT_SECRET`      | secrets/dev.yaml | Yes               | GitHub OAuth app client secret                          |
| `GITHUB_ALLOWED_ACCOUNT_ID` | config/dev.yaml  | Yes               | The only GitHub account allowed in, digits only         |
| `PORT`                      | process env      | No (default 3000) | Port the production server binds                        |

Everything except `PORT` is validated by `src/shared/env.ts` when the app boots; a missing or malformed value fails the boot instead of degrading.

`PORT` is read only by `scripts/serve.ts`, the production server; the dev server takes its port from the `dev` script. It must be an integer from 1 to 65535, an empty value counts as unset, and anything else fails the boot. `.env.a11y` sets 3100 so the accessibility scan stays clear of local listeners on 3000.

## Accessibility

`bun run test:a11y` builds nothing by itself, so run `bun run build` first. The Playwright config boots the production server with `.env.a11y` (fixture values, no secrets) and scans the unauthenticated routes for WCAG 2.2 AA violations.
