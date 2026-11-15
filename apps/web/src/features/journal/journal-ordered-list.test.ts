import { describe, expect, it } from 'bun:test';
import type { JSONContent } from '@tiptap/core';

import {
  journalMarkdownText,
  parseJournalMarkdown,
  serializeJournalMarkdown,
} from './journal-markdown.ts';

const saveSixTimes = (document: JSONContent): Array<JSONContent> =>
  Array.from({ length: 6 }).reduce<Array<JSONContent>>(
    (saves) => [
      ...saves,
      parseJournalMarkdown(serializeJournalMarkdown(saves.at(-1) ?? document)),
    ],
    [],
  );

const paragraph = (text: string): JSONContent =>
  text === ''
    ? { type: 'paragraph' }
    : { type: 'paragraph', content: [{ type: 'text', text }] };

const item = (...content: Array<JSONContent>): JSONContent => ({
  type: 'listItem',
  content,
});

const doc = (...content: Array<JSONContent>): JSONContent => ({
  type: 'doc',
  content,
});

const threeParagraphs = item(
  paragraph('first'),
  paragraph('alpha'),
  paragraph('omega'),
);

const numbered = (
  attrs: Record<string, unknown> | undefined,
  ...content: Array<JSONContent>
): JSONContent =>
  attrs === undefined
    ? { type: 'orderedList', content }
    : { type: 'orderedList', attrs, content };

describe('journal numbered lists', () => {
  it('keeps every paragraph of a numbered item and its indentation through repeated saves', () => {
    const markdown = '1. first\n\n   alpha\n\n   omega';
    const document = parseJournalMarkdown(markdown);

    expect(document).toEqual(doc(numbered(undefined, threeParagraphs)));
    for (const save of saveSixTimes(document)) {
      expect(save).toEqual(document);
      expect(serializeJournalMarkdown(save)).toBe(markdown);
    }
  });

  it('keeps every paragraph through repeated saves however the item is numbered or nested', () => {
    for (const document of [
      doc(numbered({ start: 9 }, item(paragraph('nine')), threeParagraphs)),
      doc(numbered({ start: 99 }, threeParagraphs)),
      doc(numbered({ type: 'a' }, threeParagraphs)),
      doc(
        numbered(
          undefined,
          item(paragraph('parent'), numbered(undefined, threeParagraphs)),
        ),
      ),
      doc({
        type: 'bulletList',
        content: [
          item(paragraph('parent'), numbered(undefined, threeParagraphs)),
        ],
      }),
      doc({
        type: 'bulletList',
        content: [
          item(
            paragraph('parent'),
            numbered(
              undefined,
              item(paragraph(''), paragraph('alpha'), paragraph('omega')),
            ),
          ),
        ],
      }),
    ]) {
      const saves = saveSixTimes(document);

      expect(saves).toEqual(saves.map(() => saves[0] ?? {}));
      expect(
        journalMarkdownText(serializeJournalMarkdown(saves.at(-1) ?? {})),
      ).toContain('omega');
    }
  });

  it('keeps a rule in a numbered item a rule through repeated saves', () => {
    const rule = { type: 'horizontalRule' };
    for (const document of [
      doc(
        numbered(undefined, item(paragraph('hello'), rule, paragraph('after'))),
      ),
      doc(
        numbered(
          undefined,
          item(paragraph('hello'), {
            type: 'bulletList',
            content: [item(paragraph('alpha'), paragraph('after'), rule)],
          }),
        ),
      ),
    ]) {
      for (const save of saveSixTimes(document)) {
        expect(save).toEqual(document);
      }
    }
  });

  it('stops moving a paragraph that earlier saves already indented', () => {
    const markdown = '1. first\n\n   alpha\n\n     omega';
    const saves = saveSixTimes(parseJournalMarkdown(markdown)).map(
      serializeJournalMarkdown,
    );

    expect(saves).toEqual(saves.map(() => markdown));
    expect(journalMarkdownText(markdown)).toContain('omega');
  });
});
