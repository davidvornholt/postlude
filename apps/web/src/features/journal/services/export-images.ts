import type { JSONContent } from '@tiptap/core';
import { Effect } from 'effect';

import type { ExportEntry } from '../export-format.ts';
import { imageKeyOf, imageRoute } from '../images.ts';
import { parseJournalMarkdown } from '../journal-markdown.ts';
import { JournalImages } from './journal-images.ts';
import type { StreamingZip } from './streaming-zip.ts';

export const journalImageKeys = (markdown: string): ReadonlyArray<string> => {
  if (!markdown.includes(imageRoute)) {
    return [];
  }
  const keys = new Set<string>();
  const visit = (node: JSONContent) => {
    if (node.type === 'image') {
      const key = imageKeyOf(node.attrs?.src);
      if (key !== undefined) {
        keys.add(key);
      }
    }
    for (const child of node.content ?? []) {
      visit(child);
    }
  };
  visit(parseJournalMarkdown(markdown));
  return [...keys];
};

/** A separate snapshot pass keeps binary files outside the open NDJSON member. */
export const exportImagesPass = (zip: StreamingZip) => {
  const written = new Set<string>();
  return {
    before: Effect.void,
    after: Effect.void,
    onEntry: (entry: ExportEntry) =>
      Effect.gen(function* () {
        for (const key of [
          ...journalImageKeys(entry.journalMarkdown),
          ...journalImageKeys(entry.scriptureMarkdown),
        ]) {
          if (!written.has(key)) {
            const images = yield* JournalImages;
            const bytes = yield* images.read(key);
            yield* zip.beginFile(`images/${key}`);
            yield* zip.writeBytes(bytes, true);
            written.add(key);
          }
        }
      }),
  };
};
