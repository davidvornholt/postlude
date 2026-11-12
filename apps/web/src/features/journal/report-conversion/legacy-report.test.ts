import { describe, expect, it } from 'bun:test';
import { Schema } from 'effect';

import {
  type ReportBlock,
  type ReportDocument,
  ReportDocumentSchema,
} from '../schemas/day-report-blocks.ts';
import type {
  TimelineBlock,
  TimelineMark,
} from '../schemas/day-report-timeline.ts';
import { legacyFixture } from './fixtures/legacy-fixtures.ts';
import { parseHtml } from './html-tree.ts';
import {
  convertLegacyReport,
  type LegacyShape,
  legacyShapeOf,
  legacyShapes,
} from './legacy-report.ts';

/** Every block of a document, those inside sections included. */
const allBlocks = (blocks: ReadonlyArray<ReportBlock>): Array<ReportBlock> =>
  blocks.flatMap((block) =>
    block.kind === 'section' ? [block, ...allBlocks(block.blocks)] : [block],
  );

const blocksOf = <K extends ReportBlock['kind']>(
  document: ReportDocument,
  kind: K,
): Array<Extract<ReportBlock, { kind: K }>> =>
  allBlocks(document.blocks).filter(
    (block): block is Extract<ReportBlock, { kind: K }> => block.kind === kind,
  );

const sectionNamed = (document: ReportDocument, heading: string) =>
  blocksOf(document, 'section').find((block) => block.heading === heading);

const marksOf = (
  timeline: TimelineBlock,
  kind: TimelineMark['kind'],
): Array<TimelineMark> =>
  timeline.groups.flatMap((group) =>
    group.rows.flatMap((row) => row.marks.filter((mark) => mark.kind === kind)),
  );

const converted = (shape: LegacyShape) => {
  const fixture = legacyFixture(shape);
  const result = convertLegacyReport({
    html: fixture.reportHtml,
    day: fixture.day,
    dayMetrics: fixture.dayMetrics,
  });
  if (result === undefined) {
    throw new Error(`The ${shape} fixture did not convert.`);
  }
  return { ...result, fixture };
};

const tileLabels = (document: ReportDocument): Array<string> =>
  blocksOf(document, 'tiles').flatMap((block) =>
    block.tiles.map((tile) => tile.label),
  );

describe.each(legacyShapes)('a %s page', (shape) => {
  it('is known by its shape and converts to a document the schema holds to strictly', () => {
    const { shape: read, document, fixture } = converted(shape);
    expect(legacyShapeOf(parseHtml(fixture.reportHtml))).toBe(shape);
    expect(read).toBe(shape);
    const decoded = Schema.decodeUnknownExit(ReportDocumentSchema)(document, {
      onExcessProperty: 'error',
    });
    expect(decoded._tag).toBe('Success');
  });

  it('keeps no tile of tracked time, and draws the tiles from the metrics', () => {
    const { document } = converted(shape);
    const labels = tileLabels(document);
    expect(labels.length).toBeGreaterThan(0);
    for (const dropped of [
      'Tracked time',
      'Off the computer',
      'Away from the computer',
    ]) {
      expect(labels).not.toContain(dropped);
    }
    const screen = blocksOf(document, 'tiles')[0]?.tiles[0];
    expect(screen?.value).toEqual({ minutes: 330 });
  });
});

describe.each(['wrap-47', 'wrap-45'] as const)('a %s page', (shape) => {
  it('shows agent time as the clock time with an agent running, as its facts did', () => {
    const { document } = converted(shape);
    const agents = blocksOf(document, 'tiles')
      .flatMap((block) => block.tiles)
      .find((tile) => tile.label === 'Agent time');
    expect(agents).toEqual({
      label: 'Agent time',
      value: { minutes: 225 },
      note: ['3 h 55 min across 5 threads · up to 2 at once'],
    });
  });

  it('keeps the timeline with area totals, numbered pull requests, and titled parts', () => {
    const { document } = converted(shape);
    const [timeline] = blocksOf(document, 'timeline');
    if (timeline === undefined) {
      throw new Error('No timeline');
    }
    const screen = timeline.groups.find((group) =>
      group.title.startsWith('Your screen time'),
    );
    expect(screen?.rows.length).toBeGreaterThan(0);
    expect(screen?.rows.every((row) => row.total !== undefined)).toBe(true);
    const pullRequests = marksOf(timeline, 'pullRequest');
    expect(pullRequests.length).toBeGreaterThan(0);
    expect(
      pullRequests.every(
        (mark) => mark.kind === 'pullRequest' && mark.number !== undefined,
      ),
    ).toBe(true);
    expect(
      marksOf(timeline, 'part').some(
        (mark) => mark.kind === 'part' && mark.title !== undefined,
      ),
    ).toBe(true);
    expect(marksOf(timeline, 'mail').length).toBeGreaterThan(0);
  });

  it("drops the page's own legend and the separate time by category", () => {
    const { document } = converted(shape);
    const listed = blocksOf(document, 'list').flatMap((list) =>
      list.items.map((item) => item.text.join('')),
    );
    expect(listed).not.toContain('Your screen time');
    expect(listed).not.toContain('Focus');
    expect(
      blocksOf(document, 'table').map((table) => table.caption),
    ).not.toContain('Time by category (estimates)');
  });

  it('keeps the day in parts and the day in figures', () => {
    const { document } = converted(shape);
    const [parts] = blocksOf(document, 'parts');
    expect(parts?.parts.length).toBeGreaterThan(1);
    expect(parts?.parts.every((part) => part.title !== undefined)).toBe(true);
    expect(blocksOf(document, 'facts')[0]?.items.length).toBeGreaterThan(0);
    expect(sectionNamed(document, 'Lead time by thread')?.collapsed).toBe(true);
  });
});

it('reads the pull requests of a wrap-43 page without their numbers, which it never showed', () => {
  const { document } = converted('wrap-43');
  const [timeline] = blocksOf(document, 'timeline');
  const pullRequests =
    timeline === undefined ? [] : marksOf(timeline, 'pullRequest');
  expect(pullRequests).toEqual([
    {
      kind: 'pullRequest',
      at: '2026-10-29T04:00:00+01:00',
      repository: 'postlude',
      title: 'Start of day',
    },
    {
      kind: 'pullRequest',
      at: '2026-10-29T16:00:00+01:00',
      repository: 'sp-cli',
      title: 'Afternoon',
    },
  ]);
  expect(blocksOf(document, 'parts')[0]?.parts).toHaveLength(2);
});

it('keeps the time by category of a page without a timeline', () => {
  const { document } = converted('wrap-17');
  expect(blocksOf(document, 'timeline')).toHaveLength(0);
  expect(blocksOf(document, 'table')[0]).toEqual({
    kind: 'table',
    caption: 'Time by category (estimates)',
    columns: ['Category', 'Time'],
    rows: [
      [['Code'], ['3 h 20 min']],
      [['Mail'], ['1 h 20 min']],
      [['Admin'], ['50 min']],
    ],
  });
});

it('folds the sources away, from the metrics, with what the page noted', () => {
  const { document } = converted('wrap-47');
  const sources = sectionNamed(document, 'Sources');
  expect(sources?.collapsed).toBe(true);
  const [list] =
    sources === undefined
      ? []
      : blocksOf({ version: 1, blocks: sources.blocks }, 'list');
  expect(list?.items[0]).toEqual({
    text: ['activity:laptop'],
    meta: 'partial',
  });
});

it("keeps the sample page's note and figures", () => {
  const { document } = converted('postlude-sample');
  expect(document.blocks[0]).toEqual({
    kind: 'callout',
    tone: 'note',
    text: ['Sample data for a preview. Nothing here was measured.'],
  });
  expect(tileLabels(document)).toEqual([
    'Active',
    'Focused',
    'Short stretches',
    'In appointments',
    'Landed pull requests',
    'Mail sent',
  ]);
  const [tiles] = blocksOf(document, 'tiles');
  expect(tiles?.tiles[0]?.note).toEqual(['From 08:12 to 23:40']);
});

it("turns an alert in a page's header into a warning", () => {
  const fixture = legacyFixture('wrap-47');
  const html = fixture.reportHtml.replace(
    '</header>',
    '<div class="alert"><span class="alert-icon" aria-hidden="true">!</span><p>The desktop was not read.</p></div></header>',
  );
  const result = convertLegacyReport({
    html,
    day: fixture.day,
    dayMetrics: fixture.dayMetrics,
  });
  expect(result?.document.blocks).toContainEqual({
    kind: 'callout',
    tone: 'warning',
    text: ['The desktop was not read.'],
  });
});

it('keeps the words of a page of a shape it does not know, saying so', () => {
  const result = convertLegacyReport({
    html: '<!doctype html><html><head><title>Old</title><style>p{}</style></head><body><h1>A day</h1><p>Some <b>words</b>.</p><script>let x = "<p>no</p>";</script></body></html>',
    day: '2026-10-29',
    dayMetrics: null,
  });
  expect(result?.shape).toBe('text');
  expect(result?.document.blocks).toEqual([
    {
      kind: 'callout',
      tone: 'note',
      text: [
        'This report was converted from an older page whose layout Postlude does not know, so only its words are shown.',
      ],
    },
    { kind: 'paragraph', text: ['A day'] },
    { kind: 'paragraph', text: ['Some words.'] },
  ]);
});

it('converts a page without any words to nothing', () => {
  expect(
    convertLegacyReport({
      html: '<!doctype html><html><body><div class="timeline"></div></body></html>',
      day: '2026-10-29',
      dayMetrics: null,
    }),
  ).toBeUndefined();
  expect(
    convertLegacyReport({ html: '', day: '2026-10-29', dayMetrics: null }),
  ).toBeUndefined();
});

it('reads a page of a known shape whose metrics are missing', () => {
  const fixture = legacyFixture('wrap-47');
  const result = convertLegacyReport({
    html: fixture.reportHtml,
    day: fixture.day,
    dayMetrics: { not: 'metrics' },
  });
  expect(result?.shape).toBe('wrap-47');
  const screen =
    result === undefined
      ? undefined
      : blocksOf(result.document, 'tiles')[0]?.tiles[0];
  expect(screen).toEqual({ label: 'Screen time', value: null });
});
