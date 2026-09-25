import type { AnyExtension, JSONContent, NodeConfig } from '@tiptap/core';
import { Markdown, MarkdownManager } from '@tiptap/markdown';
import StarterKit from '@tiptap/starter-kit';

import { JournalImage } from './journal-image-extension.ts';
import { JournalTableKit } from './journal-table-extension.ts';

const headingTags = ['h3', 'h4', 'h5', 'h6', 'h6', 'h6'] as const;
const firstMarkdownHeadingLevel = 1;
type NodeRenderProps = Parameters<NonNullable<NodeConfig['renderHTML']>>[0];

/** A journal entry sits below the page title and its morning/evening section. */
export const journalHeadingTag = (
  level: unknown,
): 'h3' | 'h4' | 'h5' | 'h6' => {
  if (typeof level !== 'number') {
    return 'h6';
  }
  return headingTags[level - firstMarkdownHeadingLevel] ?? 'h6';
};

const htmlLineBreak = /<br\s*\/?>/iu;
const leadingHtmlLineBreak = /^<br\s*\/?>/iu;

// Pipe tables can only spell a line break inside a cell as `<br>`. Markdown's
// HTML handling needs a browser DOM, so the server would keep the tag as text
// while the editor made it a break; this reads it as a break everywhere.
const readHtmlLineBreaks = {
  markdownTokenizer: {
    name: 'br',
    level: 'inline',
    start: (source: string) => source.search(htmlLineBreak),
    tokenize: (source: string) => {
      const [raw] = leadingHtmlLineBreak.exec(source) ?? [];
      return raw === undefined ? undefined : { type: 'br', raw };
    },
  },
} as const;

const remapStarterExtension = (extension: AnyExtension): AnyExtension => {
  switch (extension.name) {
    case 'heading':
      return extension.extend({
        renderHTML: ({ HTMLAttributes, node }: NodeRenderProps) => [
          journalHeadingTag(node.attrs.level),
          HTMLAttributes,
          0,
        ],
      });
    case 'hardBreak':
      return extension.extend(readHtmlLineBreaks);
    default:
      return extension;
  }
};

const JournalStarterKit = StarterKit.extend({
  addExtensions() {
    // biome-ignore lint/nursery/noThisOutsideOfClass: Tiptap binds the extension instance as this when invoking addExtensions.
    return (this.parent?.() ?? []).map(remapStarterExtension);
  },
});

/** The Markdown vocabulary shared by the editor, server rendering and search. */
export const journalMarkdownExtensions = () => [
  // Underline has no Markdown spelling. Leaving it in would let a keyboard
  // shortcut produce formatting that the next save silently discards.
  JournalStarterKit.configure({ underline: false }),
  JournalImage,
  JournalTableKit,
  Markdown,
];

const markdownManager = new MarkdownManager({
  extensions: journalMarkdownExtensions(),
});

/** Parses stored Markdown with the same model used by the editor. */
export const parseJournalMarkdown = (markdown: string): JSONContent =>
  markdownManager.parse(markdown);

/** Serializes editor content with the same Markdown vocabulary used to parse it. */
export const serializeJournalMarkdown = (content: JSONContent): string =>
  markdownManager.serialize(content);

// Cells in a row read as separate words rather than one run of text.
const childSeparators = new Map([
  ['blockquote', '\n'],
  ['bulletList', '\n'],
  ['doc', '\n'],
  ['listItem', '\n'],
  ['orderedList', '\n'],
  ['table', '\n'],
  ['tableRow', ' '],
]);

const visibleTextOf = (node: JSONContent): string => {
  if (node.type === 'text') {
    return node.text ?? '';
  }
  if (node.type === 'hardBreak') {
    return '\n';
  }
  if (node.type === 'image') {
    return typeof node.attrs?.alt === 'string' ? node.attrs.alt : '';
  }
  return (node.content ?? [])
    .map(visibleTextOf)
    .join(childSeparators.get(node.type ?? '') ?? '');
};

/** The text the read-only Markdown model puts on the page. */
export const journalMarkdownText = (markdown: string): string =>
  visibleTextOf(parseJournalMarkdown(markdown));
