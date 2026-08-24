# @postlude/web

The Postlude application: TanStack Start + Vite on Bun, GitHub OAuth via better-auth (restricted to a single allowed account), Tailwind with the semantic tokens from `@postlude/ui`.

## Development

```sh
just dev-env-generate   # compose .env.local from config/dev.yaml + secrets/dev.yaml
just dev-db-start       # local Postgres container (postlude-dev-postgres)
bun run dev             # vite dev server on port 3000
```

`config/dev.yaml` still carries a placeholder `GITHUB_CLIENT_ID`. The app boots and every unauthenticated page works, but sign-in fails until a real dev GitHub OAuth app value lands there.

## Design comparison

`/heirloom` and `/warm-print` each render the two pages the product is being designed around: the day you write on and the archive. Both route trees use the same made-up content with no database or sign-in behind it. They are public, so anyone with a link sees sample entries, never a real one. `src/features/design-comparison/` holds the sample day, the seeded year of activity, and the heatmap both candidates share. `packages/ui/src/comparison-heirloom.css` and `packages/ui/src/comparison-warm-print.css` each redefine the `--pl-*` tokens under their own wrapper class. `src/styles.css` loads both token overrides globally, but they remain inert outside `.theme-heirloom` and `.theme-warm-print`. Each layout loads only the font files for its own candidate. Nothing under `_app` reads the sample content, so the comparison can be deleted in one commit once the design is chosen.

## Access control

Exactly one GitHub account can sign in. `GITHUB_ALLOWED_ACCOUNT_ID` holds its numeric GitHub account ID, and `src/shared/auth/authorization.ts` enforces it on both the way in and the way back out.

The way in is better-auth's `user.validateUserInfo` gate. better-auth calls it before it creates a user row, before it links a provider account, and again on every returning sign-in, so narrowing the allowed account locks the previous one out on its next attempt rather than only at first link. A rejected attempt writes no rows and issues no session; better-auth redirects the browser to `/login?error=account_not_allowed`, where the sign-in page shows a quiet notice: "Sign-in did not go through, so you are still signed out. If the GitHub account you used is not the one with access, trying again will end the same way." Enforcing it here rather than in the provider's `mapProfileToUser` hook is what makes that redirect possible: better-auth does not catch a `mapProfileToUser` failure, so rejecting there ends the flow as raw JSON on the callback URL.

That notice is worded for every code that can land on `/login`, not just this one. better-auth sends a failed OAuth callback to the error URL the sign-in started with, which is `/login` here, and it does that for every failure it can still tie to a started sign-in: `access_denied` when someone cancels on GitHub's consent screen, `state_mismatch` when the callback arrives against an expired or mismatched sign-in state, `invalid_code` when the token exchange fails, `unable_to_get_user_info` when GitHub will not answer for the profile. Those are transient and another attempt can work. `account_not_allowed` never can, because the gate turns the same account away every time. So the notice reports what happened and names the one condition that makes another attempt pointless, and it tells nobody to retry. The failures that arrive with no readable sign-in state — `invalid_callback_request` and `state_not_found` — never reach the page at all; better-auth sends those to its own `<BETTER_AUTH_URL>/api/auth/error`.

The way back out is `authorizeSession`. Every session check re-reads the linked GitHub accounts and revokes a session that no longer belongs to the allowed account.

## Environment

| Variable                    | Source           | Required          | Purpose                                                 |
| --------------------------- | ---------------- | ----------------- | ------------------------------------------------------- |
| `DATABASE_URL`              | config/dev.yaml  | Yes               | Postgres connection string, validated as a URL          |
| `BETTER_AUTH_SECRET`        | secrets/dev.yaml | Yes               | better-auth signing secret, at least 32 characters      |
| `BETTER_AUTH_URL`           | config/dev.yaml  | Yes               | Public base URL for OAuth callbacks, validated as a URL |
| `GITHUB_CLIENT_ID`          | config/dev.yaml  | Yes               | GitHub OAuth app client ID (public value)               |
| `GITHUB_CLIENT_SECRET`      | secrets/dev.yaml | Yes               | GitHub OAuth app client secret                          |
| `GITHUB_ALLOWED_ACCOUNT_ID` | config/dev.yaml  | Yes               | The only GitHub account allowed in, digits with no leading zero |
| `PORT`                      | process env      | No (default 3000) | Port the production server binds                        |

Everything except `PORT` is validated by `src/shared/env.ts`, which parses the whole set the first time it is imported. The built server bundle imports it as it loads, so a missing or malformed value makes `bun run start` name the offending variable and exit non-zero before it binds a port.

`scripts/serve.ts` then proves the process can serve a page. Before it listens, it sends two in-process requests through the same handler the network would reach: first `/api/healthz`, the liveness route, which touches neither database nor OAuth, and then `/login`, a real page, which exercises the router, the React render, and the document shell that the liveness route never reaches. The sign-in page needs no database of its own — a session lookup that fails counts as signed out — so a healthy process answers 200 to both. Anything else exits non-zero with a message naming the route and what it did, including a handler that has not answered within 10 seconds. A process that stays up while it cannot render a page would otherwise report itself healthy to a container healthcheck; a hung one would neither listen nor exit.

`PORT` is read only by `scripts/serve.ts`; the dev server takes its port from the `dev` script. It must be plain digits with no leading zero, between 1 and 65535. An empty or whitespace-only value counts as unset and means 3000; anything else — `0x1f5`, `1e3`, `0080`, `65536`, `abc` — fails the boot before the server loads anything else. `.env.a11y` sets 3100 so the accessibility scan stays clear of local listeners on 3000.

## Accessibility

`bun run test:a11y` builds nothing by itself, so run `bun run build` first. The Playwright config boots the production server with `.env.a11y` (fixture values, no secrets) and scans the unauthenticated routes for WCAG 2.2 AA violations: sign-in, the redirect from `/`, the not-found page, and the two design-comparison pages, each under both `prefers-color-scheme: light` and `prefers-color-scheme: dark` on desktop and mobile Chromium.

Each case also pins the HTTP status, the path it landed on, and the `h1` of the page it scanned, because a scan of the wrong page still passes — the `/` case has to prove it was redirected to `/login`, and the not-found case has to prove it got an HTTP 404 and the themed not-found page. It asserts a single `main` landmark too: axe classes duplicate-landmark rules as best practice rather than WCAG, so the violation scan itself cannot see a second `main`.

The signed-in shell (`src/routes/_app.tsx`) is not reachable from the scan, because signing in requires a real GitHub OAuth round trip. Its navigation, skip link, and sign-out control are unguarded by automated accessibility coverage until that changes.
