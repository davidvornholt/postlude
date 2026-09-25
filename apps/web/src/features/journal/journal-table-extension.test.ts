import { describe, expect, it } from 'bun:test';

import {
  journalMarkdownText,
  parseJournalMarkdown,
  serializeJournalMarkdown,
} from './journal-markdown.ts';

const roundTrip = (markdown: string): string =>
  serializeJournalMarkdown(parseJournalMarkdown(markdown));

const cell = (text: string, attrs: Record<string, unknown> = {}) => ({
  type: 'tableCell',
  attrs: { colspan: 1, rowspan: 1, colwidth: null, align: null, ...attrs },
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

describe('journal tables', () => {
  it('keeps a table between paragraphs and lines up its columns', () => {
    expect(
      roundTrip(
        'Before\n\n|Hour|Mood|Note|\n|:-|-:|:-:|\n|Dawn|**calm**|a|\n\nAfter',
      ),
    ).toBe(`Before

| Hour | Mood     | Note |
| :--- | -------: | :--: |
| Dawn | **calm** | a    |

After`);
  });

  it('reads a cell line break the same way with or without a browser', () => {
    const markdown = '| Day |\n| --- |\n| one<br>two<br/>three |';

    expect(journalMarkdownText(markdown)).toBe('Day\none\ntwo\nthree');
    expect(roundTrip(markdown)).toBe(
      '| Day                 |\n| ------------------- |\n| one<br>two<br>three |',
    );
  });

  it('keeps pipes inside cells and code spans', () => {
    const markdown = '| Text | Code |\n| --- | --- |\n| a \\| b | `x|y` |';
    const serialized = roundTrip(markdown);

    expect(serialized).toBe(
      '| Text   | Code   |\n| ------ | ------ |\n| a \\| b | `x\\|y` |',
    );
    expect(journalMarkdownText(serialized)).toBe('Text Code\na | b x|y');
  });

  it('keeps every row as wide as the table when a cell spans columns', () => {
    const markdown = serializeJournalMarkdown({
      type: 'doc',
      content: [
        {
          type: 'table',
          content: [
            { type: 'tableRow', content: [cell('a'), cell('b')] },
            { type: 'tableRow', content: [cell('wide', { colspan: 2 })] },
          ],
        },
      ],
    });

    expect(markdown).toBe('| a    | b   |\n| ---- | --- |\n| wide |     |');
  });

  it('separates cells in the visible text used by search', () => {
    expect(
      journalMarkdownText('| Hour | Mood |\n| --- | --- |\n| Dawn | Calm |'),
    ).toBe('Hour Mood\nDawn Calm');
  });
});
