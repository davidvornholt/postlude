import { useId, useRef } from 'react';

import { focusRingClass } from '#/shared/ui/design-classes.ts';
import { JournalIconButton } from './journal-icon-button.tsx';

type ImageViewerProps = { readonly src: string; readonly alt: string };

/** Native dialog supplies focus containment, Escape, and focus restoration. */
export const ImageViewer = ({ src, alt }: ImageViewerProps) => {
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        aria-label={`Enlarge image${alt ? `: ${alt}` : ''}`}
        className={`${focusRingClass} block min-h-11 min-w-11 max-w-full cursor-zoom-in`}
        onClick={() => dialog.current?.showModal()}
        ref={trigger}
        type="button"
      >
        <img alt={alt} loading="lazy" src={src} />
      </button>
      <dialog
        aria-labelledby={title}
        className="journal-image-dialog m-auto max-h-[94dvh] w-[min(96vw,90rem)] border border-border bg-background p-4 text-ink backdrop:bg-ink/70"
        ref={dialog}
        onClose={() => trigger.current?.focus()}
      >
        <div className="flex items-center justify-between gap-6 pb-3">
          <p className="text-sm" id={title}>
            {alt || 'Image'}
          </p>
          <JournalIconButton
            icon="close"
            label="Close image"
            hintAlign="end"
            hint="Esc"
            onClick={() => dialog.current?.close()}
          />
        </div>
        <img
          alt={alt}
          className="m-auto max-h-[76dvh] w-auto max-w-full object-contain"
          src={src}
        />
      </dialog>
    </>
  );
};
