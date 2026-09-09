import type { Editor } from '@tiptap/react';
import { type RefObject, useId } from 'react';

import { acceptedImageTypes } from '../images.ts';
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
  const buttonClass = `${focusClass} min-h-11 px-2 underline underline-offset-4 disabled:opacity-60`;
  pasteImages.current = (files) => {
    image.upload(files, '').catch(() => undefined);
  };
  const status = image.busy
    ? 'Keep this page open while the image uploads.'
    : image.error;
  return (
    <div className="mt-3 text-sm">
      {image.open ? (
        <form
          aria-label={`Add image to ${label}`}
          className="space-y-3"
          ref={image.form}
          onSubmit={async (event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const file = data.get('image');
            if (file instanceof File) {
              await image.upload([file], String(data.get('description') ?? ''));
            }
          }}
        >
          <div>
            <label className="block" htmlFor={fileId}>
              Image file
            </label>
            <input
              accept={acceptedImageTypes}
              className={`${focusClass} mt-1 block min-h-11 max-w-full`}
              disabled={image.busy}
              id={fileId}
              name="image"
              required={true}
              type="file"
            />
            <p>JPEG, PNG, GIF, or WebP, up to 10 MiB.</p>
          </div>
          <div>
            <label className="block" htmlFor={descriptionId}>
              Image description (optional)
            </label>
            <input
              className={`${focusClass} mt-1 min-h-11 w-full border-current border-b bg-transparent`}
              disabled={image.busy}
              id={descriptionId}
              name="description"
              type="text"
            />
          </div>
          <div className="flex gap-3">
            <button className={buttonClass} disabled={image.busy} type="submit">
              {image.busy ? 'Uploading image…' : 'Insert image'}
            </button>
            <button
              className={buttonClass}
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
      ) : (
        <button
          aria-label={`Add image to ${label}`}
          className={buttonClass}
          onClick={image.addImage}
          type="button"
        >
          Add image
        </button>
      )}
    </div>
  );
};
