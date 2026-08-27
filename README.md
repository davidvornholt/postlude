# Postlude

> Built on [davidvornholt/standards](https://github.com/davidvornholt/standards).

A calm, single-user journaling app for closing out the day. Each journal day runs from 04:00 to 04:00 in the configured time zone and can hold an optional morning scripture section plus evening journal prose. Entries are Markdown. Streaks and an activity heatmap live on a separate archive page. Export downloads a ZIP whose manifest and NDJSON records preserve the journal for re-import, with one Markdown reading copy per day that has recoverable stored content.

- Runtime: TanStack Start + Vite on Bun, deployed as a Podman container on
  personal-infra (`postlude.vornholt.online`).
- Auth: GitHub OAuth via better-auth, restricted to a single allowed account.
- Data: Postgres (Drizzle) on the shared prod-1 instance. The editor currently
  stores Markdown only; it has no image-upload storage.

## Workspaces

- `apps/web` — the application.
- `packages/db` — Drizzle schema and database client.
- `packages/ui` — design tokens (`src/theme.css`) and the audits that hold them to WCAG AA. `DESIGN.md` states the design intent those values serve.

## Configuration and secrets

Non-secret dev config lives in `config/dev.yaml`; secrets in SOPS-encrypted
`secrets/dev.yaml` / `secrets/ci.yaml` (shapes mirrored in
`secrets/*.example.yaml`, edited via `just secrets edit dev`). Generate local
env files with `just dev-env-generate`.

## Container release

Every push to `main` is published as `ghcr.io/davidvornholt/postlude:main` only after the Standards gate succeeds for that exact commit and the commit is still current `main`. A completed-run follow-up announces the immutable image digest to personal-infra, which owns promotion and deployment. The deploy host runs `bun run db:migrate:deploy` from `/app/apps/web` before starting the server.
