/**
 * Readers for server-rendered markup, used by the tests that render a route
 * tree to a string and then assert against the HTML that comes back. Those
 * tests ask the same questions of it — how many of a landmark the page opens,
 * and what attributes the one element with a given label carries — so the
 * readers live here rather than inside one of them, where the second copy would
 * start drifting the moment either test grew.
 *
 * An element is found by its tag and its text, never by matching a whole tag:
 * attribute order is React's to choose and varies between renders.
 */

const whitespaceRun = /\s+/u;

/**
 * One opening `<tag …>`. The attributes are optional and have to start with a
 * space, so a search for `a` cannot land on an `article`.
 */
const openingTagSource = (tag: string): string =>
  `<${tag}(?<attributes>\\s[^>]*)?>`;

const openingTagPattern = (tag: string): RegExp =>
  new RegExp(openingTagSource(tag), 'u');

/** The same opening tag, together with everything up to its closing tag. */
const contentPattern = (tag: string): RegExp =>
  new RegExp(`${openingTagSource(tag)}(?<content>.*)</${tag}>`, 'su');

/** The same opening tag, together with everything up to its own closing tag. */
const labelledTagPattern = (tag: string): RegExp =>
  new RegExp(`${openingTagSource(tag)}(?<text>.*?)</${tag}>`, 'gsu');

const markup = /<[^>]*>/gu;
const whitespaceRuns = /\s+/gu;

/**
 * What an element reads as: nested tags dropped, and with them the comment
 * nodes React writes between adjacent pieces of text. A label assembled from a
 * value and some words reaches the markup as several nodes with separators
 * between them, and it is still one label to anyone reading the page.
 */
export const plainText = (html: string): string =>
  html.replace(markup, '').replace(whitespaceRuns, ' ').trim();

/** How many `<tag …>` elements the markup opens. */
export const countElements = (html: string, tag: string): number =>
  html.match(new RegExp(`<${tag}\\b`, 'gu'))?.length ?? 0;

/** The attribute text of the first `<tag …>`, or `''` when there is none. */
export const openingTag = (html: string, tag: string): string =>
  html.match(openingTagPattern(tag))?.groups?.attributes ?? '';

/**
 * Everything the one `<tag …>` encloses, or `''` when there is none. This is
 * how a count is asked of one region of the page rather than of the whole
 * document: the shell's header and the page below it both set a frame, and only
 * the page's is the page's to set.
 */
export const elementContent = (html: string, tag: string): string =>
  html.match(contentPattern(tag))?.groups?.content ?? '';

/**
 * How many elements carry this whole class recipe. Recipes are composed in a
 * module and handed to `className` in one piece, so each one reaches the markup
 * as the same run of names it was written as.
 */
export const countRecipe = (html: string, recipe: string): number =>
  html.split(recipe).length - 1;

/**
 * The attribute text of the one `<tag>` that reads as exactly `text`, or `''`
 * when no element matches — so an assertion about a renamed or missing element
 * runs against an empty string rather than against another element's tag.
 */
export const elementAttributes = (
  html: string,
  tag: string,
  text: string,
): string =>
  Array.from(html.matchAll(labelledTagPattern(tag)), (match) => ({
    attributes: match.groups?.attributes ?? '',
    text: plainText(match.groups?.text ?? ''),
  })).find((element) => element.text === text)?.attributes ?? '';

/** The value of one attribute inside an attribute text, or `''`. */
export const attributeValue = (attributes: string, name: string): string =>
  attributes.match(new RegExp(`\\b${name}="(?<value>[^"]*)"`, 'u'))?.groups
    ?.value ?? '';

/**
 * The class names of an attribute text, as a set. Whole names rather than a
 * search through the attribute text: `after:scale-x-100` and
 * `hover:after:scale-x-100` are different classes, and a substring search for
 * the first one finds the second.
 */
export const classNames = (attributes: string): ReadonlySet<string> =>
  new Set(
    attributeValue(attributes, 'class')
      .split(whitespaceRun)
      .filter((name) => name !== ''),
  );
