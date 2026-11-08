import { ImagePlus } from 'lucide-react';
import {
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { formattingActions } from './formatting-actions.ts';
import {
  type ActiveEditor,
  FormattingContext,
  useFormattingToolbar,
} from './formatting-context.ts';
import { JournalIconButton, type WritingTone } from './journal-icon-button.tsx';

const navigateToolbar = (
  event: KeyboardEvent<HTMLElement>,
  active: ActiveEditor | undefined,
) => {
  if (event.key === 'Escape') {
    event.preventDefault();
    if (active && !active.editor.isDestroyed) {
      // Tiptap focuses twice on mobile; avoid a delayed focus stealing a quick Alt+F10 return.
      active.editor.view.focus();
      active.editor.commands.scrollIntoView();
    }
    return;
  }
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
    return;
  }
  event.preventDefault();
  const buttons = Array.from(
    event.currentTarget
      .closest('[role="toolbar"]')
      ?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [],
  );
  const current = buttons.indexOf(event.target as HTMLButtonElement);
  let next = event.key === 'ArrowLeft' ? current - 1 : current + 1;
  if (event.key === 'Home') {
    next = 0;
  }
  if (event.key === 'End') {
    next = buttons.length - 1;
  }
  buttons[(next + buttons.length) % buttons.length]?.focus();
};

/**
 * The formatting tools for one writing area. They sit in that area's section
 * bar (`writing-section.tsx`) and act only on its editor, which takes them
 * over as soon as it is on the page, so the tools are never disabled while
 * there is something to write in.
 */
export const FormattingToolbar = ({ tone }: { readonly tone: WritingTone }) => {
  const context = useFormattingToolbar();
  const active = context?.active;
  const [, render] = useState(0);
  const [focused, setFocused] = useState('Bold');
  useEffect(() => {
    const update = () => render((revision) => revision + 1);
    active?.editor.on('transaction', update);
    return () => {
      active?.editor.off('transaction', update);
    };
  }, [active]);
  const disabled = !active?.editor.isEditable || active.editor.isDestroyed;
  return (
    <div
      aria-label={active ? `Formatting ${active.label}` : 'Formatting'}
      className="flex min-w-0 items-center justify-between sm:w-88"
      data-toolbar-actions=""
      role="toolbar"
    >
      {formattingActions.map((action) => (
        <JournalIconButton
          aria-pressed={active?.editor.isActive(action.mark) ?? false}
          divider={action.mark === 'bulletList'}
          inToolbar={true}
          hintAlign={
            ['bold', 'italic', 'heading'].includes(action.mark)
              ? 'start'
              : 'end'
          }
          disabled={disabled}
          hint={action.hint}
          icon={action.icon}
          key={action.label}
          label={action.label}
          onClick={(event) => {
            if (active && !disabled) {
              const chain = active.editor.chain();
              action.run(
                event.detail === 0
                  ? chain
                  : chain.focus(undefined, { scrollIntoView: false }),
              );
            }
          }}
          onKeyDown={(event) => navigateToolbar(event, active)}
          onFocus={() => setFocused(action.label)}
          onMouseDown={(event) => event.preventDefault()}
          tabIndex={focused === action.label ? 0 : -1}
          tone={tone}
        />
      ))}
      <JournalIconButton
        divider={true}
        inToolbar={true}
        hintAlign="end"
        disabled={disabled}
        hint="Or paste a photo"
        icon={ImagePlus}
        label="Add image"
        onClick={active?.addImage}
        onKeyDown={(event) => navigateToolbar(event, active)}
        onFocus={() => setFocused('Add image')}
        onMouseDown={(event) => event.preventDefault()}
        tabIndex={focused === 'Add image' ? 0 : -1}
        tone={tone}
      />
    </div>
  );
};

export const FormattingToolbarProvider = ({
  children,
}: {
  readonly children: ReactNode;
}) => {
  const [active, setActive] = useState<ActiveEditor>();
  const containerRef = useRef<HTMLDivElement>(null);
  const activate = useCallback((value: ActiveEditor) => setActive(value), []);
  const focusToolbar = useCallback(() => {
    containerRef.current
      ?.querySelector('[data-toolbar-actions]')
      ?.querySelector<HTMLButtonElement>('button[tabindex="0"]')
      ?.focus();
  }, []);
  return (
    <FormattingContext value={{ active, activate, focusToolbar }}>
      <div ref={containerRef}>{children}</div>
    </FormattingContext>
  );
};
