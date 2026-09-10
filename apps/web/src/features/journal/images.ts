/** The only image URLs the journal renders or reads from storage. */
export const imageRoute = '/api/journal-images/';
const imageKeyPattern =
  /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}\.(?:jpg|png|gif|webp)$/u;
export const maximumImageBytes = 10_485_760;
export const acceptedImageTypes = 'image/jpeg,image/png,image/gif,image/webp';

export const isImageKey = (key: string): boolean => imageKeyPattern.test(key);

export const imageKeyOf = (source: unknown): string | undefined => {
  if (typeof source !== 'string' || !source.startsWith(imageRoute)) {
    return undefined;
  }
  const key = source.slice(imageRoute.length);
  return isImageKey(key) ? key : undefined;
};

export const imageContentType = (key: string): string => {
  if (key.endsWith('.jpg')) {
    return 'image/jpeg';
  }
  if (key.endsWith('.png')) {
    return 'image/png';
  }
  if (key.endsWith('.gif')) {
    return 'image/gif';
  }
  return 'image/webp';
};

// biome-ignore lint/style/noMagicNumbers: JPEG file signature bytes are one protocol constant.
const jpegSignature = [0xff, 0xd8, 0xff];
// biome-ignore lint/style/noMagicNumbers: PNG file signature bytes are one protocol constant.
const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const headerLength = 12;
const webpMarkerOffset = 8;

/** Sniff bytes, never the filename or the browser-supplied Content-Type. */
export const imageExtension = (bytes: Uint8Array): string | undefined => {
  const startsWith = (signature: ReadonlyArray<number>) =>
    signature.every((value, index) => bytes[index] === value);
  if (startsWith(jpegSignature)) {
    return 'jpg';
  }
  if (startsWith(pngSignature)) {
    return 'png';
  }
  const text = new TextDecoder('ascii').decode(bytes.subarray(0, headerLength));
  if (text.startsWith('GIF87a') || text.startsWith('GIF89a')) {
    return 'gif';
  }
  if (
    text.startsWith('RIFF') &&
    text.slice(webpMarkerOffset, headerLength) === 'WEBP'
  ) {
    return 'webp';
  }
  return undefined;
};
