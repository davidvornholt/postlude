# Postlude

> Built on [davidvornholt/standards](https://github.com/davidvornholt/standards).

A calm, single-user journaling app for closing out the day. Journal entries are
markdown; each journal day (04:00–04:00 local) holds an optional morning
scripture section and the evening journal prose. Streaks and an activity
heatmap live on a separate archive page; exports produce one markdown file per
day, week, month, or year.

- Runtime: TanStack Start + Vite on Bun, deployed as a Podman container on
  personal-infra (`postlude.vornholt.online`).
- Auth: GitHub OAuth via better-auth, restricted to a single allowed account.
- Data: Postgres (Drizzle) on the shared prod-1 instance; pasted images go to a
  private Cloudflare R2 bucket and are served through an auth-gated route.

## Workspaces

- `apps/web` — the application.
- `packages/db` — Drizzle schema and database client.
- `packages/ui` — design tokens (`src/theme.css`) and shared UI primitives.

## Configuration and secrets

Non-secret dev config lives in `config/dev.yaml`; secrets in SOPS-encrypted
`secrets/dev.yaml` / `secrets/ci.yaml` (shapes mirrored in
`secrets/*.example.yaml`, edited via `just secrets edit dev`). Generate local
env files with `just dev-env-generate`.
