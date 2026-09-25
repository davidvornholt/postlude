import { searchHitOf } from '../search-contract.ts';
import type { SearchDocument } from '../search-document.ts';
import { storedSearchEvidence } from '../search-stored-evidence.ts';

type FixtureDocument = Pick<
  SearchDocument,
  'journalText' | 'scriptureText' | 'scriptureReferenceText'
> & { readonly date: string; readonly words: number };
/** Small presentation fixtures; real database tests own query sizing and prefix selection. */
export const searchHitFixture =
  (terms: ReadonlyArray<string>) => (document: FixtureDocument) => {
    const stored = storedSearchEvidence(document);
    return searchHitOf(terms)({
      date: document.date,
      words: document.words,
      evidence: terms.flatMap((term, termIndex) =>
        (['evening', 'scripture-notes', 'passage-reference'] as const).flatMap(
          (kind) => {
            const evidence = stored.find(
              (candidate) =>
                candidate.kind === kind && candidate.token.startsWith(term),
            );
            return evidence
              ? [
                  {
                    kind,
                    termIndex,
                    text: evidence.excerpt,
                    matchStart: evidence.matchStart,
                    matchLength: evidence.matchLength,
                  },
                ]
              : [];
          },
        ),
      ),
    });
  };
