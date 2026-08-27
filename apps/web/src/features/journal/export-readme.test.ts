import { describe, expect, it } from 'bun:test';

import type { ExportGrouping } from './export-period.ts';
import { exportReadme } from './export-readme.ts';

const groupedEntryCount = 1000;
const readme = (entryCount: number, grouping: ExportGrouping = 'day'): string =>
  exportReadme(
    {
      exportedAt: '2026-08-26T20:00:00.123456Z',
      journalDate: '2026-08-26',
      timeZone: 'Europe/Berlin',
      entryCount,
    },
    grouping,
  );

it('names the authoritative files and exact recovery for every grouping', () => {
  for (const grouping of ['day', 'week', 'month', 'year'] as const) {
    const text = readme(2, grouping);
    expect(text).toContain('`manifest.json`');
    expect(text).toContain('`entries.ndjson`');
    expect(text).toContain('non-authoritative reading copies');
    expect(text).toContain('exact recovery or re-import');
  }
});

it('states recoverable stored-content selection exactly', () => {
  const text = readme(2);
  expect(text).toContain('either stored Markdown string is not empty');
  expect(text).toContain('or it has a scripture reference');
  expect(text).toContain('Markdown structure and whitespace');
  expect(text).toContain('fully cleared');
  expect(text).toContain('provenance-only');
});

it('records the IANA zone, 04:00 boundary, and six-digit export instant', () => {
  const text = readme(1);
  expect(text).toContain('2026-08-26T20:00:00.123456Z');
  expect(text).toContain('`Europe/Berlin`');
  expect(text).toContain('starts at 04:00');
  expect(text).toContain('1 day with recoverable stored content');
});

describe('Markdown projection layout', () => {
  it('describes the Day backup projection and its folders', () => {
    expect(readme(2, 'day')).toContain('`days/YYYY/YYYY-MM-DD.md`');
    expect(readme(2, 'day')).toContain('one journal day each');
  });

  it('describes Week folders and ISO week boundaries only for Week', () => {
    expect(readme(2, 'week')).toContain('`weeks/YYYY/YYYY-Www.md`');
    expect(readme(2, 'week')).toContain('ISO weeks run Monday to Sunday');
    expect(readme(2, 'month')).not.toContain('ISO 8601');
    expect(readme(2, 'year')).not.toContain('ISO 8601');
  });

  it('describes Month folders and Year files at the archive root', () => {
    expect(readme(2, 'month')).toContain('`months/YYYY/YYYY-MM.md`');
    expect(readme(2, 'year')).toContain('`YYYY.md` files at the top');
    expect(readme(2, 'year')).toContain('no redundant folder');
  });
});

it('groups a four-digit entry count', () => {
  expect(readme(groupedEntryCount)).toContain(
    'contains 1,000 days with recoverable stored content',
  );
});

it('does not hard-wrap generated prose', () => {
  const proseParagraphs = readme(0)
    .trimEnd()
    .split('\n\n')
    .filter((paragraph) => !paragraph.startsWith('#'));
  expect(proseParagraphs.every((paragraph) => !paragraph.includes('\n'))).toBe(
    true,
  );
});
