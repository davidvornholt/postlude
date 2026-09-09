import type { Editor } from '@tiptap/react';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { focusRingClass, pageFrameClass } from '#/shared/ui/design-classes.ts';
import { type ActiveEditor, FormattingContext } from './formatting-context.ts';

const actions = [
  {
    label: 'Bold',
    mark: 'bold',
    run: (editor: Editor) => editor.chain().focus().toggleBold().run(),
  },
  {
    label: 'Italic',
    mark: 'italic',
    run: (editor: Editor) => editor.chain().focus().toggleItalic().run(),
  },
  {
    label: 'Heading',
    mark: 'heading',
    run: (editor: Editor) =>
      editor.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    label: 'Bullet list',
    mark: 'bulletList',
    run: (editor: Editor) => editor.chain().focus().toggleBulletList().run(),
  },
  {
    label: 'Numbered list',
    mark: 'orderedList',
    run: (editor: Editor) => editor.chain().focus().toggleOrderedList().run(),
  },
  {
    label: 'Quote',
    mark: 'blockquote',
    run: (editor: Editor) => editor.chain().focus().toggleBlockquote().run(),
  },
] as const;

const Toolbar = ({ active }: { readonly active: ActiveEditor }) => {
  const [, render] = useState(0);
  useEffect(() => {
    const update = () => render((revision) => revision + 1);
    active.editor.on('transaction', update);
    return () => {
      active.editor.off('transaction', update);
    };
  }, [active.editor]);
  return (
    <div
      data-formatting-toolbar=""
      className="fixed inset-x-0 top-0 z-30 border-border border-b bg-background text-ink"
    >
      <div className={`${pageFrameClass} flex items-center gap-3 py-2`}>
        <span className="sr-only">Formatting {active.label}</span>
        <fieldset
          aria-label={`Formatting ${active.label}`}
          className="flex min-w-0 gap-1 overflow-x-auto"
        >
          {actions.map((action) => (
            <button
              aria-pressed={active.editor.isActive(action.mark)}
              className={`${focusRingClass} min-h-11 shrink-0 px-3 text-sm aria-pressed:bg-ink aria-pressed:text-background`}
              disabled={!active.editor.isEditable}
              key={action.label}
              onClick={() => action.run(active.editor)}
              onMouseDown={(event) => event.preventDefault()}
              type="button"
            >
              {action.label}
            </button>
          ))}
          <button
            className={`${focusRingClass} min-h-11 shrink-0 px-3 text-sm underline underline-offset-4`}
            disabled={!active.editor.isEditable}
            onClick={active.addImage}
            onMouseDown={(event) => event.preventDefault()}
            type="button"
          >
            Add image
          </button>
        </fieldset>
      </div>
    </div>
  );
};

export const FormattingToolbarProvider = ({
  children,
}: {
  readonly children: ReactNode;
}) => {
  const [active, setActive] = useState<ActiveEditor>();
  const activate = useCallback((value: ActiveEditor) => setActive(value), []);
  return (
    <FormattingContext value={activate}>
      {children}
      {active && !active.editor.isDestroyed ? (
        <Toolbar active={active} />
      ) : null}
    </FormattingContext>
  );
};
