import { describe, expect, it } from 'bun:test';

import { Editor } from '@tiptap/core';

import {
  journalMarkdownExtensions,
  parseJournalMarkdown,
  serializeJournalMarkdown,
} from './journal-markdown.ts';

const toChecklistAt = (markdown: string, text: string): string => {
  const editor = new Editor({
    element: null,
    extensions: journalMarkdownExtensions(),
    content: parseJournalMarkdown(markdown),
  });
  let position = -1;
  editor.state.doc.descendants((node, pos) => {
    if (position < 0 && node.isTextblock && node.textContent === text) {
      position = pos + 1;
    }
  });
  editor.commands.setTextSelection(position);
  editor.commands.toggleTaskList();
  const result = serializeJournalMarkdown(editor.getJSON());
  editor.destroy();
  return result;
};

describe('turning a list into a checklist', () => {
  it('keeps the nested items that were ticked ticked', () => {
    expect(
      toChecklistAt('- Parent\n  - [x] Completed\n  - [ ] Pending', 'Parent'),
    ).toBe('- [ ] Parent\n  - [x] Completed\n  - [ ] Pending');
  });

  it('keeps them ticked when the list joins a checklist above it', () => {
    expect(
      toChecklistAt('- [x] before\n\n- Parent\n  - [x] Completed', 'Parent'),
    ).toBe('- [x] before\n- [ ] Parent\n  - [x] Completed');
  });
});
