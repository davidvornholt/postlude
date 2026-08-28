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
import {
  attributeValue,
  elementAttributes,
  plainText,
} from '#/shared/testing/rendered-html.ts';
import { entryOn, renderDay } from './day-page-test-support.tsx';

const headingSequence = (html: string): ReadonlyArray<string> =>
  Array.from(
    html.matchAll(/<(?<tag>h[1-6])[^>]*>(?<text>.*?)<\/h[1-6]>/gsu),
    (match) =>
      `${match.groups?.tag ?? ''}: ${plainText(match.groups?.text ?? '')}`,
  );

it('names the day in full, and how long ago it was', async () => {
  const html = await renderDay(entryOn({ date: '2026-08-24' }));

  expect(html).toContain('Monday, August 24, 2026');
  expect(html).toContain('2 days ago');
});

/*
 * Today keeps the canonical root address, while its forward link opens the next
 * dated day. A future day is a legitimate draft surface, so the stepper never
 * strands the writer at today's boundary.
 */
it('offers the next dated day from today', async () => {
  const html = await renderDay(entryOn());

  expect(html).toContain('aria-label="Previous day"');
  expect(elementAttributes(html, 'a', '→')).toContain(
    'href="/day/2026-08-27"',
  );
  expect(html).toContain('aria-label="Next day"');
});

/*
 * The steps are arrows rather than words, so what each one is called lives in
 * `aria-label` — an arrow with no name is a control that cannot be read aloud
 * or reached by voice.
 */
it('leads back to today from the day before it', async () => {
  const html = await renderDay(entryOn({ date: '2026-08-25' }));
  const next = elementAttributes(html, 'a', '→');
  const previous = elementAttributes(html, 'a', '←');

  expect(next).toContain('href="/"');
  expect(next).toContain('aria-label="Next day"');
  expect(previous).toContain('href="/day/2026-08-24"');
  expect(previous).toContain('aria-label="Previous day"');
});

it('labels and links a future day without changing its dated address', async () => {
  const html = await renderDay(
    entryOn({ date: '2026-08-27', journalMarkdown: 'Already planned.' }),
  );

  expect(html).toContain('Tomorrow');
  expect(elementAttributes(html, 'a', '←')).toContain(
    'href="/"',
  );
  expect(elementAttributes(html, 'a', '→')).toContain(
    'href="/day/2026-08-28"',
  );
});

it('omits the previous-day link at the start of the journal calendar', async () => {
  const html = await renderDay(entryOn({ date: '0001-01-01' }));

  expect(html).toContain('Monday, January 1, 1');
  expect(html).not.toContain('Previous day');
  expect(elementAttributes(html, 'a', '→')).toContain('href="/day/0001-01-02"');
});

it('renders supported low years without changing their calendar day', async () => {
  const year99 = await renderDay(entryOn({ date: '0099-01-01' }));
  const year100 = await renderDay(entryOn({ date: '0100-01-01' }));

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
  const html = await renderDay(
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
  const html = await renderDay(
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
  const html = await renderDay(
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
  expect(await renderDay(entryOn())).not.toContain('bibleserver.com');
});

/*
 * The counts are the writer's own running total, and they are counted from the
 * markdown rather than read from the row, so they are already right for text
 * that has not been saved yet. Markup does not count: three words of prose
 * behind two asterisks are three words.
 */
it('counts the prose rather than the markup', async () => {
  const html = await renderDay(
    entryOn({ journalMarkdown: 'A **long** evening.' }),
  );

  expect(html).toContain('3 words');
});

it('keeps routine autosave feedback visually stable', async () => {
  const html = await renderDay(entryOn());

  expect(html).toContain('Autosave on');
  expect(html).toContain('All changes saved');
});
