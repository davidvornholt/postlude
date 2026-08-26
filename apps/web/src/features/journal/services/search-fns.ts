/**
 * The search's server function: a typed line in, a page of days out.
 *
 * It carries `sessionRequired` like every other function here. A search result
 * is the journal's prose, so an unguarded one would hand over the contents of a
 * private journal to anyone who could guess a word in it.
 *
 * The excerpt is cut here rather than in the browser. The alternative is sending
 * every matching day's markdown and cutting it there, which means shipping a
 * page of entries in full so that a couple of lines of each can be shown.
 */

import { createServerFn } from '@tanstack/react-start';
import { Effect, Schema } from 'effect';

import { sessionRequired } from '#/shared/auth/auth-middleware.ts';
import type { JournalDate } from '../journal-day.ts';
import {
  type ExcerptSegment,
  searchExcerpt,
  searchTerms,
  searchTsQuery,
} from '../search-query.ts';
import { journalPlainText } from '../word-count.ts';
import { EntrySearch, type SearchMatch } from './entry-search.ts';
import { currentJournalDate } from './journal-fns.ts';
import { runJournalEffect } from './journal-runtime.ts';

/** As many days as one page shows. The writer refines rather than scrolls. */
const searchLimit = 50;
const maxQueryLength = 200;

export type SearchHit = {
  readonly date: JournalDate;
  readonly words: number;
  /** Where the passage is what matched, so the excerpt is not the evening's. */
  readonly fromScripture: boolean;
  readonly excerpt: ReadonlyArray<ExcerptSegment>;
};

export type SearchResults = {
  /** The line as typed, so the page can say what it answered. */
  readonly query: string;
  /** Which day today is, so a result for it links to the page it lives on. */
  readonly today: JournalDate;
  /** The words it was reduced to; empty means nothing was actually asked. */
  readonly terms: ReadonlyArray<string>;
  readonly hits: ReadonlyArray<SearchHit>;
  /** There were at least this many; the page stopped counting at the limit. */
  readonly limited: boolean;
};

export const SearchQuery = Schema.Struct({
  q: Schema.optional(Schema.String.pipe(Schema.maxLength(maxQueryLength))),
});

export type SearchQueryParams = Schema.Schema.Type<typeof SearchQuery>;

const decodeQuery = Schema.decodeUnknownSync(SearchQuery);

/**
 * Which half of the day to show. A day matches on its evening prose, on the
 * morning's notes, or on the book it read; the excerpt comes from whichever of
 * the two actually holds one of the words, and from the evening by default,
 * which is where the writing is.
 */
const hitOf =
  (terms: ReadonlyArray<string>) =>
  (match: SearchMatch): SearchHit => {
    const journal = journalPlainText(match.journalMarkdown);
    const evening = searchExcerpt(journal, terms);
    const fromScripture =
      !evening.some((segment) => segment.match) &&
      match.scriptureMarkdown !== '';
    return {
      date: match.date,
      words: match.words,
      fromScripture,
      excerpt: fromScripture
        ? searchExcerpt(journalPlainText(match.scriptureMarkdown), terms)
        : evening,
    };
  };

export const searchJournalFn = createServerFn({ method: 'GET' })
  .middleware([sessionRequired])
  .validator((input: unknown) => decodeQuery(input ?? {}))
  .handler(({ data }): Promise<SearchResults> => {
    const query = data.q ?? '';
    const today = currentJournalDate();
    const terms = searchTerms(query);
    if (terms.length === 0) {
      return Promise.resolve({ query, today, terms, hits: [], limited: false });
    }
    return runJournalEffect(
      Effect.gen(function* () {
        const entries = yield* EntrySearch;
        const matches = yield* entries.search(
          searchTsQuery(terms),
          searchLimit,
        );
        return {
          query,
          today,
          terms,
          hits: matches.map(hitOf(terms)),
          limited: matches.length === searchLimit,
        };
      }),
    );
  });
