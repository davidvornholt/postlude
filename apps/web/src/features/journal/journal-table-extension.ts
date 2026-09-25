import type { JSONContent, MarkdownRendererHelpers } from '@tiptap/core';
import { TableKit } from '@tiptap/extension-table';

type ColumnAlign = 'center' | 'left' | 'right';
type MarkdownCell = {
  readonly align: ColumnAlign | undefined;
  readonly text: string;
};

const minimumColumnWidth = 3;
const lineBreak = /[ \t]*\\?\r?\n[ \t]*/gu;
const unescapedPipe = /(?<!\\)(?<backslashes>(?:\\\\)*)\|/gu;

const columnAlignOf = (cell: JSONContent): ColumnAlign | undefined => {
  const align: unknown = cell.attrs?.align;
  return align === 'center' || align === 'left' || align === 'right'
    ? align
    : undefined;
};

// A GFM cell is one line, so hard breaks travel as `<br>`, which the journal
// parser reads back as a hard break. An unescaped pipe would end the cell.
const cellTextOf = (cell: JSONContent, h: MarkdownRendererHelpers): string =>
  h
    .renderChildren(cell.content ?? [])
    .trim()
    .replaceAll(lineBreak, '<br>')
    .replaceAll(
      unescapedPipe,
      (_pipe, backslashes: string) => `${backslashes}\\|`,
    );

// Markdown has no merged cells, so a spanning cell keeps its text in the first
// column it covers and leaves the rest empty, keeping every row the same width.
const markdownRowOf = (
  row: JSONContent,
  h: MarkdownRendererHelpers,
): ReadonlyArray<MarkdownCell> =>
  (row.content ?? []).flatMap((cell) => {
    const span: unknown = cell.attrs?.colspan;
    const covered = typeof span === 'number' && span > 1 ? span : 1;
    const align = columnAlignOf(cell);
    return [
      { align, text: cellTextOf(cell, h) },
      ...Array.from({ length: covered - 1 }, () => ({ align, text: '' })),
    ];
  });

const delimiterOf = (align: ColumnAlign | undefined, width: number): string => {
  switch (align) {
    case 'left':
      return `:${'-'.repeat(width - 1)}`;
    case 'right':
      return `${'-'.repeat(width - 1)}:`;
    case 'center':
      return `:${'-'.repeat(width - 2)}:`;
    default:
      return '-'.repeat(width);
  }
};

const lineOf = (cells: ReadonlyArray<string>): string =>
  `| ${cells.join(' | ')} |`;

/**
 * Writes a table as a GFM pipe table whose columns line up in plain text.
 *
 * GFM always reads the first row as the header, so a table whose first row
 * holds ordinary cells comes back with that row as its header.
 */
export const renderJournalTableMarkdown = (
  table: JSONContent,
  h: MarkdownRendererHelpers,
): string => {
  const rows = (table.content ?? []).map((row) => markdownRowOf(row, h));
  const columnCount = Math.max(0, ...rows.map((row) => row.length));
  if (columnCount === 0) {
    return '';
  }
  const columns = Array.from({ length: columnCount }, (_, column) => ({
    align: rows.find((row) => row[column]?.align !== undefined)?.[column]
      ?.align,
    width: Math.max(
      minimumColumnWidth,
      ...rows.map((row) => row[column]?.text.length ?? 0),
    ),
  }));
  const padded = rows.map((row) =>
    columns.map(({ width }, column) => (row[column]?.text ?? '').padEnd(width)),
  );
  const [header = [], ...body] = padded;
  return [
    lineOf(header),
    lineOf(columns.map(({ align, width }) => delimiterOf(align, width))),
    ...body.map(lineOf),
  ].join('\n');
};

// A Markdown table cell holds one line of inline text. Lists, headings or
// images pasted into a cell would be flattened by the next save, so the schema
// refuses them up front.
const markdownCell = { content: 'paragraph' } as const;

/** Tables limited to what a GFM pipe table can store. */
export const JournalTableKit = TableKit.configure({
  // Column widths have no Markdown spelling, so columns cannot be resized.
  table: { resizable: false },
}).extend({
  addExtensions() {
    // biome-ignore lint/nursery/noThisOutsideOfClass: Tiptap binds the extension instance as this when invoking addExtensions.
    return (this.parent?.() ?? []).map((extension) => {
      if (extension.name === 'table') {
        return extension.extend({
          renderMarkdown: renderJournalTableMarkdown,
        });
      }
      return extension.name === 'tableCell' || extension.name === 'tableHeader'
        ? extension.extend(markdownCell)
        : extension;
    });
  },
});
