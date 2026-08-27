import { expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

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
