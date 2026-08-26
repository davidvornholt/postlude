import { Markdown } from '@tiptap/markdown';
import StarterKit from '@tiptap/starter-kit';

/** The Markdown vocabulary shared by the editor and its server rendering. */
export const journalMarkdownExtensions = () => [
  // Underline has no Markdown spelling. Leaving it in would let a keyboard
  // shortcut produce formatting that the next save silently discards.
  StarterKit.configure({ underline: false }),
  Markdown,
];
