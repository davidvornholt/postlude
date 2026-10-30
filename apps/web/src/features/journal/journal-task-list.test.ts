import { describe, expect, it } from 'bun:test';

import {
  journalMarkdownText,
  parseJournalMarkdown,
  serializeJournalMarkdown,
} from './journal-markdown.ts';

const roundTrip = (markdown: string): string =>
  serializeJournalMarkdown(parseJournalMarkdown(markdown));

const afterAsWord = /\bafter\b/u;

const saveFiveTimes = (markdown: string): Array<string> =>
  Array.from({ length: 5 }).reduce<Array<string>>(
    (saves) => [...saves, roundTrip(saves.at(-1) ?? markdown)],
    [],
  );

describe('journal checklists', () => {
  it('keeps each item ticked or open through an edit', () => {
    expect(roundTrip('Intro\n\n- [x] finished\n- [ ] waiting')).toBe(
      'Intro\n\n- [x] finished\n- [ ] waiting',
    );
  });

  it('keeps a nested checklist and a plain list beside it', () => {
    const markdown =
      '- [ ] pack\n  - [x] tent\n  - [ ] stove\n\n- a plain point';

    expect(roundTrip(markdown)).toBe(markdown);
  });

  it('keeps a line break inside its item', () => {
    expect(roundTrip('- [x] call  \nBob')).toBe('- [x] call  \nBob');
  });

  it('leaves an indented code block as code', () => {
    expect(parseJournalMarkdown('    - [x] code').content?.[0]?.type).toBe(
      'codeBlock',
    );
  });

  it('keeps a new empty item a checklist item', () => {
    const markdown = serializeJournalMarkdown({
      type: 'doc',
      content: [
        {
          type: 'taskList',
          content: [
            {
              type: 'taskItem',
              attrs: { checked: true },
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'done' }],
                },
              ],
            },
            {
              type: 'taskItem',
              attrs: { checked: false },
              content: [{ type: 'paragraph' }],
            },
          ],
        },
      ],
    });

    expect(roundTrip(markdown)).toBe(markdown);
  });

  it('keeps a rule inside an item through repeated edits', () => {
    for (const markdown of ['- [x] hello\n\n  ---', '- hello\n\n  ---']) {
      const saves = saveFiveTimes(markdown);

      expect(saves).toEqual(saves.map(() => saves[0]));
      expect(
        JSON.stringify(parseJournalMarkdown(saves[0] ?? '')),
      ).not.toContain('heading');
    }
  });

  it('keeps a bullet that is only a reference link a link', () => {
    expect(saveFiveTimes('- [x]\n\n[x]: https://example.com')).toEqual(
      Array.from({ length: 5 }, () => '- [x](https://example.com)'),
    );
  });

  it('keeps the text beside a rule in a numbered item', () => {
    for (const markdown of [
      '1. hello\n\n   ---\n\n   after',
      '1. parent\n   - alpha\n\n     after\n\n     ---',
    ]) {
      const saves = saveFiveTimes(markdown);

      expect(saves.map(journalMarkdownText)).toEqual(
        Array.from({ length: 5 }, () => expect.stringMatching(afterAsWord)),
      );
      const fifth = saves.at(-1) ?? '';
      expect(roundTrip(fifth)).toBe(fifth);
    }
  });

  it('reads each item as its own line', () => {
    expect(journalMarkdownText('- [x] finished\n- [ ] waiting')).toBe(
      'finished\nwaiting',
    );
  });
});
