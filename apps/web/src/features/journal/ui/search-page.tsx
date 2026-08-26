/**
 * Searching the journal, at `/search`.
 *
 * The search is in the address rather than in a component's state, so a search
 * can be bookmarked, shared with the browser's back button, and reloaded — and
 * so the page is the same page whether the browser ran any script or not. The
 * form is a real `GET` form pointed at this route: without JavaScript it
 * submits and the server answers, and with it the submit is intercepted and the
 * router navigates instead, which is the same navigation without the reload.
 *
 * What the page says when it has no results is most of its behaviour. There is
 * a difference between not having been asked anything, having been asked
 * something that holds no words, and having been asked something no day
 * answers, and only the last of those is a failed search.
 */

import { useNavigate } from '@tanstack/react-router';
import { type SubmitEvent, useId } from 'react';

import { columnClass, eyebrowClass } from '#/shared/ui/design-classes.ts';
import { fieldClass, primaryButtonClass } from '#/shared/ui/form-classes.ts';
import type { SearchResults as Results } from '../services/search-fns.ts';
import { SearchResults } from './search-results.tsx';

const one = 1;

const quietTextClass = 'mt-10 max-w-prose text-ink-muted text-lg';

/**
 * What the search found, as a sentence rather than a bare number, because "3"
 * on its own does not say whether it is days or words or matches.
 */
const foundLabel = (results: Results): string => {
  const count = results.hits.length;
  const days = `${count} day${count === one ? '' : 's'}`;
  return results.limited
    ? `The first ${days} holding all of those words, newest first.`
    : `${days} hold${count === one ? 's' : ''} all of those words.`;
};

const SearchForm = ({ query }: { readonly query: string }) => {
  const fieldId = useId();
  const navigate = useNavigate();
  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    const form = event.currentTarget;
    event.preventDefault();
    const typed = new FormData(form).get('q');
    const next = typeof typed === 'string' ? typed.trim() : '';
    // A router that cannot make the move falls back to what the form already
    // is: submitting it natively reaches the same address through a page load,
    // rather than leaving the writer on a page that did nothing when they
    // pressed the button.
    navigate({ to: '/search', search: next === '' ? {} : { q: next } }).catch(
      () => form.submit(),
    );
  };

  return (
    <form
      action="/search"
      className="mt-8 flex flex-wrap items-end gap-x-6 gap-y-4"
      method="get"
      onSubmit={submit}
    >
      <div className="min-w-64 flex-1">
        <label
          className={[eyebrowClass, 'block text-ink-muted'].join(' ')}
          htmlFor={fieldId}
        >
          Words to find
        </label>
        <input
          className={[fieldClass, 'mt-3 text-lg'].join(' ')}
          defaultValue={query}
          id={fieldId}
          // Re-keying on the answered query is what lets the field follow a
          // navigation — the back button, or a link into a search — rather than
          // keeping whatever was typed into the last render of it.
          key={query}
          name="q"
          placeholder="A word you remember writing"
          type="search"
        />
      </div>
      <button className={primaryButtonClass} type="submit">
        Search
      </button>
    </form>
  );
};

/**
 * Everything below the form: an invitation, a nudge, an empty result, or the
 * days. It is one live region, so a search run without a page load is announced
 * rather than silently replacing what was there.
 */
const SearchAnswer = ({ results }: { readonly results: Results }) => {
  if (results.terms.length === 0) {
    return (
      <p className={quietTextClass}>
        {results.query === ''
          ? 'Every evening you have written is searchable. One word is usually enough; a word is matched from its beginning, so “rain” also finds “rainy”.'
          : 'That holds no words to search for. Try a word from the entry you are looking for.'}
      </p>
    );
  }
  if (results.hits.length === 0) {
    return (
      <p className={quietTextClass}>
        No day holds all of those words. Fewer words, or shorter ones, will find
        more.
      </p>
    );
  }
  return (
    <>
      <p className={[eyebrowClass, 'mt-12 text-ink-muted'].join(' ')}>
        {foundLabel(results)}
      </p>
      <div className="mt-6">
        <SearchResults hits={results.hits} today={results.today} />
      </div>
    </>
  );
};

export const SearchPage = ({ results }: { readonly results: Results }) => (
  <div className={columnClass}>
    <h1 className="font-display text-4xl text-ink sm:text-5xl">Search</h1>
    <SearchForm query={results.query} />
    <div aria-live="polite">
      <SearchAnswer results={results} />
    </div>
  </div>
);
