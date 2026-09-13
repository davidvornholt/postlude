import { useId, useRef } from 'react';

import { focusRingClass } from '#/shared/ui/design-classes.ts';
import { JournalIconButton } from './journal-icon-button.tsx';

type ImageViewerProps = { readonly src: string; readonly alt: string };

/** Native dialog supplies focus containment, Escape, and focus restoration. */
export const ImageViewer = ({ src, alt }: ImageViewerProps) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        aria-label={`Enlarge image${alt ? `: ${alt}` : ''}`}
        className={`${focusRingClass} block min-h-11 min-w-11 max-w-full cursor-zoom-in`}
        onClick={() => dialogRef.current?.showModal()}
        ref={triggerRef}
        type="button"
      >
        <img alt={alt} loading="lazy" src={src} />
      </button>
      <dialog
        aria-labelledby={titleId}
        className="journal-image-dialog m-auto max-h-[94dvh] w-[min(96vw,90rem)] border border-border bg-background p-4 text-ink backdrop:bg-ink/70"
        ref={dialogRef}
        onClose={() => triggerRef.current?.focus()}
      >
        <div className="flex items-center justify-between gap-6 pb-3">
          <p className="text-sm" id={titleId}>
            {alt || 'Image'}
          </p>
          <JournalIconButton
            icon="close"
            label="Close image"
            hintAlign="end"
            hint="Esc"
            onClick={() => dialogRef.current?.close()}
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
