import type { Editor } from '@tiptap/react';
import { type RefObject, useId } from 'react';

import { focusRingClass } from '#/shared/ui/design-classes.ts';
import { acceptedImageTypes } from '../images.ts';
import { JournalIconButton } from './journal-icon-button.tsx';
import { useImageUpload } from './use-image-upload.ts';

type ImageUploadControlProps = {
  readonly editor: Editor;
  readonly focusClass: string;
  readonly label: string;
  readonly pasteImages: RefObject<(files: ReadonlyArray<File>) => void>;
};

export const ImageUploadControl = ({
  editor,
  focusClass,
  label,
  pasteImages,
}: ImageUploadControlProps) => {
  const image = useImageUpload(editor, label);
  const descriptionId = useId();
  const fileId = useId();
  const titleId = useId();
  pasteImages.current = (files) => {
    image.upload(files, '').catch(() => undefined);
  };
  const status = image.busy
    ? 'Keep this page open while the image uploads.'
    : image.error;
  return (
    <div className="mt-3 text-sm">
      <JournalIconButton
        className={focusClass}
        icon="image"
        label={`Add image to ${label}`}
        onClick={image.addImage}
      />
      {image.open ? (
        <dialog
          aria-labelledby={titleId}
          className="m-auto max-h-[calc(100dvh_-_2rem)] w-[calc(100%_-_2rem)] max-w-lg border border-border bg-background p-6 text-ink backdrop:bg-ink/50"
          onCancel={(event) => {
            if (image.busy) {
              event.preventDefault();
            }
          }}
          onClose={image.cancel}
          ref={image.dialog}
        >
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl" id={titleId}>
                Add image
              </h2>
              <p className="mt-1 text-ink-muted text-sm">
                At your cursor in {label.toLowerCase()}.
              </p>
            </div>
            <JournalIconButton
              icon="close"
              label="Cancel image upload"
              hintAlign="end"
              hint="Esc"
              disabled={image.busy}
              onClick={image.cancel}
            />
          </div>
          <form
            aria-label={`Add image to ${label}`}
            className="space-y-5"
            onSubmit={async (event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              const file = data.get('image');
              if (file instanceof File) {
                await image.upload(
                  [file],
                  String(data.get('description') ?? ''),
                );
              }
            }}
          >
            <div>
              <label className="block" htmlFor={fileId}>
                Image file
              </label>
              <input
                accept={acceptedImageTypes}
                className={`${focusRingClass} my-2 block min-h-11 w-full max-w-full border border-border p-2`}
                disabled={image.busy}
                id={fileId}
                name="image"
                required={true}
                type="file"
              />
              <p className="text-ink-muted text-xs">
                JPEG, PNG, GIF, or WebP, up to 10 MiB.
              </p>
            </div>
            <div>
              <label className="block" htmlFor={descriptionId}>
                Image description (optional)
              </label>
              <input
                className={`${focusRingClass} mt-2 min-h-11 w-full border border-border bg-transparent px-3`}
                disabled={image.busy}
                id={descriptionId}
                name="description"
                type="text"
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                className={`${focusRingClass} min-h-11 bg-primary px-4 font-medium text-on-primary disabled:opacity-60`}
                disabled={image.busy}
                type="submit"
              >
                {image.busy ? 'Uploading image…' : 'Insert image'}
              </button>
              <button
                className={`${focusRingClass} min-h-11 px-3`}
                disabled={image.busy}
                onClick={image.cancel}
                type="button"
              >
                Cancel
              </button>
            </div>
            <p aria-live="polite" role="status">
              {status}
            </p>
          </form>
        </dialog>
      ) : null}
      {!image.open && status ? (
        <p className="mt-2" aria-live="polite" role="status">
          {status}
        </p>
      ) : null}
    </div>
  );
};
