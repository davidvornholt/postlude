import { searchDocumentOf } from '../search-document.ts';
import { countJournalWords } from '../word-count.ts';
import type { JournalImportRecord } from './import-record.ts';

export type ExistingJournalImportRow = {
  readonly date: string;
  readonly journalMarkdown: string | null;
  readonly journalWordCount: number;
  readonly scriptureMarkdown: string | null;
  readonly scriptureWordCount: number;
  readonly scriptureBook: string | null;
  readonly scriptureChapter: number | null;
  readonly scriptureVerseStart: number | null;
  readonly scriptureVerseEnd: number | null;
  readonly revision: number;
  readonly journalSearchText: string;
  readonly scriptureSearchText: string;
  readonly scriptureReferenceSearchText: string;
  readonly searchTokenText: string;
  readonly searchProjectionRevision: number;
};

export const derivedImportFieldsOf = (record: JournalImportRecord) => ({
  journalWordCount: countJournalWords(record.journalMarkdown),
  scriptureWordCount: countJournalWords(record.scriptureMarkdown),
  document: searchDocumentOf({
    journalMarkdown: record.journalMarkdown,
    scriptureMarkdown: record.scriptureMarkdown,
    scriptureReference: record.scriptureReference,
  }),
});

export const existingImportRowIsUnchanged = (
  row: ExistingJournalImportRow,
  record: JournalImportRecord,
): boolean => {
  const derived = derivedImportFieldsOf(record);
  return (
    (row.journalMarkdown ?? '') === record.journalMarkdown &&
    row.journalWordCount === derived.journalWordCount &&
    (row.scriptureMarkdown ?? '') === record.scriptureMarkdown &&
    row.scriptureWordCount === derived.scriptureWordCount &&
    row.scriptureBook === (record.scriptureReference?.book ?? null) &&
    row.scriptureChapter === (record.scriptureReference?.chapter ?? null) &&
    row.scriptureVerseStart ===
      (record.scriptureReference?.verseStart ?? null) &&
    row.scriptureVerseEnd === (record.scriptureReference?.verseEnd ?? null) &&
    row.journalSearchText === derived.document.journalText &&
    row.scriptureSearchText === derived.document.scriptureText &&
    row.scriptureReferenceSearchText ===
      derived.document.scriptureReferenceText &&
    row.searchTokenText === derived.document.searchTokenText &&
    row.searchProjectionRevision === row.revision
  );
};
