import { normalizeSearchText, searchTerms } from './search-query.ts';
import { type SearchSpan, scanSearchSource } from './search-source-scan.ts';

const whitespaceRuns = /\s+/gu;
const horizontalWhitespaceRuns = /[^\S\n]+/gu;
const lineBreakRuns = /\n+/gu;
const excerptLength = 240;
const leadingContext = 60;

export type ExcerptSegment = {
  readonly text: string;
  readonly match: boolean;
  readonly at: number;
};

export type SearchExcerptWork = {
  readonly canonicalTermCount: number;
  readonly prefixCharactersVisited: number;
  readonly sourceTokenScans: number;
  readonly sourceTokenCount: number;
  readonly visibleCodeUnits: number;
};

const wordStartAt = (text: string, at: number): number => {
  if (at <= 0) {
    return 0;
  }
  const space = text.lastIndexOf(' ', at);
  return space === -1 ? 0 : space + 1;
};

const wordEndAt = (text: string, at: number): number => {
  if (at >= text.length) {
    return text.length;
  }
  const space = text.indexOf(' ', at);
  return space === -1 ? text.length : space;
};

const excerptOf = (
  text: string,
  anchor: number,
  matches: ReadonlyArray<SearchSpan>,
  hardLineBoundaries: boolean,
): ReadonlyArray<ExcerptSegment> => {
  const lineStart = hardLineBoundaries
    ? text.lastIndexOf('\n', Math.max(0, anchor - 1)) + 1
    : 0;
  const nextLine = hardLineBoundaries ? text.indexOf('\n', anchor) : -1;
  const lineEnd = nextLine === -1 ? text.length : nextLine;
  const start = Math.max(
    lineStart,
    wordStartAt(text, Math.max(lineStart, anchor - leadingContext)),
  );
  const end = Math.min(lineEnd, wordEndAt(text, start + excerptLength));
  const prefix = start > lineStart ? '… ' : '';
  const suffix = end < lineEnd ? ' …' : '';
  const excerpt = `${prefix}${text.slice(start, end)}${suffix}`;
  const ranges = matches
    .filter((match) => match.start >= start && match.end <= end)
    .map((match) => ({
      start: prefix.length + match.start - start,
      end: prefix.length + match.end - start,
    }));
  const segments: Array<ExcerptSegment> = [];
  let cursor = 0;
  for (const range of ranges) {
    if (range.start > cursor) {
      segments.push({
        text: excerpt.slice(cursor, range.start),
        match: false,
        at: cursor,
      });
    }
    segments.push({
      text: excerpt.slice(range.start, range.end),
      match: true,
      at: range.start,
    });
    cursor = range.end;
  }
  if (cursor < excerpt.length) {
    segments.push({ text: excerpt.slice(cursor), match: false, at: cursor });
  }
  return segments;
};

export const searchExcerpts = (
  plainText: string,
  rawTerms: ReadonlyArray<string>,
  options: { readonly hardLineBoundaries?: boolean } = {},
): {
  readonly excerpts: ReadonlyArray<ReadonlyArray<ExcerptSegment>>;
  readonly work: SearchExcerptWork;
} => {
  const hardLineBoundaries = options.hardLineBoundaries ?? false;
  const text = hardLineBoundaries
    ? normalizeSearchText(plainText)
        .replace(horizontalWhitespaceRuns, ' ')
        .replace(lineBreakRuns, '\n')
        .trim()
    : normalizeSearchText(plainText).replace(whitespaceRuns, ' ').trim();
  const terms = searchTerms(rawTerms.join(' '));
  if (text === '') {
    return {
      excerpts: [],
      work: {
        canonicalTermCount: terms.length,
        prefixCharactersVisited: 0,
        sourceTokenScans: 1,
        sourceTokenCount: 0,
        visibleCodeUnits: 0,
      },
    };
  }
  if (terms.length === 0) {
    return {
      excerpts: [[{ text, match: false, at: 0 }]],
      work: {
        canonicalTermCount: 0,
        prefixCharactersVisited: 0,
        sourceTokenScans: 1,
        sourceTokenCount: 0,
        visibleCodeUnits: text.length,
      },
    };
  }
  const scan = scanSearchSource(text, terms);
  const work = {
    canonicalTermCount: terms.length,
    prefixCharactersVisited: scan.prefixCharactersVisited,
    sourceTokenScans: 1,
    sourceTokenCount: scan.sourceTokenCount,
    visibleCodeUnits: text.length,
  };
  const excerpts = terms
    .flatMap((term) => {
      const anchor = scan.anchors.get(term);
      return anchor === undefined
        ? []
        : [excerptOf(text, anchor, scan.matches, hardLineBoundaries)];
    })
    .filter(
      (excerpt, at, all) =>
        all.findIndex(
          (candidate) => JSON.stringify(candidate) === JSON.stringify(excerpt),
        ) === at,
    );
  return { excerpts, work };
};

export const searchExcerpt = (
  plainText: string,
  terms: ReadonlyArray<string>,
): ReadonlyArray<ExcerptSegment> => {
  const result = searchExcerpts(plainText, terms);
  if (result.excerpts[0] !== undefined) {
    return result.excerpts[0];
  }
  const text = normalizeSearchText(plainText)
    .replace(whitespaceRuns, ' ')
    .trim();
  return text === '' ? [] : excerptOf(text, 0, [], false);
};
