import { describe, expect, it } from 'bun:test';
import { YAML as BunYaml } from 'bun';
import { parse as parseYaml } from 'yaml';

import type { ExportEntry } from './export-format.ts';
import { entryDocument, periodDocument } from './export-markdown.ts';

const timestamp = '2026-03-01T20:00:00.000000Z';
const frontMatterMarkerLength = 4;

const entry = (date: string): ExportEntry => ({
  date,
  journalMarkdown: '',
  scriptureMarkdown: '',
  scriptureReference: null,
  journalFirstUsedAt: null,
  scriptureFirstUsedAt: null,
  createdAt: timestamp,
  updatedAt: timestamp,
});

const frontMatterOf = (document: string): string => {
  const closing = document.indexOf('\n---', frontMatterMarkerLength);
  return document.slice(frontMatterMarkerLength, closing);
};

const parsers = [
  ['yaml', parseYaml],
  ['Bun.YAML', BunYaml.parse],
] as const;

describe.each(parsers)('%s front matter compatibility', (_name, parse) => {
  it('keeps a daily date as a string', () => {
    const parsed = parse(frontMatterOf(entryDocument(entry('2001-01-01'))));

    expect(parsed).toEqual({ date: '2001-01-01' });
    expect(typeof (parsed as { readonly date: unknown }).date).toBe('string');
  });

  it('keeps aggregate period bounds as strings and its day count as a number', () => {
    const parsed = parse(
      frontMatterOf(
        periodDocument('week', {
          key: '2026-W01',
          days: [entry('2025-12-31'), entry('2026-01-01')],
        }),
      ),
    );

    expect(parsed).toEqual({
      period: '2026-W01',
      from: '2025-12-31',
      to: '2026-01-01',
      days: 2,
    });
    const metadata = parsed as Readonly<Record<string, unknown>>;
    expect(typeof metadata.period).toBe('string');
    expect(typeof metadata.from).toBe('string');
    expect(typeof metadata.to).toBe('string');
    expect(typeof metadata.days).toBe('number');
  });
});
