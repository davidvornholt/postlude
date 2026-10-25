import { Placeholder } from '@tiptap/extensions';
import { EditorContent, ReactNodeViewRenderer, useEditor } from '@tiptap/react';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { JournalImage } from '../journal-image-extension.ts';

import {
  journalMarkdownExtensions,
  serializeJournalMarkdown,
} from '../journal-markdown.ts';
import { ImageNodeView } from './image-node-view.tsx';
import { ImageUploadControl } from './image-upload-control.tsx';
import { ReadOnlyMarkdown } from './read-only-markdown.tsx';

type MarkdownEditorProps = {
  /** Names the writing area, which carries no visible label of its own. */
  readonly label: string;
  /**
   * The entry as the autosave holds it. The editor's own edits come back here
   * unchanged; any other change replaces what the editor shows.
   */
  readonly initialMarkdown: string;
  readonly onChange: (markdown: string) => void;
  /** Saves without waiting for the quiet period when the writer leaves. */
  readonly onLeave: () => void;
  readonly placeholder: string;
  /** The prose recipe plus whichever register this editor sits in. */
  readonly proseClass: string;
  readonly focusClass: string;
};

/** Share dimensions with the server-rendered fallback to prevent a layout shift during hydration. */
const writingAreaClass =
  'min-h-48 cursor-text scroll-mt-24 border-(--journal-rule) border-b pb-6 transition-colors duration-150 ease-standard hover:border-(--journal-quiet) motion-reduce:transition-none';

export const MarkdownEditor = ({
  label,
  initialMarkdown,
  onChange,
  onLeave,
  placeholder,
  proseClass,
  focusClass,
}: MarkdownEditorProps) => {
  const changedRef = useRef(onChange);
  const leftRef = useRef(onLeave);
  const pasteImagesRef = useRef<(files: ReadonlyArray<File>) => void>(
    () => undefined,
  );
  useEffect(() => {
    changedRef.current = onChange;
    leftRef.current = onLeave;
  });

  const editor = useEditor({
    // ProseMirror has no document to mount into while the page is being
    // rendered on the server, so it waits for the browser.
    immediatelyRender: false,
    extensions: [
      ...journalMarkdownExtensions().map((extension) =>
        extension.name === 'image'
          ? JournalImage.extend({
              addNodeView: () => ReactNodeViewRenderer(ImageNodeView),
            })
          : extension,
      ),
      Placeholder.configure({ placeholder }),
    ],
    content: initialMarkdown,
    contentType: 'markdown',
    editorProps: {
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []).filter(
          (file) => file.type.startsWith('image/'),
        );
        if (files.length === 0) {
          return false;
        }
        event.preventDefault();
        pasteImagesRef.current(files);
        return true;
      },
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
    onUpdate: ({ editor: updated }) =>
      changedRef.current(updated.getMarkdown()),
    onBlur: () => leftRef.current(),
  });

  // Tiptap builds its document once, from the first markdown it was given, and
  // later options never replace it. The autosave's draft can still change
  // without the writer typing: hydration starts from the server's copy and then
  // takes the draft this tab kept from a failed save, and a newer server
  // revision replaces a draft with no unsaved edits. The editor follows such a
  // change before the writer can type, because the next keystroke saves the
  // editor's whole document over the draft. It stays out of the undo history,
  // since the writer did not make it.
  useLayoutEffect(() => {
    if (
      editor === null ||
      editor.isDestroyed ||
      editor.getMarkdown() === initialMarkdown
    ) {
      return;
    }
    editor
      .chain()
      .setMeta('addToHistory', false)
      .setContent(initialMarkdown, {
        contentType: 'markdown',
        emitUpdate: false,
      })
      .run();
  }, [editor, initialMarkdown]);

  if (editor === null) {
    return (
      <ReadOnlyMarkdown
        className={[proseClass, writingAreaClass].join(' ')}
        markdown={initialMarkdown}
      />
    );
  }

  return (
    <>
      <EditorContent editor={editor} />
      <ImageUploadControl
        editor={editor}
        label={label}
        pasteImages={pasteImagesRef}
      />
    </>
  );
};
