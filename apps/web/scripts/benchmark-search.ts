import process from 'node:process';
import { pgClientLayer } from '@postlude/db/effect-client';
import { createPool } from '@postlude/db/pool';
import { Effect, Layer, ManagedRuntime } from 'effect';
import { EntrySearch } from '../src/features/journal/services/entry-search.ts';
import { migrateJournalDatabase } from '../src/features/journal/services/journal-migration.ts';

const hitCount = 50;
const warmRuns = 100;
const warmupRuns = 3;
const percentile = 0.95;
const kibibyte = 1024;
const smallBytes = 256;
const maximumReturnedBytes = 65_536;
const sourceCount = 3;
const sizes = [smallBytes, maximumReturnedBytes, 2 * kibibyte * kibibyte];
// biome-ignore lint/style/noProcessEnv: This standalone benchmark owns its disposable database configuration.
const configured = process.env.DATABASE_URL;
if (!configured) {
  throw new Error(
    'DATABASE_URL is required to create an isolated benchmark database.',
  );
}
const name = `postlude_search_benchmark_${crypto.randomUUID().replaceAll('-', '')}`;
const url = new URL(configured);
url.pathname = `/${name}`;
const admin = createPool(configured);
const pool = createPool(url.toString());
const runtime = ManagedRuntime.make(
  EntrySearch.Default.pipe(Layer.provide(pgClientLayer(pool))),
);

type Sample = { readonly rows: ReadonlyArray<unknown>; readonly bytes: number };
const measure = async (query: () => Promise<Sample>) => {
  for (let run = 0; run < warmupRuns; run += 1) {
    // biome-ignore lint/performance/noAwaitInLoops: Warmup queries must complete sequentially before timing.
    await query();
  }
  const latency: Array<number> = [];
  let peakHeapDeltaBytes = 0;
  let returnedBytes = 0;
  for (let run = 0; run < warmRuns; run += 1) {
    Bun.gc(true);
    const baseline = process.memoryUsage().heapUsed;
    const started = performance.now();
    // biome-ignore lint/performance/noAwaitInLoops: The benchmark measures individual sequential warm query round trips.
    const result = await query();
    latency.push(performance.now() - started);
    peakHeapDeltaBytes = Math.max(
      peakHeapDeltaBytes,
      process.memoryUsage().heapUsed - baseline,
    );
    if (result.rows.length !== hitCount) {
      throw new Error('Benchmark did not return exactly 50 hits.');
    }
    returnedBytes = result.bytes;
  }
  latency.sort((a, b) => a - b);
  return {
    returnedBytes,
    p95Milliseconds: latency[Math.ceil(warmRuns * percentile) - 1],
    peakHeapDeltaBytes,
  };
};

const baselineQuery = async (): Promise<Sample> => {
  const result = await pool.query<{
    journal: string;
    scripture: string;
    reference: string;
  }>(`
    select journal_search_text as journal, scripture_search_text as scripture,
      scripture_reference_search_text as reference from entry
    where search_vector @@ 'needle:*'::tsquery order by entry_date desc limit 50
  `);
  return {
    rows: result.rows,
    bytes: result.rows.reduce(
      (sum, row) =>
        sum +
        Buffer.byteLength(row.journal) +
        Buffer.byteLength(row.scripture) +
        Buffer.byteLength(row.reference),
      0,
    ),
  };
};
const boundedQuery = async (): Promise<Sample> => {
  const rows = await runtime.runPromise(
    Effect.flatMap(EntrySearch, (search) =>
      search.search(['needle'], hitCount),
    ),
  );
  return {
    rows,
    bytes: rows.reduce(
      (sum, row) =>
        sum +
        row.texts.reduce(
          (subtotal, text) => subtotal + Buffer.byteLength(text),
          0,
        ),
      0,
    ),
  };
};

let created = false;
try {
  await admin.query(`create database "${name}"`);
  created = true;
  await Effect.runPromise(migrateJournalDatabase(pool));
  const results: Array<unknown> = [];
  const runSize = async (index: number): Promise<void> => {
    const size = sizes[index];
    if (size === undefined) {
      return;
    }
    const context = 'quiet '
      .repeat(Math.ceil(size / 'quiet '.length))
      .slice(0, size - ' needle'.length);
    const text = `${context} needle`;
    await pool.query('truncate entry cascade');
    await pool.query(
      `
      insert into entry (entry_date, journal_markdown, journal_word_count, journal_search_text,
        scripture_search_text, scripture_reference_search_text, search_token_text, search_projection_revision, search_evidence_revision)
      select date '2020-01-01' + day_offset, '', 1, $1, $1, $1, 'quiet needle', 1, 1
      from generate_series(0, $2::integer - 1) as series(day_offset)
    `,
      [text, hitCount],
    );
    await pool.query(`
      insert into entry_search_evidence (entry_date,kind,token,position,excerpt,match_start,match_length)
      select entry_date, kind, 'needle', 0, 'needle with bounded context', 0, 6
      from entry cross join (values ('evening'),('scripture-notes'),('passage-reference')) as source(kind)
    `);
    await pool.query('analyze entry');
    await pool.query('analyze entry_search_evidence');
    const before = await measure(baselineQuery);
    const after = await measure(boundedQuery);
    if (after.returnedBytes > maximumReturnedBytes) {
      throw new Error('Bounded search exceeded the 64 KiB text budget.');
    }
    results.push({
      projectionBytesPerColumn: size,
      totalProjectionBytes: size * hitCount * sourceCount,
      before,
      after,
    });
    process.stdout.write(`${JSON.stringify(results.at(-1))}\n`);
    await runSize(index + 1);
  };
  await runSize(0);
  process.stdout.write(
    JSON.stringify(
      {
        runtime: Bun.version,
        hitCount,
        warmRuns,
        measurement:
          'Sequential warm query round trip, decoding, and UTF-8 result byte accounting; heap sampled immediately after every query with full GC before each run.',
        results,
      },
      null,
      2,
    ),
  );
} finally {
  await runtime.dispose();
  await pool.end();
  if (created) {
    await admin.query(`drop database "${name}" with (force)`);
  }
  await admin.end();
}
