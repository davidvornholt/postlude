/**
 * Private journal search at `/search`.
 *
 * The field owns the query in memory after hydration. A native form submits
 * the same words in a POST body, so neither path puts journal language in the
 * address or syncable URL history. A local browser can retain a POST body for
 * navigation recovery. Results never replace the field, which keeps the
 * writer's input and focus in place while the answer below it changes.
 */

import {
  type ChangeEvent,
  type SubmitEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';

import {
  pageFrameClass,
  readingMeasureClass,
} from '#/shared/ui/design-classes.ts';
import { quietButtonClass } from '#/shared/ui/form-classes.ts';
import { searchFailureKind } from '../errors/search-errors.ts';
import {
  type SearchResults,
  searchAuthenticationMessage,
  searchQueryLengthLimit,
  searchUnavailableMessage,
} from '../search-contract.ts';
import { searchResponseOf } from '../services/search-response.ts';
import { SearchAnswer } from './search-answer.tsx';
import { SearchForm } from './search-form.tsx';
import { searchStatus } from './search-status.ts';

export type SearchPageView =
  | { readonly state: 'answered'; readonly results: SearchResults }
  | { readonly state: 'authentication-required'; readonly query: string }
  | { readonly state: 'failed'; readonly query: string }
  | { readonly state: 'invalid'; readonly query: string };

type SearchState =
  | SearchPageView
  | { readonly state: 'ready'; readonly query: string }
  | { readonly state: 'pending'; readonly query: string };

export type SearchCall = (input: {
  readonly data: { readonly q?: string };
}) => Promise<unknown>;

const queryOf = (view: SearchPageView): string =>
  view.state === 'answered' ? view.results.query : view.query;

const statusWording = {
  'authentication-required': 'Sign-in required.',
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
  const signInRef = useRef<HTMLAnchorElement>(null);
  const [query, setQuery] = useState(() => queryOf(view));
  const [state, setState] = useState<SearchState>(view);

  useEffect(() => {
    if (state.state === 'authentication-required') {
      signInRef.current?.focus();
    }
  }, [state.state]);

  const submitQuery = async (nextQuery: string) => {
    if (nextQuery.length > searchQueryLengthLimit) {
      setState({ state: 'invalid', query: nextQuery });
      fieldRef.current?.focus();
      return;
    }
    setState({ state: 'pending', query: nextQuery });
    try {
      const response = searchResponseOf(
        await search({
          data: nextQuery === '' ? {} : { q: nextQuery },
        }),
      );
      setState(
        response.state === 'answered'
          ? response
          : { state: response.state, query: nextQuery },
      );
    } catch (error) {
      setState({
        state:
          searchFailureKind(error) === 'authentication'
            ? 'authentication-required'
            : 'failed',
        query: nextQuery,
      });
    }
  };

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    fieldRef.current?.focus();
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
    <div className={pageFrameClass}>
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
            <p
              className={[readingMeasureClass, 'text-ink-muted text-lg'].join(
                ' ',
              )}
            >
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
        {state.state === 'authentication-required' ? (
          <div className="mt-10">
            <p
              className={[readingMeasureClass, 'text-ink-muted text-lg'].join(
                ' ',
              )}
            >
              {searchAuthenticationMessage}
            </p>
            <a
              className={[quietButtonClass, 'mt-5 inline-block'].join(' ')}
              href="/login"
              ref={signInRef}
            >
              Sign in again
            </a>
          </div>
        ) : null}
      </div>
    </div>
  );
};
