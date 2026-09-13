# Postlude

A private journal with Markdown entries, images, and ZIP export. Journal days run from 04:00 to 04:00 in the configured time zone.

## Development

Use the Bun version in `package.json`. From the repository root:

```sh
bun install
just dev-env-generate
just dev-db-start
bun run --cwd apps/web db:migrate
bun run dev
```

Keep port 3000 free for the GitHub OAuth callback at `http://localhost:3000/api/auth/callback/github`. Configuration lives in `config/dev.yaml`, encrypted credentials in `secrets/dev.yaml`, and machine overrides in ignored `config/dev.local.yaml`. Secret shapes are in `secrets/*.example.yaml`.

Run `bun run check:fix` for the full gate. Generate schema migrations with `bun run --cwd packages/db db:generate`; apply them through the web workspace’s `db:migrate` script, which also runs application backfills. Preserve existing migration history for deployed databases.

## Deployment and recovery

[personal-infra](https://github.com/davidvornholt/personal-infra) owns `https://postlude.vornholt.online`. Images are private and stored in EU-jurisdiction R2 buckets. Removing an image reference retains the object for undo and older database backups.

ZIP exports include referenced originals under `images/` and fail if an original cannot be read. When restoring a database, restore these files to the private bucket using their filenames as object keys; `entries.ndjson` retains the original private URLs. Exports omit unreferenced uploads.

Label a same-repository, non-draft PR `pr-preview` for `https://<number>.pr.postlude.vornholt.online`. Only one preview can run at a time. Previews receive no R2 credentials, so image uploads are unavailable. Removing the label tears down the preview.
