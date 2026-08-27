import { describe, expect, it } from 'bun:test';

import {
  type ExportEntry,
  entriesDocument,
  entriesPath,
  exportEntriesMediaType,
  exportFormatVersion,
  exportManifestMediaType,
  manifestDocument,
  parseEntriesDocument,
  parseManifestDocument,
} from './export-format.ts';

const createdAt = '2026-03-29T00:59:59.123456Z';
const updatedAt = '2026-10-25T01:00:00.654321Z';
const twoRecordsAndTerminalLine = 3;

const entry = (parts: Partial<ExportEntry> = {}): ExportEntry => ({
  date: '2026-03-29',
  journalMarkdown: '',
  scriptureMarkdown: '',
  scriptureReference: null,
  journalFirstUsedAt: null,
  scriptureFirstUsedAt: null,
  createdAt,
  updatedAt,
  ...parts,
});

describe('manifestDocument', () => {
  it('pins media, version, IANA zone, 04:00 rule, and six-digit UTC time', () => {
    const manifest = parseManifestDocument(
      manifestDocument({
        exportedAt: '2026-08-26T20:21:22.123456Z',
        journalDate: '2026-08-26',
        timeZone: 'Europe/Berlin',
        entryCount: 2,
      }),
    );

    expect(manifest).toEqual({
      mediaType: exportManifestMediaType,
      version: exportFormatVersion,
      exportedAt: '2026-08-26T20:21:22.123456Z',
      journalDate: '2026-08-26',
      journalDay: { timeZone: 'Europe/Berlin', startsAt: '04:00' },
      entries: {
        path: entriesPath,
        mediaType: exportEntriesMediaType,
        count: 2,
      },
    });
  });

  it('refuses a zone that cannot define journal days', () => {
    expect(() =>
      manifestDocument({
        exportedAt: '1970-01-01T00:00:00.000000Z',
        journalDate: '2026-08-26',
        timeZone: 'Not/A_Zone',
        entryCount: 0,
      }),
    ).toThrow();
  });
});

describe('entriesDocument', () => {
  it('round-trips exact Unicode, newlines, references, and provenance', () => {
    const original = entry({
      journalMarkdown: '  e\u0301 👨‍👩‍👧‍👦\r\n\r\nlast  \n',
      scriptureMarkdown: '先に\n後で\n',
      scriptureReference: {
        book: 'Proverbs',
        chapter: 12,
        verseStart: 5,
        verseEnd: 13,
      },
      journalFirstUsedAt: '2026-03-29T01:00:00.000001Z',
      scriptureFirstUsedAt: '2026-03-28T23:59:59.999999Z',
    });

    const document = entriesDocument([original]);
    expect(document.endsWith('\n')).toBe(true);
    expect(document).toContain('\\r\\n');
    expect(parseEntriesDocument(document)).toEqual([original]);
  });

  it('keeps one compact record on each line', () => {
    const document = entriesDocument([entry(), entry({ date: '2026-03-30' })]);

    expect(document.split('\n')).toHaveLength(twoRecordsAndTerminalLine);
    expect(parseEntriesDocument(document)).toHaveLength(2);
  });

  it('requires the terminal line feed and refuses blank records', () => {
    const line = entriesDocument([entry()]);
    expect(() => parseEntriesDocument(line.trimEnd())).toThrow();
    expect(() => parseEntriesDocument(`${line}\n`)).toThrow();
  });

  it('rejects fields outside the versioned entry schema', () => {
    const record = { ...entry(), unversioned: true };

    expect(() => parseEntriesDocument(`${JSON.stringify(record)}\n`)).toThrow();
  });

  it('rejects calendar dates disguised as UTC instants', () => {
    const invalid = entry({ createdAt: '2026-02-30T12:00:00.000000Z' });
    expect(() => entriesDocument([invalid])).toThrow();
  });
});
