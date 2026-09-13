import type { Selection } from '@tiptap/pm/state';
import type { Editor } from '@tiptap/react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { uploadJournalImage } from '../upload-image.ts';
import { useFormattingToolbar } from './formatting-context.ts';

export const useImageUpload = (editor: Editor, label: string) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const requestRef = useRef<AbortController | undefined>(undefined);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formatting = useFormattingToolbar();
  const activate = formatting?.activate;
  const focusToolbar = formatting?.focusToolbar;
  const addImage = useCallback(() => setOpen(true), []);
  useEffect(() => {
    const { current } = dialogRef;
    if (open) {
      current?.showModal();
      current?.querySelector('input')?.focus();
    }
    return () => current?.close();
  }, [open]);
  useEffect(() => {
    const focused = () => activate?.({ editor, label, addImage });
    editor.on('focus', focused);
    const shortcut = (event: KeyboardEvent) => {
      if (event.altKey && event.key === 'F10') {
        event.preventDefault();
        focused();
        focusToolbar?.();
      }
    };
    editor.view.dom.addEventListener('keydown', shortcut);
    return () => {
      editor.off('focus', focused);
      editor.view.dom.removeEventListener('keydown', shortcut);
    };
  }, [activate, editor, label, addImage, focusToolbar]);
  useEffect(() => () => requestRef.current?.abort(), []);

  const insert = async (
    file: File,
    description: string,
    signal: AbortSignal,
    selection: Selection,
  ) => {
    const result = await uploadJournalImage(file, signal);
    if (signal.aborted || editor.isDestroyed) {
      return false;
    }
    if ('error' in result) {
      setError(result.error);
      return false;
    }
    // setEditable is restored after the batch; commands still transact while input is locked.
    const inserted = editor
      .chain()
      .focus()
      .command(({ tr }) => {
        tr.setSelection(selection);
        return true;
      })
      .setImage({ src: result.src, alt: description.trim() })
      .createParagraphNear()
      .run();
    if (!inserted) {
      setError('Place the cursor in a paragraph and try again.');
    }
    return inserted;
  };
  const upload = async (files: ReadonlyArray<File>, description: string) => {
    if (requestRef.current !== undefined) {
      return;
    }
    const controller = new AbortController();
    requestRef.current = controller;
    setBusy(true);
    setError('');
    // Locking input still permits selection changes; keep the insertion point for the batch.
    let { selection } = editor.state;
    editor.setEditable(false);
    try {
      for (const file of files) {
        // biome-ignore lint/performance/noAwaitInLoops: Preserve clipboard order and bound memory to one upload.
        if (!(await insert(file, description, controller.signal, selection))) {
          return;
        }
        ({ selection } = editor.state);
      }
      setOpen(false);
    } catch {
      setError('The image could not be inserted. Try again.');
    } finally {
      requestRef.current = undefined;
      if (!editor.isDestroyed) {
        editor.setEditable(true);
      }
      if (!controller.signal.aborted) {
        setBusy(false);
      }
    }
  };
  const cancel = () => {
    dialogRef.current?.close();
    setOpen(false);
    setError('');
    if (!editor.isDestroyed) {
      // Restore focus during dismissal; a delayed close event may follow a switch of sections.
      editor.view.focus();
      editor.commands.scrollIntoView();
    }
  };
  return { open, busy, error, dialog: dialogRef, upload, cancel };
};
