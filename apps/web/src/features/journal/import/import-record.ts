import type { ScriptureReference } from '../scripture-reference.ts';

export type JournalImportRecord = {
  readonly date: string;
  readonly journalMarkdown: string;
  readonly scriptureMarkdown: string;
  readonly scriptureReference?: ScriptureReference;
  readonly source: string;
};

export type JournalImportIssue = {
  readonly source: string;
  readonly message: string;
};

export type JournalImportResult = {
  readonly records: ReadonlyArray<JournalImportRecord>;
  readonly issues: ReadonlyArray<JournalImportIssue>;
};

export const normalizedMarkdown = (markdown: string): string =>
  markdown.replaceAll('\r\n', '\n').trim();
