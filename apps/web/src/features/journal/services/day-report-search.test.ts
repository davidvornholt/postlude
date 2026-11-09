/**
 * Search through the report /wrap stored, against a real Postgres, because the
 * report's text and its index are columns the database derives from the HTML.
 */

import { expect, it } from 'bun:test';
import { Effect } from 'effect';

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
  readonly report?: string;
};

/** Stores the days, then searches them the way the page or the CLI does. */
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
        if (report !== undefined) {
          yield* areas.putWrap(date, {
            dayMetrics: sampleDayMetrics(date),
            metricsVersion: 2,
            reportHtml: report,
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
        report: '<h2>Work</h2><p>Merged the parser refactor.</p>',
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
    [{ date: '2026-03-01', report: `<p>${before}parser${after}</p>` }],
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
    [{ date: '2026-03-01', report: '<p>Fixed the parser.</p>' }],
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
        report: '<p>Merged the parser refactor.</p>',
      },
    ],
    'parser',
    { scope: writingOnly },
  );
  expect(hits).toEqual([]);
});

it('reads only the text a reader of the report sees', async () => {
  const report = [
    '<title>Titlehidden</title>',
    '<style>.stylehidden { color: red }</style>',
    '<svg viewBox="0 0 1 1"><text>drawinghidden</text></svg>',
    '<script>const scripthidden = "</style>";</script>',
    '<p class="attributehidden">Tom &amp; Jerry &lt;3 na&#xEF;ve&nbsp;caf&#233;</p>',
  ].join('\n');
  const hits = await searched([{ date: '2026-03-01', report }], 'naïve café');
  // The report is short enough for its excerpt to be all of its text.
  expect(hits.map(marked)).toEqual([
    [
      {
        kind: 'day-report',
        excerpts: ['Tom & Jerry <3 [naïve] [café]'],
      },
    ],
  ]);
});

it('puts the days David wrote the words on before the days only a report holds them', async () => {
  const days = [
    { date: '2026-03-01', writing: 'Rain all night.' },
    { date: '2026-03-02', writing: 'Rain again.', report: '<p>Rain.</p>' },
    { date: '2026-03-05', writing: 'Sun.', report: '<p>Rain at noon.</p>' },
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
        report: '<p>Merged the parser.</p>',
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
