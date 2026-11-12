/**
 * Search through the report /wrap stored, against a real Postgres, because the
 * report's index is a column the database derives from its text.
 */

import { expect, it } from 'bun:test';
import { Effect } from 'effect';

import type { ReportDocument } from '../schemas/day-report-blocks.ts';
import { type SearchHit, searchHitOf } from '../search-contract.ts';
import { searchTerms } from '../search-query.ts';
import { draft, journalDatabase } from '../testing/database-harness.ts';
import { sampleDayMetrics } from '../testing/evening-view.ts';
import { type SearchScope, writingOnly } from './entry-search.ts';

const { withEveryService } = journalDatabase();

const plenty = 20;
const withReport: SearchScope = { dayReport: true };

type Day = {
  readonly date: string;
  readonly writing?: string;
  /** The report, as a document or as one paragraph of text. */
  readonly report?: string | ReportDocument;
};

const paragraphs = (...texts: ReadonlyArray<string>): ReportDocument => ({
  version: 1,
  blocks: texts.map((text) => ({ kind: 'paragraph', text: [text] })),
});

const searched = (
  days: ReadonlyArray<Day>,
  query: string,
  { scope = withReport, limit = plenty } = {},
) =>
  withEveryService(({ entries, areas, search }) =>
    Effect.gen(function* () {
      for (const { date, writing, report } of days) {
        if (writing !== undefined) {
          yield* entries.save(draft(date, writing));
        }
        const reportDocument =
          typeof report === 'string' ? paragraphs(report) : report;
        if (reportDocument !== undefined) {
          yield* areas.putWrap(date, {
            dayMetrics: sampleDayMetrics(date),
            metricsVersion: 2,
            reportDocument,
            reportModel: 'wrap-model',
          });
        }
      }
      const matches = yield* search.search(searchTerms(query), limit, scope);
      return matches.map(searchHitOf);
    }),
  );

/** Each source of a hit as its excerpts read, with the marked words in brackets. */
const marked = (hit: SearchHit | undefined) =>
  (hit?.sources ?? []).map(({ kind, excerpts }) => ({
    kind,
    excerpts: excerpts.map((segments) =>
      segments.map(({ text, match }) => (match ? `[${text}]` : text)).join(''),
    ),
  }));

it('finds a day by a word only its report holds, and says where it was', async () => {
  const [hit, ...rest] = await searched(
    [
      {
        date: '2026-03-01',
        writing: 'A quiet evening.',
        report: {
          version: 1,
          blocks: [
            {
              kind: 'section',
              heading: 'Work',
              blocks: [
                { kind: 'paragraph', text: ['Merged the parser refactor.'] },
              ],
            },
          ],
        },
      },
    ],
    'parse',
  );
  expect(rest).toEqual([]);
  expect(hit?.date).toBe('2026-03-01');
  expect(marked(hit)).toEqual([
    { kind: 'day-report', excerpts: ['Work Merged the [parser] refactor.'] },
  ]);
});

it('shows the words around a match deep in a long report', async () => {
  const before = 'early '.repeat(40);
  const after = ' late'.repeat(80);
  const [hit] = await searched(
    [{ date: '2026-03-01', report: `${before}parser${after}` }],
    'parser',
  );
  const [excerpt = ''] = marked(hit)[0]?.excerpts ?? [];
  const leading = 60;
  const excerptLength = 240;
  expect(excerpt.indexOf('[parser]')).toBe(leading);
  expect(excerpt.replace(/[[\]]/gu, '')).toHaveLength(excerptLength);
});

it('finds a report on a day David wrote nothing', async () => {
  const hits = await searched(
    [{ date: '2026-03-01', report: 'Fixed the parser.' }],
    'parser',
  );
  expect(hits.map(({ date, words }) => ({ date, words }))).toEqual([
    { date: '2026-03-01', words: 0 },
  ]);
});

it('leaves the report out of a search of David’s writing alone', async () => {
  const hits = await searched(
    [
      {
        date: '2026-03-01',
        writing: 'A quiet evening.',
        report: 'Merged the parser refactor.',
      },
    ],
    'parser',
    { scope: writingOnly },
  );
  expect(hits).toEqual([]);
});

it('reads only the words a reader of the report sees', async () => {
  const report: ReportDocument = {
    version: 1,
    blocks: [
      {
        kind: 'paragraph',
        text: [
          'Tom & Jerry <3 ',
          { emphasis: 'naïve' },
          ' ',
          { link: 'café', href: 'https://example.test/addresshidden' },
          { code: ' ok' },
        ],
      },
    ],
  };
  const hits = await searched([{ date: '2026-03-01', report }], 'naïve café');
  // The report is short enough for its excerpt to be all of its text.
  expect(hits.map(marked)).toEqual([
    [
      {
        kind: 'day-report',
        excerpts: ['Tom & Jerry <3 [naïve] [café] ok'],
      },
    ],
  ]);
  expect(
    await searched([{ date: '2026-03-01', report }], 'addresshidden'),
  ).toEqual([]);
});

it('puts the days David wrote the words on before the days only a report holds them', async () => {
  const days = [
    { date: '2026-03-01', writing: 'Rain all night.' },
    { date: '2026-03-02', writing: 'Rain again.', report: 'Rain.' },
    { date: '2026-03-05', writing: 'Sun.', report: 'Rain at noon.' },
  ];
  const hits = await searched(days, 'rain');
  expect(hits.map(({ date }) => date)).toEqual([
    '2026-03-02',
    '2026-03-01',
    '2026-03-05',
  ]);
  // A word David wrote that day is shown from his writing, not the report.
  expect(hits.map((hit) => hit.sources.map(({ kind }) => kind))).toEqual([
    ['evening'],
    ['evening'],
    ['day-report'],
  ]);
  const first = await searched(days, 'rain', { limit: 1 });
  expect(first.map(({ date }) => date)).toEqual(['2026-03-02']);
});

it('finds a day whose writing holds one word and its report the other', async () => {
  const hits = await searched(
    [
      {
        date: '2026-03-01',
        writing: 'Rain all night.',
        report: 'Merged the parser.',
      },
      { date: '2026-03-02', writing: 'Rain again.' },
    ],
    'rain parser',
  );
  expect(hits.map(marked)).toEqual([
    [
      { kind: 'evening', excerpts: ['[Rain] all night.'] },
      { kind: 'day-report', excerpts: ['Merged the [parser].'] },
    ],
  ]);
});

it('stores and finds a report whose words would overflow a search vector', async () => {
  // 90,000 distinct words, about 760 KB: under the 1 MiB a report may have,
  // over the 1 MiB a tsvector may have.
  const words = Array.from(
    { length: 90_000 },
    (_, index) => `word${index.toString(36)}`,
  );
  const wordsPerParagraph = 1000;
  const texts = Array.from(
    { length: words.length / wordsPerParagraph },
    (_, index) =>
      words
        .slice(index * wordsPerParagraph, (index + 1) * wordsPerParagraph)
        .join(' '),
  );
  const hits = await searched(
    [{ date: '2026-03-01', report: paragraphs('Kingfisher', ...texts) }],
    'kingfisher',
  );
  expect(hits.map(({ date }) => date)).toEqual(['2026-03-01']);
});
