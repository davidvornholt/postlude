import { expect, it } from 'bun:test';

import { renderInRouter } from '#/shared/testing/render-in-router.tsx';
import {
  attributeValue,
  elementAttributes,
  openingTag,
  plainText,
} from '#/shared/testing/rendered-html.ts';
import { activityWindow } from '../activity.ts';
import type { ArchiveView } from '../services/archive-fns.ts';
import { ArchivePage } from './archive-page.tsx';

const today = '2026-08-26';
const currentYear = 2026;
const emptyView: ArchiveView = {
  today,
  exportAvailable: false,
  window: activityWindow(today),
  days: [],
  years: [],
  journalStreak: { current: 0, longest: 0 },
  scriptureStreak: { current: 0, longest: 0 },
  totals: { daysWritten: 0, words: 0 },
};

const renderArchive = (view: ArchiveView) =>
  renderInRouter(<ArchivePage selectedYear={undefined} view={view} />);

it('offers recoverable source even when it produces no activity year', async () => {
  const empty = await renderArchive(emptyView);
  const sourceOnly = await renderArchive({
    ...emptyView,
    exportAvailable: true,
  });
  const filled = await renderArchive({
    ...emptyView,
    exportAvailable: true,
    years: [currentYear],
  });

  expect(plainText(sourceOnly)).toContain('No writing activity yet');
  expect(plainText(sourceOnly)).toContain('Download the journal');
  expect(elementAttributes(sourceOnly, 'h2', 'Your own copy')).not.toBe('');
  expect(plainText(filled)).toContain('Download the journal');
  expect(elementAttributes(filled, 'h2', 'Your own copy')).not.toBe('');
  expect(empty).not.toContain('Download the journal');
});

it('posts the download natively when JavaScript is absent', async () => {
  const sourceOnly = await renderArchive({
    ...emptyView,
    exportAvailable: true,
  });
  const form = openingTag(sourceOnly, 'form');
  const button = elementAttributes(
    sourceOnly,
    'button',
    'Download the journal',
  );

  expect(attributeValue(form, 'action')).toBe('/archive/export');
  expect(attributeValue(form, 'method')).toBe('post');
  expect(attributeValue(button, 'type')).toBe('submit');
});
