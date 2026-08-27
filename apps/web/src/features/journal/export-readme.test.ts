import { expect, it } from 'bun:test';

import { exportReadme } from './export-readme.ts';

const readme = (entryCount: number): string =>
  exportReadme({
    exportedAt: new Date('2026-08-26T20:00:00.123Z'),
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

it('states current meaningful-day selection exactly', () => {
  const text = readme(2);

  expect(text).toContain('evening word count is positive');
  expect(text).toContain('morning word count is positive');
  expect(text).toContain('or it has a scripture reference');
  expect(text).toContain('A cleared row');
});

it('records the IANA zone, 04:00 boundary, and six-digit export instant', () => {
  const text = readme(1);

  expect(text).toContain('2026-08-26T20:00:00.123000Z');
  expect(text).toContain('`Europe/Berlin`');
  expect(text).toContain('starts at 04:00');
  expect(text).toContain('1 day with current meaningful content');
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
