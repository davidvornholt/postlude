import { expect, it } from 'bun:test';
import { Effect } from 'effect';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  imageExtension,
  imageKeyOf,
  imageRoute,
  maximumImageBytes,
} from './images.ts';
import {
  parseJournalMarkdown,
  serializeJournalMarkdown,
} from './journal-markdown.ts';
import { journalImageKeys } from './services/export-images.ts';
import { readImageUpload } from './services/image-response.ts';
import { JournalImages } from './services/journal-images.ts';
import { ReadOnlyMarkdown } from './ui/read-only-markdown.tsx';

const key = '12345678-1234-4234-8234-123456789abc.png';
const src = `${imageRoute}${key}`;

it('round-trips image descriptions and only renders private image addresses', () => {
  const alt = 'A [lake] with \\ reeds';
  const markdown = serializeJournalMarkdown({
    type: 'doc',
    content: [{ type: 'image', attrs: { src, alt } }],
  });
  const document = parseJournalMarkdown(markdown);
  expect(document.content?.[0]?.attrs).toMatchObject({ src, alt });
  expect(journalImageKeys(`${markdown}\n\n${markdown}`)).toEqual([key]);
  expect(
    journalImageKeys(`\`${src}\`\n\n![remote](https://example.com/a.png)`),
  ).toEqual([]);
  const html = renderToStaticMarkup(
    <ReadOnlyMarkdown className="journal-prose" markdown={markdown} />,
  );
  expect(html).toContain(`src="${src}"`);
  for (const source of [
    'https://example.com/a.png',
    '//example.com/a.png',
    'data:image/png;base64,a',
    `${src}?key=other`,
    '/api/journal-images/../secret',
    `${imageRoute}another-bucket/file.png`,
  ]) {
    expect(imageKeyOf(source)).toBeUndefined();
    const unsafe = renderToStaticMarkup(
      <ReadOnlyMarkdown
        className="journal-prose"
        markdown={`![Photo](${source})`}
      />,
    );
    expect(unsafe).not.toContain('<img');
  }
});

it('validates image bytes independently of browser content types', async () => {
  expect(
    imageExtension(new TextEncoder().encode('<svg onload="alert(1)"></svg>')),
  ).toBeUndefined();
  expect(
    imageExtension(
      Uint8Array.from(atob('/9j/'), (character) => character.charCodeAt(0)),
    ),
  ).toBe('jpg');
  expect(imageExtension(new TextEncoder().encode('GIF89a'))).toBe('gif');
  expect(imageExtension(new TextEncoder().encode('RIFF0000WEBP'))).toBe('webp');
  for (const bytes of [
    new Uint8Array(),
    new Uint8Array(maximumImageBytes + 1),
    new TextEncoder().encode('<html>'),
  ]) {
    // biome-ignore lint/performance/noAwaitInLoops: Each validation probe allocates up to the upload limit; run them one at a time.
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const images = yield* JournalImages;
        return yield* images.upload(bytes).pipe(Effect.either);
      }).pipe(Effect.provide(JournalImages.Default)),
    );
    expect(result._tag).toBe('Left');
    expect(result).toMatchObject({
      _tag: 'Left',
      left: { _tag: 'JournalValidationError' },
    });
  }
});

it('rejects cross-origin uploads and bounds chunked bodies before buffering', async () => {
  const url = 'https://journal.example/api/journal-images/';
  const headers = {
    origin: 'https://journal.example',
    'x-postlude-image-upload': 'true',
  };
  const bytes = Uint8Array.from(atob('/9j/'), (character) =>
    character.charCodeAt(0),
  );
  expect(
    await Effect.runPromise(
      readImageUpload(
        new Request(url, { method: 'POST', headers, body: bytes }),
        headers.origin,
      ),
    ),
  ).toEqual(bytes);
  for (const origin of ['https://evil.example', 'null', '']) {
    // biome-ignore lint/performance/noAwaitInLoops: Each validation probe allocates up to the upload limit; run them one at a time.
    const result = await Effect.runPromise(
      readImageUpload(
        new Request(url, {
          method: 'POST',
          headers: { ...headers, origin },
          body: bytes,
        }),
        headers.origin,
      ).pipe(Effect.either),
    );
    expect(result._tag).toBe('Left');
  }
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    pull: (controller) =>
      controller.enqueue(new Uint8Array(maximumImageBytes + 1)),
    cancel: () => {
      cancelled = true;
    },
  });
  const result = await Effect.runPromise(
    readImageUpload(
      new Request(url, { method: 'POST', headers, body }),
      headers.origin,
    ).pipe(Effect.either),
  );
  expect(result._tag).toBe('Left');
  expect(cancelled).toBeTrue();
});
