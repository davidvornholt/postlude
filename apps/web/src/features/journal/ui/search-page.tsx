/**
 * Private journal search at `/search`.
 *
 * The field owns the query in memory after hydration. A native form submits
 * the same words in a POST body, so neither path puts journal language in the
 * address or the browser's navigation history. Results never replace the
 * field, which keeps the writer's input and focus in place while the answer
 * below it changes.
 */

import {
  type ChangeEvent,
  type SubmitEvent,
  useId,
  useRef,
  useState,
} from 'react';

import { columnClass } from '#/shared/ui/design-classes.ts';
import { quietButtonClass } from '#/shared/ui/form-classes.ts';
import {
  searchQueryLengthLimit,
  searchUnavailableMessage,
} from '../search-contract.ts';
import type { SearchResults } from '../services/search-fns.ts';
import { SearchAnswer } from './search-answer.tsx';
import { SearchForm } from './search-form.tsx';
import { searchStatus } from './search-status.ts';

export type SearchPageView =
  | { readonly state: 'answered'; readonly results: SearchResults }
  | { readonly state: 'failed'; readonly query: string }
  | { readonly state: 'invalid'; readonly query: string };

type SearchState =
  | SearchPageView
  | { readonly state: 'ready'; readonly query: string }
  | { readonly state: 'pending'; readonly query: string };

export type SearchCall = (input: {
  readonly data: { readonly q?: string };
}) => Promise<SearchResults>;

const queryOf = (view: SearchPageView): string =>
  view.state === 'answered' ? view.results.query : view.query;

const statusWording = {
  failed: 'Search failed.',
  invalid: 'Search not sent.',
  pending: 'Searching.',
  ready: '',
} as const;

const liveStatus = (state: SearchState): string => {
  if (state.state === 'answered') {
    return searchStatus(state.results);
  }
  return statusWording[state.state];
};

export const SearchPage = ({
  search,
  view,
}: {
  readonly search: SearchCall;
  readonly view: SearchPageView;
}) => {
  const fieldId = useId();
  const errorId = useId();
  const formId = useId();
  const fieldRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(() => queryOf(view));
  const [state, setState] = useState<SearchState>(view);

  const submitQuery = async (nextQuery: string) => {
    if (nextQuery.length > searchQueryLengthLimit) {
      setState({ state: 'invalid', query: nextQuery });
      fieldRef.current?.focus();
      return;
    }
    setState({ state: 'pending', query: nextQuery });
    try {
      const results = await search({
        data: nextQuery === '' ? {} : { q: nextQuery },
      });
      setState({ state: 'answered', results });
    } catch {
      setState({ state: 'failed', query: nextQuery });
    }
  };

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitQuery(query).catch(() => undefined);
  };
  const change = (event: ChangeEvent<HTMLInputElement>) => {
    const nextQuery = event.target.value;
    setQuery(nextQuery);
    if (state.state === 'pending') {
      return;
    }
    setState(
      nextQuery.length > searchQueryLengthLimit
        ? { state: 'invalid', query: nextQuery }
        : { state: 'ready', query: nextQuery },
    );
  };

  return (
    <div className={columnClass}>
      <h1 className="font-display text-4xl text-ink sm:text-5xl">Search</h1>
      <SearchForm
        errorId={errorId}
        fieldId={fieldId}
        fieldRef={fieldRef}
        formId={formId}
        invalid={state.state === 'invalid'}
        onChange={change}
        onSubmit={submit}
        pending={state.state === 'pending'}
        query={query}
      />

      <div aria-busy={state.state === 'pending'}>
        <p
          aria-live="polite"
          className="mt-6 min-h-5 text-ink-faint"
          data-search-status={state.state}
        >
          {liveStatus(state)}
        </p>

        {state.state === 'answered' ? (
          <SearchAnswer results={state.results} />
        ) : null}
        {state.state === 'failed' ? (
          <div className="mt-10">
            <p className="max-w-prose text-ink-muted text-lg">
              {searchUnavailableMessage}
            </p>
            <button
              className={[quietButtonClass, 'mt-5'].join(' ')}
              form={formId}
              type="submit"
            >
              Try again
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
};
