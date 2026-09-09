import type { Editor } from '@tiptap/react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { uploadJournalImage } from '../upload-image.ts';
import { useFormattingToolbar } from './formatting-context.ts';

export const useImageUpload = (editor: Editor, label: string) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const request = useRef<AbortController | undefined>(undefined);
  const form = useRef<HTMLFormElement>(null);
  const activate = useFormattingToolbar();
  const addImage = useCallback(() => {
    setOpen(true);
    requestAnimationFrame(() =>
      form.current?.scrollIntoView({ block: 'center' }),
    );
  }, []);
  useEffect(() => {
    const focused = () => activate?.({ editor, label, addImage });
    editor.on('focus', focused);
    return () => {
      editor.off('focus', focused);
    };
  }, [activate, editor, label, addImage]);
  useEffect(() => () => request.current?.abort(), []);

  const insert = async (
    file: File,
    description: string,
    signal: AbortSignal,
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
      .setImage({ src: result.src, alt: description.trim() })
      .createParagraphNear()
      .run();
    if (!inserted) {
      setError('Place the cursor in a paragraph and try again.');
    }
    return inserted;
  };
  const upload = async (files: ReadonlyArray<File>, description: string) => {
    if (request.current !== undefined) {
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    setOpen(true);
    setBusy(true);
    setError('');
    editor.setEditable(false);
    try {
      for (const file of files) {
        // biome-ignore lint/performance/noAwaitInLoops: Preserve clipboard order and bound memory to one upload.
        if (!(await insert(file, description, controller.signal))) {
          return;
        }
      }
      setOpen(false);
    } catch {
      setError('The image could not be inserted. Try again.');
    } finally {
      request.current = undefined;
      if (!editor.isDestroyed) {
        editor.setEditable(true);
      }
      if (!controller.signal.aborted) {
        setBusy(false);
      }
    }
  };
  const cancel = () => {
    setOpen(false);
    setError('');
    editor.commands.focus();
  };
  return { open, busy, error, form, addImage, upload, cancel };
};
