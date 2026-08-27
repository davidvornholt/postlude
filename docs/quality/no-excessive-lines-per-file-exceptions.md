# Files exempt from the 200-line limit

`noExcessiveLinesPerFile` caps a file at 200 lines. The cap is a proxy for "this file is doing too many things", and it is right almost always: a file over the line usually wants splitting.

A few files are longer because they are one boundary and splitting them would make the code worse, not better. Each gets a narrow `overrides` entry in the root `biome.jsonc`, and each is listed here with the reason. Adding an entry is the last resort, after splitting has actually been considered and rejected for a stated reason. Removing one when the reason stops holding is part of the work that made it stop holding.

## `apps/web/src/features/journal/services/entry-repository.test.ts`

The repository's tests run against a real Postgres. `entry-repository-test-support.ts` owns the migrated pool, Effect layer, transaction isolation, and rollback. The test file holds the repository's read, save, archive, and snapshot contracts in the order the service declares them.

Splitting the file by query would make the service's database contract harder to audit without removing setup or production complexity. The concurrency cases already live separately because they need simultaneous writes rather than the ordinary rolled-back harness. This file stays as the broad test boundary for the remaining methods.
