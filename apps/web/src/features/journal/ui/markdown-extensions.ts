import type { AnyExtension, NodeConfig } from '@tiptap/core';
import { Markdown } from '@tiptap/markdown';
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

/** The Markdown vocabulary shared by the editor and its server rendering. */
export const journalMarkdownExtensions = () => [
  // Underline has no Markdown spelling. Leaving it in would let a keyboard
  // shortcut produce formatting that the next save silently discards.
  JournalStarterKit.configure({ underline: false }),
  Markdown,
];
