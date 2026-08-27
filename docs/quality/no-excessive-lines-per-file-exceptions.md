# Files exempt from the 200-line limit

`noExcessiveLinesPerFile` caps a file at 200 lines. The cap is a proxy for "this file is doing too many things", and it is right almost always: a file over the line usually wants splitting.

A few files are longer because they are one boundary and splitting them would make the code worse, not better. Each gets a narrow `overrides` entry in the root `biome.jsonc`, and each is listed here with the reason. Adding an entry is the last resort, after splitting has actually been considered and rejected for a stated reason. Removing one when the reason stops holding is part of the work that made it stop holding.

## `apps/web/src/features/journal/services/entry-repository.test.ts`

The repository tests one service against a real Postgres. Its cases cover the complete repository contract: day reads and writes, migration compatibility, archive projections, rollback behavior and concurrent writes.

Database setup shared with the search service lives in `features/journal/testing/database-harness.ts`, but splitting these cases again would scatter one service contract across files without creating a smaller production boundary. The file stays cohesive because it contains only behavior tests for `EntryRepository`, in the order the service methods are declared.
