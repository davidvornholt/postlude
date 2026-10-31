import { JournalImage } from '../journal-image-extension.ts';
import { journalLanguage } from '../journal-language.ts';
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

import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import {
  type Editor,
  EditorContent,
  ReactNodeViewRenderer,
  useEditor,
  useEditorState,
} from '@tiptap/react';
import {
  type Ref,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
} from 'react';

import {
  journalMarkdownExtensions,
  serializeJournalMarkdown,
} from '../journal-markdown.ts';
import { ImageNodeView } from './image-node-view.tsx';
import { ImageUploadControl } from './image-upload-control.tsx';
import { ReadOnlyMarkdown } from './read-only-markdown.tsx';

/** What the page may ask of an editor from outside it. */
export type EditorFocus = {
  /** Puts the caret after the last word, scrolled into view. */
  readonly focusEnd: () => void;
};

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
  /**
   * The prompt an empty area shows. It is English while the writing is marked
   * German, so it stands beside the editor rather than inside it, where it
   * would be read and hyphenated as German.
   */
  readonly placeholder: string;
  /** The prose recipe plus whichever register this editor sits in. */
  readonly proseClass: string;
  readonly focusClass: string;
  /**
   * How much room an empty area offers. The evening is where most of a day is
   * written; morning notes are a few lines, and an empty notes area should not
   * push the evening down the page.
   */
  readonly size: 'entry' | 'notes';
  readonly focusHandle?: Ref<EditorFocus>;
};

/**
 * The shape of the writing area, worn by the editor and by what stands in for
 * it before hydration alike. An empty day is mostly this: a tall area with a
 * rule under it, which is what says there is somewhere to write before there is
 * anything written. Both wear it so the page does not resize when ProseMirror
 * arrives and the read-only surface becomes an editor.
 *
 * Spaces wrap as they do in any paragraph: ProseMirror's own `break-spaces` lets
 * the space before a word that no longer fits begin the next line, which leaves
 * a ragged left edge every few lines of a long entry. Its stylesheet is injected
 * outside the cascade layers, so only an important utility can override it.
 */
const writingAreaClass =
  'cursor-text scroll-mt-24 whitespace-pre-wrap! border-(--journal-rule) border-b pb-6 text-lg leading-7 transition-colors duration-150 ease-standard hover:border-(--journal-quiet) motion-reduce:transition-none';

const sizeClass = {
  entry: 'min-h-48',
  notes: 'min-h-16',
} as const;

/** Set over the first line of the area, in the type that line is written in. */
const promptClass =
  'pointer-events-none absolute inset-x-0 top-0 text-(--journal-prompt) text-lg italic leading-7';

/**
 * An area holding nothing but the one empty paragraph a blank document has. A
 * writer who has begun with a heading or a picture needs no prompt.
 */
const isBlank = (doc: ProseMirrorNode): boolean =>
  doc.childCount === 1 &&
  doc.firstChild?.type.name === 'paragraph' &&
  doc.firstChild.childCount === 0;

// Tiptap builds its document once, from the first markdown it was given, and
// later options never replace it. The autosave's draft can still change
// without the writer typing: hydration starts from the server's copy and then
// takes the draft this tab kept from a failed save, and a newer server
// revision replaces a draft with no unsaved edits. The editor follows such a
// change before the writer can type, because the next keystroke saves the
// editor's whole document over the draft. It stays out of the undo history,
// since the writer did not make it.
const useFollowedMarkdown = (editor: Editor | null, markdown: string) => {
  useLayoutEffect(() => {
    if (
      editor === null ||
      editor.isDestroyed ||
      editor.getMarkdown() === markdown
    ) {
      return;
    }
    editor
      .chain()
      .setMeta('addToHistory', false)
      .setContent(markdown, {
        contentType: 'markdown',
        emitUpdate: false,
      })
      .run();
  }, [editor, markdown]);
};

/**
 * The prompt over an empty area. It is hidden from reading, since it sits
 * beside the area rather than in it, and reaches a screen reader as the empty
 * area's description instead.
 */
const WritingPrompt = ({
  editor,
  id,
  initialMarkdown,
  proseClass,
  text,
}: {
  readonly editor: Editor | null;
  readonly id: string;
  readonly initialMarkdown: string;
  readonly proseClass: string;
  readonly text: string;
}) => {
  const blank = useEditorState({
    editor,
    selector: ({ editor: current }) =>
      current === null
        ? initialMarkdown.trim() === ''
        : isBlank(current.state.doc),
  });
  return blank ? (
    <p
      aria-hidden="true"
      className={[proseClass, promptClass].join(' ')}
      id={id}
    >
      {text}
    </p>
  ) : null;
};

/**
 * The room ProseMirror keeps between the caret and the edges of the window when
 * it scrolls to follow typing or arrow keys. The formatting toolbar is pinned
 * to the top of the window over the writing, so the top keeps clear of it: the
 * same 6rem as `scroll-mt-24`, which clears the toolbar with a line to spare.
 * The bottom keeps a line or so of air below the line being typed.
 */
const caretClearance = { top: 96, right: 0, bottom: 48, left: 0 };

export const MarkdownEditor = ({
  label,
  initialMarkdown,
  onChange,
  onLeave,
  placeholder,
  proseClass,
  focusClass,
  size,
  focusHandle,
}: MarkdownEditorProps) => {
  const areaClass = [proseClass, writingAreaClass, sizeClass[size]].join(' ');
  const promptId = useId();
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
      attributes: (state) => ({
        'aria-label': label,
        'aria-multiline': 'true',
        class: [areaClass, focusClass].join(' '),
        lang: journalLanguage,
        role: 'textbox',
        ...(isBlank(state.doc) ? { 'aria-describedby': promptId } : {}),
      }),
      scrollMargin: caretClearance,
      scrollThreshold: caretClearance,
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

  useImperativeHandle(
    focusHandle,
    () => ({
      focusEnd: () => {
        if (editor !== null && !editor.isDestroyed) {
          editor.commands.focus('end');
        }
      },
    }),
    [editor],
  );

  useFollowedMarkdown(editor, initialMarkdown);

  const prompt = (
    <WritingPrompt
      editor={editor}
      id={promptId}
      initialMarkdown={initialMarkdown}
      proseClass={proseClass}
      text={placeholder}
    />
  );

  if (editor === null) {
    return (
      <div className="relative">
        <ReadOnlyMarkdown className={areaClass} markdown={initialMarkdown} />
        {prompt}
      </div>
    );
  }

  return (
    <>
      <div className="relative">
        <EditorContent editor={editor} />
        {prompt}
      </div>
      <ImageUploadControl
        editor={editor}
        label={label}
        pasteImages={pasteImagesRef}
      />
    </>
  );
};
