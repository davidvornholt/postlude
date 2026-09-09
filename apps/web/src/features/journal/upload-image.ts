import { imageKeyOf, imageRoute, maximumImageBytes } from './images.ts';

const unauthorized = 401;
type UploadResult = { readonly src: string } | { readonly error: string };

export const uploadJournalImage = async (
  file: File,
  signal: AbortSignal,
): Promise<UploadResult> => {
  if (file.size === 0 || file.size > maximumImageBytes) {
    return { error: 'Choose a JPEG, PNG, GIF, or WebP image up to 10 MiB.' };
  }
  try {
    const response = await fetch(imageRoute, {
      method: 'POST',
      body: file,
      signal,
      headers: { 'x-postlude-image-upload': 'true', 'x-tsr-serverFn': 'true' },
    });
    if (!response.ok) {
      return {
        error:
          response.status === unauthorized
            ? 'Sign in again, then try adding the image.'
            : 'The image could not be uploaded. Choose a JPEG, PNG, GIF, or WebP up to 10 MiB and try again.',
      };
    }
    const result: unknown = await response.json();
    if (
      typeof result !== 'object' ||
      result === null ||
      !('src' in result) ||
      typeof result.src !== 'string' ||
      imageKeyOf(result.src) === undefined
    ) {
      return { error: 'The image could not be uploaded. Try again.' };
    }
    return { src: result.src };
  } catch {
    return {
      error:
        'The image could not be uploaded. Check your connection and try again.',
    };
  }
};
