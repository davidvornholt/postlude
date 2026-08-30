/**
 * The surface an entry is written on.
 *
 * Markdown is typed and set in place: `## ` becomes a heading as the space is
 * pressed, `**word**` becomes bold as the second star lands. There is no
 * preview pane and no toggle, because a journal is read on the page it is
 * written on, and a writer who has to switch modes to see what they wrote is
 * being asked to proofread rather than to write.
 *
 * What leaves this component is still markdown. The editor is a way of setting
 * the text, not a second format: the table holds the same characters an export
 * or an importer does, so the years already written in Obsidian and the years
 * written here are one corpus.
 *
 * The editor only ever exists in a browser. ProseMirror needs a live document
 * to attach to, so the server first renders safe semantic Markdown and the
 * editor takes over on hydration. The entry keeps its readable structure
 * before any of this loads and is never absent while it does.
 */

import { Placeholder } from '@tiptap/extensions';
import { EditorContent, useEditor } from '@tiptap/react';
import { useEffect, useRef } from 'react';

import {
  journalMarkdownExtensions,
  serializeJournalMarkdown,
} from '../journal-markdown.ts';
import { ReadOnlyMarkdown } from './read-only-markdown.tsx';

type MarkdownEditorProps = {
  /** Names the writing area, which carries no visible label of its own. */
  readonly label: string;
  /** The entry as it was loaded. Later changes are the editor's own. */
  readonly initialMarkdown: string;
  readonly onChange: (markdown: string) => void;
  /** Saves without waiting for the quiet period when the writer leaves. */
  readonly onLeave: () => void;
  readonly placeholder: string;
  /** The prose recipe plus whichever register this editor sits in. */
  readonly proseClass: string;
  readonly focusClass: string;
};

/**
 * The shape of the writing area, worn by the editor and by what stands in for
 * it before hydration alike. An empty day is mostly this: a tall area with a
 * rule under it, which is what says there is somewhere to write before there is
 * anything written. Both wear it so the page does not resize when ProseMirror
 * arrives and the read-only surface becomes an editor.
 */
const writingAreaClass = 'journal-writing min-h-48';

export const MarkdownEditor = ({
  label,
  initialMarkdown,
  onChange,
  onLeave,
  placeholder,
  proseClass,
  focusClass,
}: MarkdownEditorProps) => {
  // The handlers are read through refs because Tiptap binds them once, when
  // the editor is created. Passing them straight in would freeze the first
  // render's closures into the editor and post the draft as it was when the
  // page opened, every time.
  const changed = useRef(onChange);
  const left = useRef(onLeave);
  useEffect(() => {
    changed.current = onChange;
    left.current = onLeave;
  });

  const editor = useEditor({
    // ProseMirror has no document to mount into while the page is being
    // rendered on the server, so it waits for the browser.
    immediatelyRender: false,
    extensions: [
      ...journalMarkdownExtensions(),
      Placeholder.configure({ placeholder }),
    ],
    content: initialMarkdown,
    contentType: 'markdown',
    editorProps: {
      attributes: {
        'aria-label': label,
        'aria-multiline': 'true',
        class: [proseClass, focusClass, writingAreaClass].join(' '),
        role: 'textbox',
      },
      // Rich destinations still receive ProseMirror's HTML clipboard flavor.
      // Plain-text destinations receive the canonical Markdown rather than the
      // words stripped of the structure the writer entered.
      clipboardTextSerializer: (selection) =>
        serializeJournalMarkdown({
          content: selection.content.toJSON(),
          type: 'doc',
        }),
    },
    onUpdate: ({ editor: updated }) => changed.current(updated.getMarkdown()),
    onBlur: () => left.current(),
  });

  if (editor === null) {
    return (
      <ReadOnlyMarkdown
        className={[proseClass, writingAreaClass].join(' ')}
        markdown={initialMarkdown}
      />
    );
  }

  return <EditorContent editor={editor} />;
};
