import { expect, it } from 'bun:test';

import { exportReadme } from './export-readme.ts';

const readme = (entryCount: number): string =>
  exportReadme({
    exportedAt: '2026-08-26T20:00:00.123456Z',
    journalDate: '2026-08-26',
    timeZone: 'Europe/Berlin',
    entryCount,
  });

it('names the authoritative files and the non-authoritative projections', () => {
  const text = readme(2);

  expect(text).toContain('`manifest.json`');
  expect(text).toContain('`entries.ndjson`');
  expect(text).toContain('non-authoritative reading copies');
  expect(text).toContain('exact recovery or re-import');
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

it('does not hard-wrap generated prose', () => {
  const proseParagraphs = readme(0)
    .trimEnd()
    .split('\n\n')
    .filter((paragraph) => !paragraph.startsWith('#'));

  expect(proseParagraphs.every((paragraph) => !paragraph.includes('\n'))).toBe(
    true,
  );
});
