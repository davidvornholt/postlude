import { expect, it } from 'bun:test';
import { SqlClient } from '@effect/sql';
import { Effect } from 'effect';
import { searchHitOf } from '../search-contract.ts';
import { searchTerms } from '../search-query.ts';
import { storedSearchEvidence } from '../search-stored-evidence.ts';
import { draft, journalDatabase } from '../testing/database-harness.ts';

const { withJournal } = journalDatabase();
const hitCount = 50;
const maximumBytes = 65_536;
const contextRepeats = 4096;
const loneSurrogate =
  /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u;

it('bounds 50 three-source Unicode results while retaining distant prefix evidence', async () => {
  const terms = searchTerms('sprue Σίσυ 𐐀');
  const raw = `${'🌿 quiet '.repeat(contextRepeats)}Sprueche ${'🌿 quiet '.repeat(contextRepeats)}Σίσυφος ${'🌿 quiet '.repeat(contextRepeats)}𐐀𐐨`;
  const evidence = storedSearchEvidence({
    journalText: raw,
    scriptureText: raw,
    scriptureReferenceText: raw,
  });
  const matches = await withJournal(({ search }) =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* sql`
      insert into entry (entry_date,journal_markdown,journal_word_count,journal_search_text,scripture_search_text,
        scripture_reference_search_text,search_token_text,search_projection_revision,search_evidence_revision)
      select date '2026-01-01' + day_offset, '', 1, ${raw}, ${raw}, ${raw}, 'quiet sprueche σίσυφοσ 𐐨𐐨', 1, 1
      from generate_series(0, ${hitCount} - 1) as series(day_offset)
    `;
      yield* sql`
      insert into entry_search_evidence (entry_date,kind,token,position,excerpt,match_start,match_length)
      select entry_date,kind,token,position,excerpt,"matchStart","matchLength"
      from entry cross join jsonb_to_recordset(${JSON.stringify(evidence)}::jsonb)
        as evidence(kind text,token text,position integer,excerpt text,"matchStart" integer,"matchLength" integer)
    `;
      return yield* search.search(terms, hitCount);
    }),
  );
  expect(matches).toHaveLength(hitCount);
  expect(
    matches.reduce(
      (total, match) =>
        total +
        match.evidence.reduce(
          (sum, item) => sum + Buffer.byteLength(item.text),
          0,
        ),
      0,
    ),
  ).toBeLessThanOrEqual(maximumBytes);
  for (const match of matches) {
    const hit = searchHitOf(terms)(match);
    expect(hit.sources.map(({ kind }) => kind)).toEqual([
      'evening',
      'scripture-notes',
      'passage-reference',
    ]);
    for (const source of hit.sources) {
      const highlights = source.excerpts
        .flatMap((excerpt) =>
          excerpt
            .filter(({ match: matched }) => matched)
            .map(({ text }) => text),
        )
        .join(' ');
      expect(highlights).toContain('Sprueche');
      expect(highlights).toContain('Σίσυφος');
      expect(highlights).toContain('𐐀𐐨');
      expect(
        source.excerpts.flat().some(({ text }) => loneSurrogate.test(text)),
      ).toBe(false);
    }
  }
});

it('keeps the entry and its evidence unchanged when evidence persistence fails', async () => {
  const result = await withJournal(({ entries, search }) =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* entries.save(draft('2026-03-01', 'original needle'));
      yield* sql`create function reject_test_evidence() returns trigger language plpgsql as $$ begin if new.token = 'rejected' then raise exception 'test evidence failure'; end if; return new; end $$`;
      yield* sql`create trigger reject_test_evidence before insert on entry_search_evidence for each row execute function reject_test_evidence()`;
      const failure = yield* entries
        .save(draft('2026-03-01', 'rejected replacement', '', 1))
        .pipe(Effect.either);
      const original = yield* search.search(['original'], hitCount);
      const replacement = yield* search.search(['replacement'], hitCount);
      const rows =
        yield* sql`select revision,journal_markdown as "journalMarkdown" from entry where entry_date='2026-03-01'`;
      return { failure, original, replacement, rows };
    }),
  );
  expect(result.failure._tag).toBe('Left');
  expect(result.original).toHaveLength(1);
  expect(result.replacement).toEqual([]);
  expect(result.rows).toEqual([
    { revision: 1, journalMarkdown: 'original needle' },
  ]);
});

it('clears evidence when prose is cleared and preserves it after a stale save', async () => {
  const result = await withJournal(({ entries, search }) =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* entries.save(draft('2026-03-01', 'original needle'));
      yield* entries.save(draft('2026-03-01', 'current needle', '', 1));
      const conflict = yield* entries
        .save(draft('2026-03-01', 'stale replacement', '', 1))
        .pipe(Effect.either);
      const current = yield* search.search(['current'], hitCount);
      yield* entries.save(draft('2026-03-01', '', '', 2));
      const retained =
        yield* sql`select token from entry_search_evidence where entry_date='2026-03-01'`;
      return { conflict, current, retained };
    }),
  );
  expect(result.conflict._tag).toBe('Left');
  expect(result.current).toHaveLength(1);
  expect(result.retained).toEqual([]);
});

it('retains actual evidence when a 200-character query expands to more than 100 terms', async () => {
  const query =
    'ﷺ ¼ ℀ ⅔ ⅚ ⅞ ㎧ ㎯ ﷻ ℅ ℆ ⅑ ⅒ ↉ ㏆ ㏘ ㏞ b d e f g h i j k l n q r t w x y z µ À Á Â Ã Ä Å Æ Ç È É Ê Ë Ì Í Î Ï Ð Ñ Ò Ó Ô Õ Ö Ø Ù Ú Û Ü Ý Þ ß ÿ Ā Ă Ą Ć Ĉ Ċ Č Ď Đ Ē Ĕ Ė Ę Ě Ĝ Ğ Ġ Ģ Ĥ Ħ Ĩ Ī Ĭ Į ı Ĳ Ĵ Ķ ĸ Ĺ Ļ Ľ ';
  const terms = searchTerms(query);
  const raw = terms.join(' distant context ');
  const evidence = storedSearchEvidence({
    journalText: raw,
    scriptureText: raw,
    scriptureReferenceText: raw,
  });
  const matches = await withJournal(({ search }) =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* sql`insert into entry (entry_date,journal_markdown,journal_word_count,journal_search_text,scripture_search_text,
      scripture_reference_search_text,search_token_text,search_projection_revision,search_evidence_revision)
      values ('2026-03-01','',1,${raw},${raw},${raw},${terms.join(' ')},1,1)`;
      yield* sql`insert into entry_search_evidence (entry_date,kind,token,position,excerpt,match_start,match_length)
      select '2026-03-01',kind,token,position,excerpt,"matchStart","matchLength"
      from jsonb_to_recordset(${JSON.stringify(evidence)}::jsonb)
        as evidence(kind text,token text,position integer,excerpt text,"matchStart" integer,"matchLength" integer)`;
      return yield* search.search(terms, hitCount);
    }),
  );
  const maximumQueryLength = 200;
  const expandedTermCount = 111;
  const maximumHitBytes = 1200;
  const sourceKindCount = 3;
  expect(query).toHaveLength(maximumQueryLength);
  expect(terms).toHaveLength(expandedTermCount);
  expect(matches).toHaveLength(1);
  expect(matches[0]?.evidence).toHaveLength(terms.length * sourceKindCount);
  expect(
    matches[0]?.evidence.every(
      ({ text, matchLength }) => text.length > 0 && matchLength > 0,
    ),
  ).toBe(true);
  expect(
    matches[0]?.evidence.reduce(
      (sum, { text }) => sum + Buffer.byteLength(text),
      0,
    ),
  ).toBeLessThanOrEqual(maximumHitBytes);
  const hit = matches[0] && searchHitOf(terms)(matches[0]);
  expect(
    hit?.sources.every(({ excerpts }) =>
      excerpts.every((excerpt) => excerpt.some(({ match }) => match)),
    ),
  ).toBe(true);
});
