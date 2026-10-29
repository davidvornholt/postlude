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

  it('reads each item as its own line', () => {
    expect(journalMarkdownText('- [x] finished\n- [ ] waiting')).toBe(
      'finished\nwaiting',
    );
  });
});
