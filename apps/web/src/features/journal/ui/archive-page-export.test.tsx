import { expect, it } from 'bun:test';

import { renderInRouter } from '#/shared/testing/render-in-router.tsx';
import {
  elementAttributes,
  plainText,
} from '#/shared/testing/rendered-html.ts';
import { activityWindow } from '../activity.ts';
import type { ArchiveView } from '../services/archive-fns.ts';
import { ArchivePage } from './archive-page.tsx';

const today = '2026-08-26';
const currentYear = 2026;
const noDownload = () => Promise.resolve(new Response());
const emptyView: ArchiveView = {
  today,
  window: activityWindow(today),
  days: [],
  years: [],
  journalStreak: { current: 0, longest: 0 },
  scriptureStreak: { current: 0, longest: 0 },
  totals: { daysWritten: 0, words: 0 },
  anniversaries: [],
};

const renderArchive = (view: ArchiveView) =>
  renderInRouter(
    <ArchivePage download={noDownload} selectedYear={undefined} view={view} />,
  );

it('offers the journal as a download, and not before there is one', async () => {
  const empty = await renderArchive(emptyView);
  const filled = await renderArchive({ ...emptyView, years: [currentYear] });

  expect(plainText(filled)).toContain('Download the journal');
  expect(elementAttributes(filled, 'h2', 'Your own copy')).not.toBe('');
  expect(empty).not.toContain('Download the journal');
});
