# Review decisions registry

Durable, already-litigated review decisions. How reviewers must treat entries and when orchestrators append them is defined in the `review` and `review-fix` skills.

Entry format: heading `### D-NNN (date, status) — title`, where status is `decided` or `open`, followed by the decision and its rationale in prose. Entries are never edited silently; superseding an entry means a new entry that references the old id.

## Entries

### D-001 (2026-08-23, decided) — Auth tables keep better-auth's naive timestamp shape

The four better-auth tables declare their timestamp columns as `timestamp` without time zone with `DEFAULT now()`, so a value produced by the default records the database server's wall clock instead of an absolute instant. This is accepted. better-auth's adapter always supplies these values explicitly on every write it performs, so the column defaults never fire in practice, and deviating from the shape better-auth generates risks adapter drift on upgrades. Revisit only if a write path to these tables appears that does not go through the adapter.

### D-002 (2026-08-23, decided) — Root test:a11y script is required by the standards structure check

The review flagged the root `test:a11y` Turbo alias as duplicating what the root `check` script already runs. The alias stays: the standards structure gate hard-fails without it, observed while scaffolding this repository. Revisit only if the standards template drops the requirement.
