/**
 * What a day's page shows before a single key is pressed.
 *
 * The page is rendered on the server, which is also the state a reader sees for
 * the moment before the editor attaches — so this is both the markup test and
 * the test that the entry is legible without JavaScript having done anything.
 *
 * The production-route browser scan stops at the sign-in page because getting
 * past it needs a real GitHub OAuth round trip. An isolated browser fixture
 * hydrates this same component for computed style, keyboard, and accessibility
 * checks. This test owns the server markup before hydration and the day's
 * route-independent content rules.
 */

import { expect, it } from 'bun:test';
import { renderInRouter } from '#/shared/testing/render-in-router.tsx';
import {
  attributeValue,
  elementAttributes,
  plainText,
} from '#/shared/testing/rendered-html.ts';
import type { Anniversary } from '../anniversary.ts';
import type { JournalEntry } from '../schemas/entry.ts';
import { DayPage } from './day-page.tsx';

const today = '2026-08-26';

const entryOn = (overrides: Partial<JournalEntry> = {}): JournalEntry => ({
  date: today,
  journalMarkdown: '',
  journalWordCount: 0,
  journalFirstUsedAt: null,
  scriptureMarkdown: '',
  scriptureWordCount: 0,
  revision: 0,
  scriptureFirstUsedAt: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  ...overrides,
});

/*
 * Nothing here types, so nothing here saves. The port is passed in rather than
 * imported for exactly this reason: the real one reaches the session guard, the
 * connection pool, and the validated server environment, none of which decide a
 * character of the markup below.
 */
const neverSaves = () => new Promise<never>(() => undefined);

const render = (
  entry: JournalEntry,
  anniversaries: ReadonlyArray<Anniversary> = [],
): Promise<string> =>
  renderInRouter(
    <DayPage
      anniversaries={anniversaries}
      entry={entry}
      save={neverSaves}
      today={today}
    />,
  );

const headingSequence = (html: string): ReadonlyArray<string> =>
  Array.from(
    html.matchAll(/<(?<tag>h[1-6])[^>]*>(?<text>.*?)<\/h[1-6]>/gsu),
    (match) =>
      `${match.groups?.tag ?? ''}: ${plainText(match.groups?.text ?? '')}`,
  );

it('names the day in full, and how long ago it was', async () => {
  const html = await render(entryOn({ date: '2026-08-24' }));

  expect(html).toContain('Monday, August 24, 2026');
  expect(html).toContain('2 days ago');
});

/*
 * A day the writer has not lived has nothing in it to write honestly, so today
 * offers no way forward. Yesterday does, and its forward link goes to `/` rather
 * than to today's dated address: the route there redirects, and a redirect
 * between the writer and the page they open every evening is a page load spent
 * on nothing.
 */
it('offers no way forward from today', async () => {
  const html = await render(entryOn());

  expect(html).toContain('Previous day');
  expect(html).not.toContain('Next day');
});

it('leads back to today from the day before it', async () => {
  const html = await render(entryOn({ date: '2026-08-25' }));
  expect(elementAttributes(html, 'a', 'Next day →')).toContain('href="/"');
  expect(elementAttributes(html, 'a', '← Previous day')).toContain(
    'href="/day/2026-08-24"',
  );
});

it('omits the previous-day link at the start of the journal calendar', async () => {
  const html = await render(entryOn({ date: '0001-01-01' }));

  expect(html).toContain('Monday, January 1, 1');
  expect(html).not.toContain('Previous day');
  expect(elementAttributes(html, 'a', 'Next day →')).toContain(
    'href="/day/0001-01-02"',
  );
});

it('renders supported low years without changing their calendar day', async () => {
  const year99 = await render(entryOn({ date: '0099-01-01' }));
  const year100 = await render(entryOn({ date: '0100-01-01' }));

  expect(year99).toContain('Thursday, January 1, 99');
  expect(year99).toContain('href="/day/0098-12-31"');
  expect(year100).toContain('Friday, January 1, 100');
  expect(year100).toContain('href="/day/0099-12-31"');
});

/**
 * The entry, before the editor exists. ProseMirror needs a live document to
 * attach to and has none while the page is being rendered, so an entry that
 * were left to the editor alone would arrive as an empty page and fill in
 * afterwards — and would be an empty page for good if the script never ran.
 */
it('renders the writing before the editor attaches', async () => {
  const html = await render(
    entryOn({
      journalMarkdown: 'A **long** evening.\n\nThen a second thought.',
      scriptureMarkdown: 'On mercy.',
    }),
  );

  expect(html).toContain('<p>A <strong>long</strong> evening.</p>');
  expect(html).toContain('<p>Then a second thought.</p>');
  expect(html).toContain('<p>On mercy.</p>');
});

it('keeps entry headings below the page and section headings', async () => {
  const html = await render(
    entryOn({
      journalMarkdown:
        '# Evening thought\n\n## What stayed\n\n- A **clear** thought\n- [A source](https://example.com)\n\n```ts\nconst kept = true;\n```',
      scriptureMarkdown: '# Morning thought\n\n## What opened',
    }),
  );

  expect(headingSequence(html)).toEqual([
    'h1: Wednesday, August 26, 2026',
    'h2: Morning scripture',
    'h3: Morning thought',
    'h4: What opened',
    'h2: Evening',
    'h3: Evening thought',
    'h4: What stayed',
  ]);
  expect(html).toContain('<strong>clear</strong>');
  expect(html).toContain('<a href="https://example.com">A source</a>');
  expect(html).toContain('<pre><code>const kept = true;</code></pre>');
});

/*
 * The passage opens at bibleserver in the NeÜ. The reference is stored broken
 * into parts and reassembled here, so what the page links to is what the parser
 * understood rather than the line that happened to be typed.
 */
it('links a stored reference to the passage it names', async () => {
  const html = await render(
    entryOn({
      scriptureReference: {
        book: 'Proverbs',
        chapter: 12,
        verseStart: 5,
        verseEnd: 13,
      },
    }),
  );
  const link = elementAttributes(
    html,
    'a',
    'Read Proverbs 12:5-13 on bibleserver.com',
  );

  expect(attributeValue(link, 'href')).toBe(
    'https://www.bibleserver.com/Ne%C3%9C/Spr%C3%BCche12%2C5-13',
  );
  expect(link).toContain('rel="noreferrer"');
});

it('offers no passage link on a day with no reference', async () => {
  expect(await render(entryOn())).not.toContain('bibleserver.com');
});

/*
 * The counts are the writer's own running total, and they are counted from the
 * markdown rather than read from the row, so they are already right for text
 * that has not been saved yet. Markup does not count: three words of prose
 * behind two asterisks are three words.
 */
it('counts the prose rather than the markup', async () => {
  const html = await render(
    entryOn({ journalMarkdown: 'A **long** evening.' }),
  );

  expect(html).toContain('3 words');
});

it('says a day is saved before anything has been typed', async () => {
  expect(await render(entryOn())).toContain('Saved');
});

/*
 * The years behind a date are the one part of the page there to be read rather
 * than written. They lead with the writer's own words, and the whole line opens
 * the day, because the reason to go back is the sentence and not the date above
 * it.
 */
it('reads back an earlier year and opens the day it came from', async () => {
  const html = await render(entryOn(), [
    {
      date: '2025-08-26',
      yearsAgo: 1,
      words: 210,
      snippet: 'Moved the desk under the window.',
    },
  ]);

  expect(html).toContain('On this day');
  expect(html).toContain('Moved the desk under the window.');
  expect(plainText(html)).toContain('1 year ago');
  expect(html).toContain('href="/day/2025-08-26"');
});

/*
 * A heading over nothing would take a section of every page for a journal's
 * whole first year to say that there is nothing yet.
 */
it('leaves the section out on a date with no years behind it', async () => {
  expect(await render(entryOn())).not.toContain('On this day');
});

/*
 * The memory sits below the writing, not above it. This page exists to have an
 * evening written into it, and old entries in front of the editor would put
 * reading ahead of that.
 */
it('puts the memory after the evening rather than before it', async () => {
  const html = await render(entryOn(), [
    {
      date: '2025-08-26',
      yearsAgo: 1,
      words: 210,
      snippet: 'Moved the desk under the window.',
    },
  ]);

  expect(html.indexOf('Evening')).toBeLessThan(html.indexOf('On this day'));
});

/*
 * Walking back a day at a time is right for last night and wrong for last
 * March. The field is a real `GET` form pointed at `/day`, so it reaches the
 * day through a page load in a browser that ran no script, and it cannot be
 * pointed at a day that has not been lived.
 */
it('offers a way to a day by naming it, without needing script', async () => {
  const html = await render(entryOn({ date: '2026-08-24' }));

  expect(html).toContain('action="/day"');
  expect(html).toContain('method="get"');
  expect(html).toContain('Go to a day');
  expect(html).toContain(`max="${today}"`);
  expect(html).toContain('value="2026-08-24"');
});
