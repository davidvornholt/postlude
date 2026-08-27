import { expect, it } from 'bun:test';

import { renderInRouter } from '#/shared/testing/render-in-router.tsx';
import {
  attributeValue,
  elementAttributes,
} from '#/shared/testing/rendered-html.ts';
import { activityWindow } from '../activity.ts';
import type { ArchiveView } from '../services/archive-fns.ts';
import { ArchivePage } from './archive-page.tsx';

const today = '2026-08-26';

const viewFor = (year: number): ArchiveView => ({
  today,
  exportAvailable: true,
  window: activityWindow(today, year),
  days: [],
  years: [year],
  journalStreak: { current: 0, longest: 0 },
  scriptureStreak: { current: 0, longest: 0 },
  totals: { daysWritten: 0, words: 0 },
  anniversaries: [],
});

it('keeps an accepted selected year coherent when the journal has no row there', async () => {
  const selectedYear = 2024;
  const selected = await renderInRouter(
    <ArchivePage selectedYear={selectedYear} view={viewFor(selectedYear)} />,
  );
  const selectedLink = elementAttributes(selected, 'a', String(selectedYear));

  expect(attributeValue(selectedLink, 'href')).toBe(
    `/archive?year=${selectedYear}`,
  );
  expect(attributeValue(selectedLink, 'aria-current')).toBe('page');
  expect(selected.match(/aria-current="page"/gu)).toHaveLength(1);
  expect(selected).toContain('Nothing was written in this stretch');
});

it('opens an early Common Era year with its four-digit journal label', async () => {
  const selectedYear = 1;
  const selected = await renderInRouter(
    <ArchivePage selectedYear={selectedYear} view={viewFor(selectedYear)} />,
  );
  const selectedLink = elementAttributes(selected, 'a', '0001');

  expect(attributeValue(selectedLink, 'href')).toBe('/archive?year=1');
  expect(attributeValue(selectedLink, 'aria-current')).toBe('page');
  expect(selected).toContain('January 1');
});
