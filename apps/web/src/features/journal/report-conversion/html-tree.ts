/**
 * A small reader for the pages /wrap stored before day reports were
 * documents: elements, attributes, text, and character references, enough to
 * walk our own template output. It reads markup into a tree and nothing more;
 * it never runs, fetches, or renders anything a page holds.
 *
 * It is forgiving in the ways the conversion needs. An end tag closes the
 * elements left open inside it, an end tag with nothing to close is skipped,
 * and scripts and styles are passed over whole.
 */

export type HtmlText = { readonly type: 'text'; readonly text: string };

export type HtmlElement = {
  readonly type: 'element';
  readonly tag: string;
  readonly attributes: ReadonlyMap<string, string>;
  readonly children: ReadonlyArray<HtmlNode>;
};

export type HtmlNode = HtmlText | HtmlElement;

type OpenElement = {
  readonly type: 'element';
  readonly tag: string;
  readonly attributes: Map<string, string>;
  readonly children: Array<HtmlNode>;
};

const voidTags = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'source',
  'track',
  'wbr',
]);

/** Elements whose content is never markup, and which the conversion ignores. */
const rawTextTags = new Set(['script', 'style', 'template', 'textarea']);

const namedReferences: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  middot: '·',
  rsaquo: '›',
  lsaquo: '‹',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
};

const referencePattern =
  /&(?:#(?<decimal>\d{1,7})|#[xX](?<hex>[\da-fA-F]{1,6})|(?<name>[a-zA-Z]{2,8}));/gu;
const highestCodePoint = 0x10_ff_ff;
const hexRadix = 16;

const codePointText = (codePoint: number, reference: string): string =>
  codePoint > 0 && codePoint <= highestCodePoint
    ? String.fromCodePoint(codePoint)
    : reference;

/** Text with its character references read, the way a browser shows it. */
export const decodeReferences = (text: string): string =>
  text.replace(referencePattern, (reference, ...rest) => {
    const groups = rest.at(-1) as {
      readonly decimal?: string;
      readonly hex?: string;
      readonly name?: string;
    };
    if (groups.decimal !== undefined) {
      return codePointText(Number(groups.decimal), reference);
    }
    if (groups.hex !== undefined) {
      return codePointText(Number.parseInt(groups.hex, hexRadix), reference);
    }
    return namedReferences[groups.name ?? ''] ?? reference;
  });

const startTagPattern =
  /<(?<tag>[a-zA-Z][\w:-]*)(?<attributes>(?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*(?<selfClosing>\/?)>/uy;
const endTagPattern = /<\/(?<tag>[a-zA-Z][\w:-]*)\s*>/uy;
const attributePattern =
  /(?<name>[^\s"'>/=]+)(?:\s*=\s*(?:"(?<double>[^"]*)"|'(?<single>[^']*)'|(?<bare>[^\s"'=<>`]+)))?/gu;

const attributesOf = (source: string): Map<string, string> => {
  const attributes = new Map<string, string>();
  for (const match of source.matchAll(attributePattern)) {
    const { name, double, single, bare } = match.groups ?? {};
    if (name !== undefined && !attributes.has(name.toLowerCase())) {
      attributes.set(
        name.toLowerCase(),
        decodeReferences(double ?? single ?? bare ?? ''),
      );
    }
  }
  return attributes;
};

const elementOf = (
  tag: string,
  attributes: Map<string, string>,
): OpenElement => ({ type: 'element', tag, attributes, children: [] });

/** Where a markup construct that isn't an element or text ends, or the end of the page. */
const skipPast = (html: string, from: number, end: string): number => {
  const at = html.indexOf(end, from);
  return at === -1 ? html.length : at + end.length;
};

type Reader = {
  readonly html: string;
  readonly stack: Array<OpenElement>;
  at: number;
};

const current = (reader: Reader): OpenElement =>
  reader.stack.at(-1) as OpenElement;

const readText = (reader: Reader): void => {
  const next = reader.html.indexOf('<', reader.at + 1);
  const end = next === -1 ? reader.html.length : next;
  const text = reader.html.slice(reader.at, end);
  current(reader).children.push({ type: 'text', text: decodeReferences(text) });
  reader.at = end;
};

const closeElement = (reader: Reader, tag: string): void => {
  for (let open = reader.stack.length - 1; open > 0; open -= 1) {
    if (reader.stack[open]?.tag === tag) {
      reader.stack.length = open;
      return;
    }
  }
};

const readStartTag = (reader: Reader, match: RegExpExecArray): void => {
  const tag = (match.groups?.tag ?? '').toLowerCase();
  const element = elementOf(tag, attributesOf(match.groups?.attributes ?? ''));
  current(reader).children.push(element);
  reader.at += match[0].length;
  if (rawTextTags.has(tag)) {
    reader.at = skipPast(reader.html.toLowerCase(), reader.at, `</${tag}`);
    reader.at = skipPast(reader.html, reader.at, '>');
    return;
  }
  if (!voidTags.has(tag) && match.groups?.selfClosing !== '/') {
    reader.stack.push(element);
  }
};

const readMarkup = (reader: Reader): void => {
  const { html } = reader;
  if (html.startsWith('<!--', reader.at)) {
    reader.at = skipPast(html, reader.at + '<!--'.length, '-->');
    return;
  }
  if (html.startsWith('<!', reader.at) || html.startsWith('<?', reader.at)) {
    reader.at = skipPast(html, reader.at, '>');
    return;
  }
  endTagPattern.lastIndex = reader.at;
  const end = endTagPattern.exec(html);
  if (end !== null) {
    closeElement(reader, (end.groups?.tag ?? '').toLowerCase());
    reader.at += end[0].length;
    return;
  }
  startTagPattern.lastIndex = reader.at;
  const start = startTagPattern.exec(html);
  if (start === null) {
    readText(reader);
    return;
  }
  readStartTag(reader, start);
};

/** A page as a tree under one root element, which has the tag `#root`. */
export const parseHtml = (html: string): HtmlElement => {
  const root = elementOf('#root', new Map());
  const reader: Reader = { html, stack: [root], at: 0 };
  while (reader.at < html.length) {
    if (html[reader.at] === '<') {
      readMarkup(reader);
    } else {
      readText(reader);
    }
  }
  return root;
};

export const isElement = (node: HtmlNode): node is HtmlElement =>
  node.type === 'element';

export const childElements = (
  element: HtmlElement,
): ReadonlyArray<HtmlElement> => element.children.filter(isElement);

export const attributeOf = (
  element: HtmlElement,
  name: string,
): string | undefined => element.attributes.get(name);

const classSeparator = /\s+/u;

/** The names in an element's `class`. */
export const classesOf = (element: HtmlElement): ReadonlyArray<string> =>
  (attributeOf(element, 'class') ?? '').split(classSeparator);

export const hasClass = (element: HtmlElement, name: string): boolean =>
  classesOf(element).includes(name);

export const is = (
  element: HtmlElement,
  tag: string,
  className?: string,
): boolean =>
  element.tag === tag &&
  (className === undefined || hasClass(element, className));

/** Every element below one, in document order. */
export const descendants = (element: HtmlElement): ReadonlyArray<HtmlElement> =>
  childElements(element).flatMap((child) => [child, ...descendants(child)]);

export const findElement = (
  element: HtmlElement,
  matches: (candidate: HtmlElement) => boolean,
): HtmlElement | undefined => descendants(element).find(matches);

const whiteSpace = /\s+/gu;

/** White space folded to single spaces, and trimmed, as a page shows text. */
export const foldSpace = (text: string): string =>
  text.replace(whiteSpace, ' ').trim();

const rawText = (node: HtmlNode): string =>
  node.type === 'text' ? node.text : node.children.map(rawText).join('');

/** The text of a node as a page shows it, white space folded. */
export const textOf = (node: HtmlNode): string => foldSpace(rawText(node));

/** The text of an element without the children a test picks out. */
export const textWithout = (
  element: HtmlElement,
  left: (child: HtmlElement) => boolean,
): string =>
  foldSpace(
    element.children
      .filter((child) => !(isElement(child) && left(child)))
      .map(rawText)
      .join(''),
  );
