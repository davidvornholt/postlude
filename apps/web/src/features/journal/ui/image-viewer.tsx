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
        className={`${focusRingClass} journal-image-button`}
        onClick={() => dialog.current?.showModal()}
        ref={trigger}
        type="button"
      >
        <img alt={alt} loading="lazy" src={src} />
      </button>
      <dialog
        aria-labelledby={title}
        className="journal-image-dialog bg-background text-ink"
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
            hint="Esc"
            onClick={() => dialog.current?.close()}
          />
        </div>
        <img alt={alt} src={src} />
      </dialog>
    </>
  );
};
