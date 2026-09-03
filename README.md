# Postlude

> Built on [davidvornholt/standards](https://github.com/davidvornholt/standards).

A calm, single-user journaling app for closing out the day. Each journal day runs from 04:00 to 04:00 in the configured time zone and can hold an optional morning scripture section plus evening journal prose. Entries are Markdown. Streaks, an activity heatmap, and a daily entry-length plot live on a separate archive page. Export downloads a ZIP whose manifest and NDJSON records preserve the journal for re-import, with one Markdown reading copy per day that has recoverable stored content.

- Runtime: TanStack Start + Vite on Bun, deployed as a Podman container on
  personal-infra (`postlude.vornholt.online`).
- Auth: GitHub OAuth via better-auth, restricted to a single allowed account.
- Data: Postgres (Drizzle) on the shared prod-1 instance. The editor currently
  stores Markdown only; it has no image-upload storage.

## Workspaces

- `apps/web` — the application.
- `packages/db` — Drizzle schema and database client.
- `packages/ui` — design tokens (`src/theme.css`) and the audits that hold them to WCAG AA.

## Configuration and secrets

Non-secret dev config lives in `config/dev.yaml`; secrets in SOPS-encrypted `secrets/dev.yaml` and `secrets/ci.yaml` (shapes mirrored in `secrets/*.example.yaml`, edited via `just secrets edit dev`). Generate local env files with `just dev-env-generate`.

`secrets/pr-preview.yaml` contains only the forced-command SSH key used by the protected `pr-preview` GitHub environment. Its dedicated age identity cannot decrypt development, CI, or production credentials.

## Pull request screenshots

`config/screenshots.yaml` binds `bun standards screenshots publish` to the shared personal R2 screenshot host. Its credential reference, bucket, upload endpoint, and public base URL are required and have no defaults. The host infrastructure lives in `personal-infra`; this repository owns only its consumer binding.

`secrets/assets.yaml` contains the required brokered `access_key_id` and `secret_access_key` values at `assets.screenshots_rw`. Only the publish command consumes them; builds, tests, and deployments do not.

## Container release

Every push to `main` is published as `ghcr.io/davidvornholt/postlude:main` only after the Standards gate succeeds for that exact commit and the commit is still current `main`. A completed-run follow-up announces the immutable image digest to personal-infra, which owns promotion and deployment. The deploy host runs `bun run db:migrate:deploy` from `/app/apps/web` before starting the server.

## Pull request previews

A same-repository, non-draft pull request to `main` gets a preview after it receives the `pr-preview` label and passes the full gate, two migration runs, container boot, and `/api/healthz`. The untrusted pull request job has `contents: read` only and uploads a bounded image artifact. A trusted completed-run workflow rechecks the exact head, current pull request state, current main-owned workflow files, and an independent Standards run before it publishes an immutable preview digest.

personal-infra owns the isolated runtime at `https://<number>.pr.postlude.vornholt.online`. The host provides one Postlude preview slot, so another labeled pull request fails closed until the active preview is removed. The source workflow can send only `deploy` or `destroy` through a dedicated forced SSH key. Closing the pull request, converting it to draft, removing the label, retargeting it away from `main`, or failing its current build removes the preview. Publication, deployment, and public health failures also request idempotent teardown.
