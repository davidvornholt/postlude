import { describe, expect, it } from 'bun:test';

import {
  attributeOf,
  childElements,
  classesOf,
  decodeReferences,
  descendants,
  type HtmlElement,
  parseHtml,
  textOf,
  textWithout,
} from './html-tree.ts';

const only = (root: HtmlElement, tag: string): HtmlElement => {
  const found = descendants(root).filter((element) => element.tag === tag);
  if (found.length !== 1 || found[0] === undefined) {
    throw new Error(`Expected one ${tag}, found ${found.length}.`);
  }
  return found[0];
};

describe('parseHtml', () => {
  it('reads elements, attributes, and text into a tree', () => {
    const root = parseHtml(
      '<!doctype html><html><body><main class="page  wide" data-day=2026-10-29><p title=\'a "b"\'>One <em>two</em></p></main></body></html>',
    );
    const main = only(root, 'main');
    expect(classesOf(main)).toEqual(['page', 'wide']);
    expect(attributeOf(main, 'data-day')).toBe('2026-10-29');
    expect(attributeOf(only(root, 'p'), 'title')).toBe('a "b"');
    expect(textOf(main)).toBe('One two');
  });

  it('reads character references in text and attributes', () => {
    const root = parseHtml(
      '<p data-tip="Tom &amp; Jerry &middot; 10:00&ndash;11:00">&lt;b&gt; &#8250; &#x2014; &nbsp;&unknown; &#0;</p>',
    );
    const paragraph = only(root, 'p');
    expect(attributeOf(paragraph, 'data-tip')).toBe(
      'Tom & Jerry · 10:00–11:00',
    );
    expect(textOf(paragraph)).toBe('<b> › — &unknown; &#0;');
    expect(decodeReferences('&quot;&apos;&hellip;')).toBe('"\'…');
  });

  it('leaves out comments, and never reads markup inside scripts and styles', () => {
    const root = parseHtml(
      '<p>Kept<!-- <p>a comment</p> --></p><script>if (a < b) document.write("<p>no</p>")</script><style>p { color: red }</style><textarea><p>raw</p></textarea>',
    );
    expect(descendants(root).map((element) => element.tag)).toEqual([
      'p',
      'script',
      'style',
      'textarea',
    ]);
    expect(textOf(root)).toBe('Kept');
  });

  it('closes elements left open where their parent ends, and ignores stray end tags', () => {
    const root = parseHtml(
      '<ul><li>One<li>Two</ul></span><p>After<br>the list<img src="x"></p>',
    );
    const list = only(root, 'ul');
    expect(childElements(root).map((element) => element.tag)).toEqual([
      'ul',
      'p',
    ]);
    expect(textOf(list)).toBe('OneTwo');
    expect(
      childElements(only(root, 'p')).map((element) => element.tag),
    ).toEqual(['br', 'img']);
  });

  it('keeps a lone angle bracket as text', () => {
    expect(textOf(parseHtml('<p>3 < 4 and 5 > 4</p>'))).toBe('3 < 4 and 5 > 4');
  });

  it('reads a page that ends inside a tag or a comment without failing', () => {
    expect(textOf(parseHtml('<p>Words</p><!-- never closed'))).toBe('Words');
    expect(textOf(parseHtml('<p>Words</p><div class="x'))).toBe(
      'Words<div class="x',
    );
  });
});

describe('textWithout', () => {
  it('leaves out the children a test picks, and folds white space', () => {
    const [item] = childElements(
      parseHtml(
        '<li><span class="time">09:00</span>  Standup\n  <span class="meta">· Work</span></li>',
      ),
    );
    expect(
      textWithout(item as HtmlElement, (child) => child.tag === 'span'),
    ).toBe('Standup');
  });
});
