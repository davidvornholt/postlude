/**
 * The search page as it reaches the reader, server-rendered.
 *
 * Like the archive, this page sits behind the sign-in, so the browser
 * accessibility suite in `a11y/routes.a11y.ts` never reaches it. What matters
 * most here is what the page says when it has no days to show: not having been
 * asked anything, having been asked something with no words in it, and having
 * been asked something no day answers are three different answers, and only the
 * last one is a search that failed.
 */

import { expect, it } from 'bun:test';

import { renderInRouter } from '#/shared/testing/render-in-router.tsx';
import {
  attributeValue,
  elementAttributes,
  openingTag,
  plainText,
} from '#/shared/testing/rendered-html.ts';
import type {
  SearchHit,
  SearchHitSourceKind,
  SearchResults,
} from '../search-contract.ts';
import { searchExcerpt } from '../search-excerpt.ts';
import { searchTerms } from '../search-query.ts';
import { SearchPage, type SearchPageView } from './search-page.tsx';

const today = '2026-08-26';
const words = 120;
const one = 1;
const two = 2;
const overLimitLength = 201;
const marks = /<mark\b/gu;
const search = () => Promise.reject(new Error('SSR does not submit a search.'));

const hit = (
  date: string,
  prose: string,
  terms: ReadonlyArray<string>,
  kind: SearchHitSourceKind = 'evening',
): SearchHit => ({
  date,
  words,
  sources: [{ kind, excerpts: [searchExcerpt(prose, terms)] }],
});

const answered = (
  query: string,
  hits: ReadonlyArray<SearchHit> = [],
  limited = false,
): SearchResults => ({
  query,
  today,
  terms: searchTerms(query),
  hits,
  limited,
});

const render = (results: SearchResults) =>
  renderInRouter(
    <SearchPage
      search={search}
      view={{ state: 'answered', results } satisfies SearchPageView}
    />,
  );

const rain = searchTerms('rain');

/*
 * An empty page under a search box reads as a search that found nothing, which
 * is not what has happened before anything is typed.
 */
it('invites a search rather than reporting an empty one', async () => {
  const html = await render(answered(''));
  expect(html).toContain('Every evening you have written is searchable');
  expect(html).not.toContain('No day holds all of those words');
});

it('says a typed line held no words to search for', async () => {
  const html = await render(answered('&&& ?!'));
  expect(html).toContain('That holds no words to search for');
  expect(html).not.toContain('No day holds all of those words');
});

it('says no day answered, and how to ask for more', async () => {
  const html = await render(answered('snow drifts'));
  expect(html).toContain('No day holds all of those words');
  expect(html).toContain('Fewer words, or shorter ones');
});

it('gives back the line that was searched for, so it can be edited', async () => {
  const html = await render(answered('rain'));
  expect(attributeValue(html, 'value')).toBe('rain');
});

it('submits the private query in a POST body rather than the address', async () => {
  const html = await render(answered('rain'));
  const form = openingTag(html, 'form');
  expect(attributeValue(form, 'action')).toBe('/search');
  expect(attributeValue(form, 'method')).toBe('post');
  expect(html).not.toContain('?q=');
});

it('keeps an overlong native submission in the field and describes its error', async () => {
  const query = 'x'.repeat(overLimitLength);
  const html = await renderInRouter(
    <SearchPage search={search} view={{ state: 'invalid', query }} />,
  );
  const input = openingTag(html, 'input');
  const errorId = attributeValue(input, 'aria-describedby');
  expect(attributeValue(input, 'value')).toBe(query);
  expect(attributeValue(input, 'maxLength')).toBe('200');
  expect(attributeValue(input, 'aria-invalid')).toBe('true');
  expect(html).toContain(`id="${errorId}"`);
  expect(html).toContain('Use 200 characters or fewer');
});

it('keeps a failed query ready to retry', async () => {
  const html = await renderInRouter(
    <SearchPage search={search} view={{ state: 'failed', query: 'rain' }} />,
  );
  expect(attributeValue(html, 'value')).toBe('rain');
  expect(elementAttributes(html, 'button', 'Try again')).toContain(
    'type="submit"',
  );
  expect(html).toContain('Search is unavailable right now');
});

it('lists a found day as a link to the day it was written on', async () => {
  const html = await render(
    answered('rain', [hit('2026-03-01', 'The rain fell all night.', rain)]),
  );
  const link = elementAttributes(
    html,
    'a',
    'Sunday 1 March 2026EveningThe rain fell all night.',
  );
  expect(attributeValue(link, 'href')).toBe('/day/2026-03-01');
});

/*
 * A tinted background is invisible to a reader who cannot see the tint, so the
 * matched words are an element and a heavier weight as well as a colour.
 */
it('marks the found words as marks rather than as a colour', async () => {
  const html = await render(
    answered('rain', [hit('2026-03-01', 'Rain, and more rain.', rain)]),
  );
  expect(html.match(marks)?.length).toBe(two);
  expect(html).toContain('font-medium');
});

it('counts one day as a day', async () => {
  const html = await render(
    answered('rain', [hit('2026-03-01', 'The rain fell.', rain)]),
  );
  expect(plainText(html)).toContain(`${one} day holds all of those words`);
});

it('counts several days as days', async () => {
  const html = await render(
    answered('rain', [
      hit('2026-03-02', 'More rain.', rain),
      hit('2026-03-01', 'The rain fell.', rain),
    ]),
  );
  expect(plainText(html)).toContain(`${two} days hold all of those words`);
});

/*
 * A page that stopped at its limit has not counted the journal, so it says what
 * it is showing rather than claiming a total it never established.
 */
it('says a full page is the first of them rather than all of them', async () => {
  const html = await render(
    answered('rain', [hit('2026-03-01', 'The rain fell.', rain)], true),
  );
  const text = plainText(html);
  expect(text).toContain(`The first ${one} day holding all of those words`);
  expect(text).not.toContain(`${one} day holds all of those words`);
});

/* A result arriving without a page load has to be announced, not just drawn. */
it('answers inside a live region', async () => {
  const html = await render(answered('rain'));
  expect(elementAttributes(html, 'p', 'No days found.')).toContain(
    'aria-live="polite"',
  );
  expect(
    elementAttributes(
      html,
      'p',
      'No day holds all of those words. Fewer words, or shorter ones, will find more.',
    ),
  ).not.toContain('aria-live');
});
