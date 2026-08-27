import { journalMarkdownText } from './journal-markdown.ts';
import {
  formatScriptureReference,
  type ScriptureReference,
  scriptureBookSearchNames,
} from './scripture-reference.ts';
import { searchTokenText as tokenTextOf } from './search-query.ts';

export type SearchDocument = {
  readonly journalText: string;
  readonly scriptureText: string;
  /** One rendered reference per accepted book spelling, separated by lines. */
  readonly scriptureReferenceText: string;
  /** Canonical tokens consumed by the database index. */
  readonly searchTokenText: string;
};

const referenceLabels = (reference: ScriptureReference | undefined): string => {
  if (reference === undefined) {
    return '';
  }
  return scriptureBookSearchNames(reference.book)
    .map((book) => formatScriptureReference({ ...reference, book }))
    .join('\n');
};

/** The exact visible representation persisted for indexing and result excerpts. */
export const searchDocumentOf = (input: {
  readonly journalMarkdown: string;
  readonly scriptureMarkdown: string;
  readonly scriptureReference: ScriptureReference | undefined;
}): SearchDocument => {
  const journalText = journalMarkdownText(input.journalMarkdown);
  const scriptureText = journalMarkdownText(input.scriptureMarkdown);
  const scriptureReferenceText = referenceLabels(input.scriptureReference);
  return {
    journalText,
    scriptureText,
    scriptureReferenceText,
    searchTokenText: tokenTextOf(
      [journalText, scriptureText, scriptureReferenceText].join('\n'),
    ),
  };
};
