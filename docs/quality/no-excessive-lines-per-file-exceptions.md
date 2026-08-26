# Files exempt from the 200-line limit

`noExcessiveLinesPerFile` caps a file at 200 lines. The cap is a proxy for "this file is doing too many things", and it is right almost always: a file over the line usually wants splitting.

A few files are longer because they are one boundary and splitting them would make the code worse, not better. Each gets a narrow `overrides` entry in the root `biome.jsonc`, and each is listed here with the reason. Adding an entry is the last resort, after splitting has actually been considered and rejected for a stated reason. Removing one when the reason stops holding is part of the work that made it stop holding.

## `apps/web/src/features/journal/services/entry-repository.test.ts`

The repository's tests run against a real Postgres. One `beforeAll` opens the test database, runs the migrations, and builds the Effect runtime the whole file shares; one `afterAll` disposes both. Everything below that is a short test of one query.

Splitting the file means either duplicating that setup — a second pool, a second migration run, against the same database — or moving it behind a shared helper that each file calls to register its own hooks. Both trade one honest long file for machinery that exists only to satisfy a line count, and the second one quietly doubles what the test run does to the database.

The file stays one file. What keeps it readable is that it holds nothing but tests of one service, in the order the service's methods are declared.
