import type { AnyExtension, JSONContent, NodeConfig } from '@tiptap/core';
import { Markdown, MarkdownManager } from '@tiptap/markdown';
import StarterKit from '@tiptap/starter-kit';

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

const remapHeading = (extension: AnyExtension): AnyExtension =>
  extension.name === 'heading'
    ? extension.extend({
        renderHTML: ({ HTMLAttributes, node }: NodeRenderProps) => [
          journalHeadingTag(node.attrs.level),
          HTMLAttributes,
          0,
        ],
      })
    : extension;

const JournalStarterKit = StarterKit.extend({
  addExtensions() {
    return (this.parent?.() ?? []).map(remapHeading);
  },
});

/** The Markdown vocabulary shared by the editor, server rendering and search. */
export const journalMarkdownExtensions = () => [
  // Underline has no Markdown spelling. Leaving it in would let a keyboard
  // shortcut produce formatting that the next save silently discards.
  JournalStarterKit.configure({ underline: false }),
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

const blockWithLineSeparatedChildren = new Set([
  'blockquote',
  'bulletList',
  'doc',
  'listItem',
  'orderedList',
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
    .join(blockWithLineSeparatedChildren.has(node.type ?? '') ? '\n' : '');
};

/** The text the read-only Markdown model puts on the page. */
export const journalMarkdownText = (markdown: string): string =>
  visibleTextOf(parseJournalMarkdown(markdown));
