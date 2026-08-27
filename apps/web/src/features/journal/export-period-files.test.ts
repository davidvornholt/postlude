import { describe, expect, it } from 'bun:test';

import { exportFiles } from './export-archive.ts';
import { emptyJournalEntry, type JournalEntry } from './schemas/entry.ts';

const today = '2026-08-26';
const entry = (
  date: string,
  parts: Partial<JournalEntry> = {},
): JournalEntry => ({ ...emptyJournalEntry(date), ...parts });
const pathsOf = (files: ReadonlyArray<{ readonly path: string }>) =>
  files.map((file) => file.path);

describe('period export files', () => {
  it('assembles a New Year ISO week as one reading copy', () => {
    const files = exportFiles(
      [
        entry('2025-12-31', { journalMarkdown: 'Year ending.' }),
        entry('2026-01-01', { journalMarkdown: 'Year beginning.' }),
      ],
      today,
      'week',
    );

    expect(pathsOf(files)).toEqual(['README.md', '2026/2026-W01.md']);
    expect(files[1]?.text).toContain('period: "2026-W01"');
    expect(files[1]?.text).toContain('from: "2025-12-31"');
    expect(files[1]?.text).toContain('to: "2026-01-01"');
    expect(files[1]?.text).toContain('## 2025-12-31');
    expect(files[1]?.text).toContain('## 2026-01-01');
  });

  it('assembles each month with only its own days', () => {
    const files = exportFiles(
      [
        entry('2026-01-30', { journalMarkdown: 'January.' }),
        entry('2026-02-01', { journalMarkdown: 'February.' }),
      ],
      today,
      'month',
    );

    expect(pathsOf(files)).toEqual([
      'README.md',
      '2026/2026-01.md',
      '2026/2026-02.md',
    ]);
    expect(files[1]?.text).toContain('# January 2026');
    expect(files[1]?.text).not.toContain('## 2026-02-01');
    expect(files[2]?.text).toContain('# February 2026');
    expect(files[2]?.text).not.toContain('## 2026-01-30');
  });

  it('assembles each year at the archive root', () => {
    const files = exportFiles(
      [
        entry('2025-12-31', { journalMarkdown: 'Last page.' }),
        entry('2026-01-01', { journalMarkdown: 'First page.' }),
      ],
      today,
      'year',
    );

    expect(pathsOf(files)).toEqual(['README.md', '2025.md', '2026.md']);
    expect(files[1]?.text).toContain('period: "2025"');
    expect(files[1]?.text).not.toContain('## 2026-01-01');
    expect(files[2]?.text).toContain('period: "2026"');
    expect(files[2]?.text).not.toContain('## 2025-12-31');
  });
});
