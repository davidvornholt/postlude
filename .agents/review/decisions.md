# Review decisions registry

Durable, already-litigated review decisions. How reviewers must treat entries and when orchestrators append them is defined in the `review` and `review-fix` skills.

Entry format: heading `### D-NNN (date, status) — title`, where status is `decided` or `open`, followed by the decision and its rationale in prose. Entries are never edited silently; superseding an entry means a new entry that references the old id.

## Entries

### D-001 (2026-08-23, decided) — Auth tables keep better-auth's naive timestamp shape

The four better-auth tables declare their timestamp columns as `timestamp` without time zone with `DEFAULT now()`, so a value produced by the default records the database server's wall clock instead of an absolute instant. This is accepted. better-auth's adapter always supplies these values explicitly on every write it performs, so the column defaults never fire in practice, and deviating from the shape better-auth generates risks adapter drift on upgrades. Revisit only if a write path to these tables appears that does not go through the adapter.

### D-002 (2026-08-23, decided) — Root test:a11y script is required by the standards structure check

The review flagged the root `test:a11y` Turbo alias as duplicating what the root `check` script already runs. The alias stays: the standards structure gate hard-fails without it, observed while scaffolding this repository. Revisit only if the standards template drops the requirement.

### D-003 (2026-08-23, decided) — Word counts are not database-constrained against the markdown they count

The `entry` table stores `journal_word_count` and `scripture_word_count` as plain numbers next to the markdown they describe, and no database constraint ties one to the other, so a wrong number would make the archive heatmap show a day as heavier or lighter than it was. This is accepted. A CHECK constraint can only compare values already in the row, and counting words in markdown means tokenising prose, which is not something SQL can express as a constraint. The app write path is the only writer to `entry` and therefore owns the invariant: it computes both counts from the same markdown it saves in the same statement. Tests for that write path will pin the invariant when the write path lands. Revisit if a second write path to `entry` appears — an importer, a migration backfill, or manual SQL — because the invariant then has no single owner.
