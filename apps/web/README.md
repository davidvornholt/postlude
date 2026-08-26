# @postlude/web

The Postlude application: TanStack Start + Vite on Bun, GitHub OAuth via better-auth (restricted to a single allowed account), Tailwind with the semantic tokens from `@postlude/ui`.

## Development

```sh
just dev-env-generate                      # compose .env.local from config/dev.yaml + secrets/dev.yaml
just dev-db-start                          # local Postgres container (postlude-dev-postgres)
bun run --cwd ../../packages/db db:migrate # apply migrations; a freshly created container is empty
bun run dev                                # vite dev server on port 3000
```

Sign-in needs all three of those. Without the database the sign-in request fails before the browser ever reaches GitHub, because better-auth stores the OAuth state as a row before it redirects; the sign-in page still renders, since a failed session lookup counts as signed out. Without the migrations that same write has no table to land in. And the dev server has to hold port 3000: the "Postlude (dev)" OAuth app sends the browser back to `http://localhost:3000/api/auth/callback/github`, so a server that fell back to another port never receives the callback. Free port 3000 rather than letting Vite move.

## Design

`DESIGN.md` at the repo root states the design intent and its rules; `@postlude/ui` holds the token values. In this app, `src/shared/ui/design-classes.ts` holds the shape vocabulary the pages share — the set column, the letterspaced eyebrow, the focus ring — and `src/shared/ui/form-classes.ts` builds the two control recipes on top of it, the primary button and the quiet control. `design-classes.ts` holds shape and one colour, the focus ring's; `form-classes.ts` holds a whole control, its state colours included, and its callers pass the recipe and add nothing. That split is what keeps a state colour from fighting one baked into a shared recipe: which of two utilities setting the same property wins is decided by their order in the generated stylesheet and never by the `class` attribute, so a recipe may only hold a colour nothing downstream has to override. A control that needs a different colour needs its own recipe here, not a class appended at the call site. `src/routes/__root.tsx` links the two faces the theme names, Fraunces and Inter, for the whole app.

## Access control

Exactly one GitHub account can sign in. `GITHUB_ALLOWED_ACCOUNT_ID` holds its numeric GitHub account ID, and `src/shared/auth/authorization.ts` enforces it on both the way in and the way back out.

The way in is better-auth's `user.validateUserInfo` gate. better-auth calls it before it creates a user row, before it links a provider account, and again on every returning sign-in, so narrowing the allowed account locks the previous one out on its next attempt rather than only at first link. A rejected attempt writes no rows and issues no session; better-auth redirects the browser to `/login?error=account_not_allowed`, where the sign-in page shows a quiet notice: "Sign-in did not go through, so you are still signed out. If the GitHub account you used is not the one with access, trying again will end the same way." Enforcing it here rather than in the provider's `mapProfileToUser` hook is what makes that redirect possible: better-auth does not catch a `mapProfileToUser` failure, so rejecting there ends the flow as raw JSON on the callback URL.

That notice is worded for every code that can land on `/login`, not just this one. better-auth sends a failed OAuth callback to the error URL the sign-in started with, which is `/login` here, and it does that for every failure it can still tie to a started sign-in: `access_denied` when someone cancels on GitHub's consent screen, `state_mismatch` when the callback arrives against an expired or mismatched sign-in state, `invalid_code` when the token exchange fails, `unable_to_get_user_info` when GitHub will not answer for the profile. Those are transient and another attempt can work. `account_not_allowed` never can, because the gate turns the same account away every time. So the notice reports what happened and names the one condition that makes another attempt pointless, and it tells nobody to retry. The failures that arrive with no readable sign-in state — `invalid_callback_request` and `state_not_found` — never reach the page at all; better-auth sends those to its own `<BETTER_AUTH_URL>/api/auth/error`.

The way back out is `authorizeSession`. Every session check re-reads the linked GitHub accounts and revokes a session that no longer belongs to the allowed account.

## The journal data layer

`src/features/journal` owns what a journal day is and how one reaches the database.

- `journal-day.ts` — the 04:00 rule and calendar arithmetic that never builds an instant, so a shift across the day the clocks move cannot pick up an hour on the way.
- `word-count.ts` — the counts the writer sees and the archive buckets by. It counts prose rather than markup: a heading is its words, a link is its label, a fenced code block is nothing, and an unclosed fence takes the rest of the document so the number does not leap while the fence is being typed.
- `scripture-books.ts` / `scripture-reference.ts` — the 66 books under their English and German names. A reference is typed in either language, displayed in the house style (`Proverbs 12:5-13`), and linked to bibleserver.com in German, which is how that site addresses passages.
- `schemas/entry.ts` — the shapes an entry takes, and the one place a database row becomes one. Rows are decoded rather than cast: what a driver hands back is untrusted input like anything else.
- `services/entry-repository.ts` — every query, behind one Effect service. Nothing in it reads a clock; which day it is arrives as an argument.
- `services/journal-fns.ts` — the server functions the browser reaches all of that through. Each carries `sessionRequired`, and `sensitive-server-fns.test.ts` fails the build if one loses it.

`src/shared/runtime/app-runtime.ts` is the single seam between Effect and the rest of the app, as `AGENTS.local.md` describes: services keep typed error and requirement channels, and everything above the seam — server functions, React Query, components — stays on plain promises. The runtime is built lazily, because building it opens the database pool, and a pool must not be opened merely because a client bundle imported a route module.

The repository's own tests run against a real Postgres, since whether an upsert replaces a row and whether a DATE column survives the round trip are properties of the database rather than of the code. `src/shared/testing/test-database.ts` creates the configured database with `_test` appended, migrates it from the same generated migrations the app deploys, and rolls every test body back, so the journal you write in is never touched. `DATABASE_URL` must be present: a database test that silently skips is a gate that silently does not hold.

## Environment

| Variable                    | Source           | Required          | Purpose                                                 |
| --------------------------- | ---------------- | ----------------- | ------------------------------------------------------- |
| `DATABASE_URL`              | config/dev.yaml  | Yes               | Postgres connection string, validated as a URL          |
| `BETTER_AUTH_SECRET`        | secrets/dev.yaml | Yes               | better-auth signing secret, at least 32 characters      |
| `BETTER_AUTH_URL`           | config/dev.yaml  | Yes               | Public base URL for OAuth callbacks, validated as a URL |
| `GITHUB_CLIENT_ID`          | config/dev.yaml  | Yes               | GitHub OAuth app client ID (public value)               |
| `GITHUB_CLIENT_SECRET`      | secrets/dev.yaml | Yes               | GitHub OAuth app client secret                          |
| `GITHUB_ALLOWED_ACCOUNT_ID` | config/dev.yaml  | Yes               | The only GitHub account allowed in, digits with no leading zero |
| `JOURNAL_TIME_ZONE`         | config/dev.yaml  | Yes               | IANA zone whose clock decides which journal day an entry belongs to |
| `PORT`                      | process env      | No (default 3000) | Port the production server binds                        |

`JOURNAL_TIME_ZONE` is the clock the journal runs on. A journal day runs from 04:00 to 04:00 in that zone, so an entry written at half past one in the morning still closes out the evening before rather than opening a day that has not been lived yet. It is configuration rather than the device's own zone so that the same evening is one journal day from every device: a phone in another country neither splits a night in two nor hides the day just written. The value is checked against the platform's own zone database at boot, because a zone the platform cannot resolve would otherwise show up as a wrong date on a page — the kind of wrong nobody notices until a streak breaks. `src/features/journal/journal-day.ts` applies the rule to the zone's wall clock rather than shifting the instant, which is what keeps the boundary exact on the two days a year the offset moves.

Everything except `PORT` is validated by `src/shared/env.ts`, which parses the whole set the first time it is imported. The built server bundle imports it as it loads, so a missing or malformed value makes `bun run start` name the offending variable and exit non-zero before it binds a port.

`scripts/serve.ts` then proves the process can serve a page. Before it listens, it sends two in-process requests through the same handler the network would reach: first `/api/healthz`, the liveness route, which touches neither database nor OAuth, and then `/login`, a real page, which exercises the router, the React render, and the document shell that the liveness route never reaches. The sign-in page needs no database of its own — a session lookup that fails counts as signed out — so a healthy process answers 200 to both. Anything else exits non-zero with a message naming the route and what it did, including a handler that has not answered within 10 seconds. A process that stays up while it cannot render a page would otherwise report itself healthy to a container healthcheck; a hung one would neither listen nor exit.

`PORT` is read only by `scripts/serve.ts`; the dev server takes its port from the `dev` script. It must be plain digits with no leading zero, between 1 and 65535. An empty or whitespace-only value counts as unset and means 3000; anything else — `0x1f5`, `1e3`, `0080`, `65536`, `abc` — fails the boot before the server loads anything else. `.env.a11y` sets 3100 so the accessibility scan stays clear of local listeners on 3000.

## Accessibility

`bun run test:a11y` builds nothing by itself, so run `bun run build` first. The Playwright config boots the production server with `.env.a11y` (fixture values, no secrets) and scans every unauthenticated route for WCAG 2.2 AA violations — sign-in, the redirect from `/`, and the not-found page — each under both `prefers-color-scheme: light` and `prefers-color-scheme: dark` on desktop and mobile Chromium.

Each case also pins the HTTP status, the path it landed on, and the `h1` of the page it scanned, because a scan of the wrong page still passes — the `/` case has to prove it was redirected to `/login`, and the not-found case has to prove it got an HTTP 404 and the themed not-found page. It asserts a single `main` landmark too: axe classes duplicate-landmark rules as best practice rather than WCAG, so the violation scan itself cannot see a second `main`.

The signed-in shell (`src/routes/_app.tsx`) is not reachable from the scan, because signing in requires a real GitHub OAuth round trip. `src/routes/_app.test.tsx` stands in for it: it renders the shell through a real router and asserts the states a browser scan would otherwise be the only thing to see — that the current page is marked by the rule at full width and not by its colour alone, that the page opens one `main` landmark and the skip link points at it, and that the sign-out control announces itself busy only while it is working. It is a colocated test inside `src/routes`, which the route generator would otherwise read as a route file, so `tsr.config.json` sets `routeFileIgnorePattern` to skip `*.test.ts` and `*.test.tsx` there. That file is read by both the Vite plugin and `bun run generate-routes`, so the setting is stated once.

What it cannot cover is what a real browser computes: contrast, focus order, and the rendered size of a touch target are still unscanned on the signed-in pages.
