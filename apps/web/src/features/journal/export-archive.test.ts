import { describe, expect, it } from 'bun:test';
import { parse as parseYaml } from 'yaml';

import {
  entryDocument,
  entryPath,
  exportFileName,
  exportFiles,
} from './export-archive.ts';
import type { ExportEntry } from './export-format.ts';

const timestamp = '2026-03-01T20:00:00.000000Z';
const frontMatterMarkerLength = 4;
const context = {
  exportedAt: new Date('2026-08-26T20:00:00.000Z'),
  journalDate: '2026-08-26',
  timeZone: 'Europe/Berlin',
} as const;

const entry = (parts: Partial<ExportEntry> = {}): ExportEntry => ({
  date: '2026-03-01',
  journalMarkdown: '',
  scriptureMarkdown: '',
  scriptureReference: null,
  journalFirstUsedAt: null,
  scriptureFirstUsedAt: null,
  createdAt: timestamp,
  updatedAt: timestamp,
  ...parts,
});

const yamlOf = (document: string): string => {
  const closing = document.indexOf('\n---', frontMatterMarkerLength);
  return document.slice(frontMatterMarkerLength, closing);
};

describe('entryDocument', () => {
  it('quotes boundary dates under the core and YAML 1.1 schemas', () => {
    const yaml = yamlOf(entryDocument(entry({ date: '2001-01-01' })));

    expect(yaml).toContain('date: "2001-01-01"');
    expect(parseYaml(yaml, { schema: 'core' })).toEqual({
      date: '2001-01-01',
    });
    expect(parseYaml(yaml, { schema: 'yaml-1.1' })).toEqual({
      date: '2001-01-01',
    });
  });

  it('quotes the formatted scripture reference in front matter', () => {
    const document = entryDocument(
      entry({
        scriptureReference: {
          book: 'Proverbs',
          chapter: 12,
          verseStart: 5,
          verseEnd: 13,
        },
      }),
    );

    expect(yamlOf(document)).toContain('scripture: "Proverbs 12:5-13"');
  });

  it('keeps a reference-only morning visible', () => {
    const document = entryDocument(
      entry({
        scriptureReference: {
          book: 'Psalms',
          chapter: 23,
          verseStart: null,
          verseEnd: null,
        },
      }),
    );

    expect(document).toContain('## Morning\n\nPassage: Psalms 23');
    expect(document).not.toContain('## Evening');
  });

  it('isolates hostile morning and evening Markdown with longer fences', () => {
    const morning = 'before\n`````ts\nunclosed\n  trailing  ';
    const evening = 'after\n```\nstill exact\n';
    const document = entryDocument(
      entry({ journalMarkdown: evening, scriptureMarkdown: morning }),
    );

    expect(document).toContain(
      `\n\n\`\`\`\`\`\`markdown\n${morning}\n\`\`\`\`\`\``,
    );
    expect(document).toContain(
      `\`\`\`\`\`\`\n\n## Evening\n\n\`\`\`\`markdown\n${evening}\`\`\`\``,
    );
  });

  it('does not trim exact source inside a projection fence', () => {
    const markdown = '  indented\r\n\r\nlast  \n';
    expect(entryDocument(entry({ journalMarkdown: markdown }))).toContain(
      `\n${markdown}\`\`\``,
    );
  });
});

describe('exportFiles', () => {
  it('writes authoritative files before safe dated projections', () => {
    const files = exportFiles(
      [entry({ date: '2025-12-31' }), entry({ date: '2026-01-01' })],
      context,
    );

    expect(files.map((file) => file.path)).toEqual([
      'manifest.json',
      'entries.ndjson',
      'README.md',
      'days/2025/2025-12-31.md',
      'days/2026/2026-01-01.md',
    ]);
    expect(files[0]?.text).toContain('"count": 2');
  });

  it('still explains an empty journal with zero machine records', () => {
    const files = exportFiles([], context);
    expect(files.map((file) => file.path)).toEqual([
      'manifest.json',
      'entries.ndjson',
      'README.md',
    ]);
    expect(files[1]?.text).toBe('');
    expect(files[2]?.text).toContain('0 days');
  });
});

describe('safe names', () => {
  it('uses the journal date for stable paths and filename', () => {
    expect(entryPath('2026-08-26')).toBe('days/2026/2026-08-26.md');
    expect(exportFileName('2026-08-26')).toBe('postlude-2026-08-26.zip');
  });

  it('refuses malformed and traversal-shaped dates', () => {
    for (const date of ['../secret', '2026-02-30', '2026/08/26']) {
      expect(() => entryPath(date)).toThrow();
      expect(() => exportFileName(date)).toThrow();
    }
  });
});
