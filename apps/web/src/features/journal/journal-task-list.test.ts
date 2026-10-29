import { describe, expect, it } from 'bun:test';

import {
  journalMarkdownText,
  parseJournalMarkdown,
  serializeJournalMarkdown,
} from './journal-markdown.ts';

const roundTrip = (markdown: string): string =>
  serializeJournalMarkdown(parseJournalMarkdown(markdown));

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
    const once = roundTrip('- [x] hello\n\n  ---');

    expect(roundTrip(once)).toBe(once);
  });

  it('reads each item as its own line', () => {
    expect(journalMarkdownText('- [x] finished\n- [ ] waiting')).toBe(
      'finished\nwaiting',
    );
  });
});
