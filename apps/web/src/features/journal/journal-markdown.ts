import type {
  AnyExtension,
  JSONContent,
  MarkdownParseHelpers,
  MarkdownToken,
  NodeConfig,
  RenderContext,
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
// indented code as code and a line break inside its item. It leaves out an
// item with nothing after the box, which pressing Enter in a checklist makes.
// A bullet list splits into runs of checklist and plain items.
const emptyChecklistMark = /^\[(?<mark>[ xX])\]$/u;
const textTokenTypes = new Set(['paragraph', 'text']);

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

type ChecklistItem = {
  readonly checked: boolean;
  readonly item: MarkdownToken;
};

type ChecklistReading = {
  readonly checklist: ChecklistItem | undefined;
  readonly item: MarkdownToken;
};

const checklistItemOf = (item: MarkdownToken): ChecklistItem | undefined => {
  if (item.task === true) {
    return {
      checked: item.checked === true,
      item: { ...item, tokens: withoutCheckbox(item.tokens) },
    };
  }
  const [first, ...rest] = item.tokens ?? [];
  const firstLine = textTokenTypes.has(first?.type ?? '') ? first?.text : '';
  const mark = emptyChecklistMark.exec(firstLine?.trim() ?? '')?.groups?.mark;
  return mark === undefined
    ? undefined
    : { checked: mark !== ' ', item: { ...item, tokens: rest } };
};

const parseTaskItem = (
  { checked, item }: ChecklistItem,
  helpers: MarkdownParseHelpers,
): JSONContent => {
  const content: Array<JSONContent> =
    helpers.parseChildren([item])[0]?.content ?? [];
  return {
    type: 'taskItem',
    attrs: { checked },
    content:
      content[0]?.type === 'paragraph'
        ? content
        : [{ type: 'paragraph' }, ...content],
  };
};

const parseBulletList = (
  token: MarkdownToken,
  helpers: MarkdownParseHelpers,
): Array<JSONContent> => {
  if (token.type !== 'list' || token.ordered) {
    return [];
  }
  const runs: Array<Array<ChecklistReading>> = [];
  for (const item of token.items ?? []) {
    const reading = { item, checklist: checklistItemOf(item) };
    const run = runs.at(-1);
    if (
      run?.[0] !== undefined &&
      (run[0].checklist === undefined) === (reading.checklist === undefined)
    ) {
      run.push(reading);
    } else {
      runs.push([reading]);
    }
  }
  return runs.map((run) =>
    run[0]?.checklist === undefined
      ? {
          type: 'bulletList',
          content: helpers.parseChildren(run.map(({ item }) => item)),
        }
      : {
          type: 'taskList',
          content: run.flatMap(({ checklist }) =>
            checklist === undefined ? [] : [parseTaskItem(checklist, helpers)],
          ),
        },
  );
};

// Inside a list item blocks sit on consecutive lines, where `---` under a
// paragraph would make it a heading.
const listItemTypes = new Set(['listItem', 'taskItem']);

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
    case 'horizontalRule':
      return extension.extend({
        renderMarkdown: (
          _node: JSONContent,
          _helpers: unknown,
          context: RenderContext,
        ) => (listItemTypes.has(context.parentType ?? '') ? '***' : '---'),
      });
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
