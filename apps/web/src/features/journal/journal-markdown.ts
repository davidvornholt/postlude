import type {
  AnyExtension,
  JSONContent,
  MarkdownParseHelpers,
  MarkdownToken,
  NodeConfig,
} from '@tiptap/core';
import { TaskItem, TaskList } from '@tiptap/extension-list';
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

// Marked's list tokenizer already reads `- [ ]` and `- [x]` items, so it keeps
// indented code as code and a line break inside its item. A bullet list splits
// into runs of checklist and plain items.
const withoutCheckbox = (
  tokens: Array<MarkdownToken> = [],
): Array<MarkdownToken> =>
  tokens
    .filter((token) => token.type !== 'checkbox')
    .map((token) =>
      token.type === 'paragraph'
        ? { ...token, tokens: withoutCheckbox(token.tokens) }
        : token,
    );

const parseTaskItem = (
  item: MarkdownToken,
  helpers: MarkdownParseHelpers,
): JSONContent => ({
  type: 'taskItem',
  attrs: { checked: item.checked === true },
  content: helpers.parseChildren([
    { ...item, tokens: withoutCheckbox(item.tokens) },
  ])[0]?.content,
});

const parseBulletList = (
  token: MarkdownToken,
  helpers: MarkdownParseHelpers,
): Array<JSONContent> => {
  if (token.type !== 'list' || token.ordered) {
    return [];
  }
  const runs: Array<Array<MarkdownToken>> = [];
  for (const item of token.items ?? []) {
    const run = runs.at(-1);
    if (run !== undefined && run[0]?.task === item.task) {
      run.push(item);
    } else {
      runs.push([item]);
    }
  }
  return runs.map((items) =>
    items[0]?.task === true
      ? {
          type: 'taskList',
          content: items.map((item) => parseTaskItem(item, helpers)),
        }
      : { type: 'bulletList', content: helpers.parseChildren(items) },
  );
};

// Tiptap reads a `null` field as switched off, though its types only offer a
// replacement.
const switchedOff = null as never;

const JournalTaskList = TaskList.extend({
  markdownTokenizer: switchedOff,
  parseMarkdown: switchedOff,
});

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
    case 'bulletList':
      return extension.extend({ parseMarkdown: parseBulletList });
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

export const checklistItemLabel = (text: string | undefined): string =>
  text?.trim() || 'Empty checklist item';

/** The Markdown vocabulary shared by the editor, server rendering and search. */
export const journalMarkdownExtensions = () => [
  // Underline has no Markdown spelling. Leaving it in would let a keyboard
  // shortcut produce formatting that the next save silently discards.
  JournalStarterKit.configure({ underline: false }),
  // `- [ ]` and `- [x]` items. Without these the parser reads them as plain
  // bullets and the next save drops whether each item was done.
  JournalTaskList,
  TaskItem.configure({
    a11y: {
      checkboxLabel: (node) => checklistItemLabel(node.firstChild?.textContent),
    },
    nested: true,
  }),
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
  ['taskItem', '\n'],
  ['taskList', '\n'],
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

export const journalNodeText = visibleTextOf;

/** The text the read-only Markdown model puts on the page. */
export const journalMarkdownText = (markdown: string): string =>
  visibleTextOf(parseJournalMarkdown(markdown));
