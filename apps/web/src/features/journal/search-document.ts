import {
  formatScriptureReference,
  type ScriptureReference,
  scriptureBookSearchNames,
} from './scripture-reference.ts';
import { normalizeSearchText } from './search-query.ts';
import { journalPlainText } from './word-count.ts';

export type SearchDocument = {
  readonly journalText: string;
  readonly scriptureText: string;
  /** One rendered reference per accepted book spelling, separated by lines. */
  readonly scriptureReferenceText: string;
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
export const searchDocumentOf = ({
  journalMarkdown,
  scriptureMarkdown,
  scriptureReference,
}: {
  readonly journalMarkdown: string;
  readonly scriptureMarkdown: string;
  readonly scriptureReference: ScriptureReference | undefined;
}): SearchDocument => ({
  journalText: normalizeSearchText(journalPlainText(journalMarkdown)),
  scriptureText: normalizeSearchText(journalPlainText(scriptureMarkdown)),
  scriptureReferenceText: normalizeSearchText(
    referenceLabels(scriptureReference),
  ),
});
