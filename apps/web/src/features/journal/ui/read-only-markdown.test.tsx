import { expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  attributeValue,
  elementAttributes,
  openingTag,
} from '#/shared/testing/rendered-html.ts';
import { imageRoute } from '../images.ts';
import { interfaceLanguage, journalLanguage } from '../journal-language.ts';
import {
  markdownSemanticsFixture,
  markdownSemanticsLinks,
} from './markdown-semantics.fixture.ts';
import { ReadOnlyMarkdown } from './read-only-markdown.tsx';

const render = (markdown: string): string =>
  renderToStaticMarkup(
    <ReadOnlyMarkdown className="journal-prose" markdown={markdown} />,
  );

it('server-renders the Markdown structure a reader uses', () => {
  const html = render(`# Quiet **morning**

- First thought
- [Second thought](https://example.com/second)

3. Third thought

![Rain over the lake](/rain.png)`);

  expect(html).toContain('<h3>Quiet <strong>morning</strong></h3>');
  expect(html).toContain('<ul><li><p>First thought</p></li>');
  expect(html).toContain('<ol start="3"><li><p>Third thought</p></li></ol>');
  expect(html).toContain(
    '<a href="https://example.com/second">Second thought</a>',
  );
  expect(html).toContain('Rain over the lake');
  expect(html).not.toContain('<img');
});

it("sets the writing in the journal's language rather than the page's", () => {
  expect(render('Ein ruhiger Abend.')).toStartWith(
    `<div class="journal-prose" lang="${journalLanguage}">`,
  );
});

it("keeps the controls around an image in the page's language and its description in the journal's", () => {
  const html = render(
    `![Regen am See](${imageRoute}12345678-1234-4234-8234-123456789abc.png)\n\n![](/missing.png)`,
  );

  expect(attributeValue(openingTag(html, 'button'), 'lang')).toBe(
    interfaceLanguage,
  );
  expect(
    attributeValue(
      elementAttributes(html, 'span', 'Image unavailable'),
      'lang',
    ),
  ).toBe(interfaceLanguage);
  expect(
    attributeValue(elementAttributes(html, 'p', 'Regen am See'), 'lang'),
  ).toBe(journalLanguage);
});

it('keeps safe mixed-case web links and every subordinate heading level', () => {
  const html = render(markdownSemanticsFixture);

  expect(html).toContain('<h3>Entry heading</h3>');
  expect(html).toContain('<h4>Entry subheading</h4>');
  expect(html).toContain('<h5>Entry detail</h5>');
  expect(html).toContain('<h6>Entry note</h6>');
  expect(html).toContain('<h6>Entry aside</h6>');
  expect(html).toContain('<h6>Entry footnote</h6>');
  for (const link of markdownSemanticsLinks) {
    expect(html).toContain(`<a href="${link.href}">${link.name}</a>`);
  }
});

it('keeps a fenced code block as preformatted code', () => {
  const html = render(`Before

\`\`\`ts
const answer = 42;
\`\`\`

After`);

  expect(html).toContain('<pre><code>const answer = 42;</code></pre>');
  expect(html).toContain('<p>Before</p>');
  expect(html).toContain('<p>After</p>');
});

it('escapes raw HTML and refuses executable link protocols', () => {
  const html = render(`<script>alert('stored')</script>

<img src=x onerror=alert(1)>

[Run it](javascript:alert(1))`);

  expect(html).not.toContain('<script>');
  expect(html).not.toContain('<img ');
  expect(html).toContain('&lt;script&gt;');
  expect(html).toContain('Run it');
  expect(html).not.toContain('href="javascript:');
});

it('renders a pipe table with column headers and alignment', () => {
  const html = render(`| Hour | Mood |
| :--- | ---: |
| Dawn | **calm**<br>then busy |`);

  expect(html).toContain(
    '<table><tbody><tr><th class="text-left" scope="col"><p>Hour</p></th>',
  );
  expect(html).toContain('<th class="text-right" scope="col"><p>Mood</p></th>');
  expect(html).toContain(
    '<td class="text-right"><p><strong>calm</strong><br/>then busy</p></td>',
  );
});

it('shows each checklist item ticked or open, like the editor', () => {
  const html = render('- [x] Watered the plants\n- [ ] Call the landlord');

  expect(html).toBe(
    `<div class="journal-prose" lang="${journalLanguage}"><ul data-type="taskList">` +
      '<li data-checked="true"><label><input aria-label="Watered the plants" disabled="" readOnly="" type="checkbox" checked=""/></label><div><p>Watered the plants</p></div></li>' +
      '<li data-checked="false"><label><input aria-label="Call the landlord" disabled="" readOnly="" type="checkbox"/></label><div><p>Call the landlord</p></div></li>' +
      '</ul></div>',
  );
});
