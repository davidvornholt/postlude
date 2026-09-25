import {
  indexSearchEvidence,
  type SearchEvidence,
  type SearchEvidenceBounds,
  type SearchSpan,
  searchEvidenceIndexOf,
} from './search-evidence-index.ts';
import { foldSearchText } from './search-query.ts';

const asciiProse = /^[\x20-\x7e\t\r\n]*$/u;
const searchTokenRuns = /[\p{L}\p{N}]+/gu;
const graphemeSegmenter = new Intl.Segmenter(undefined, {
  granularity: 'grapheme',
});

type FoldedSpan = SearchSpan & {
  readonly visibleStart: number;
  readonly visibleEnd: number;
};

type Trie = { readonly children: Map<string, Trie>; term?: string };

const trieOf = (terms: ReadonlyArray<string>): Trie => {
  const root: Trie = { children: new Map() };
  for (const term of terms) {
    let node = root;
    for (const character of term) {
      const child = node.children.get(character) ?? { children: new Map() };
      node.children.set(character, child);
      node = child;
    }
    node.term = term;
  }
  return root;
};

const boundaryAfter = (
  spans: ReadonlyArray<FoldedSpan>,
  at: number,
): FoldedSpan => {
  let low = 0;
  let high = spans.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if ((spans[middle]?.end ?? 0) <= at) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  return spans[low] ?? { start: 0, end: 0, visibleStart: 0, visibleEnd: 0 };
};

const foldedSource = (text: string) => {
  const folded = foldSearchText(text);
  if (asciiProse.test(text)) {
    return {
      folded,
      visibleSpan: ({ start, end }: SearchSpan) => ({
        start,
        end,
        anchorEnd: start + 1,
      }),
    };
  }
  const spans: Array<FoldedSpan> = [];
  const foldedParts: Array<string> = [];
  let foldedAt = 0;
  for (const grapheme of graphemeSegmenter.segment(text)) {
    const part = foldSearchText(grapheme.segment);
    foldedParts.push(part);
    // Align canonical decompositions within a grapheme, keeping each original
    // character's coordinates. Grapheme bounds alone can include unrelated
    // letters (क्ष) or arbitrarily many prepend characters before a token.
    const characters = new Map<
      string,
      { positions: Array<SearchSpan>; consumed: number }
    >();
    let visibleAt = grapheme.index;
    for (const character of grapheme.segment) {
      for (const decomposed of foldSearchText(character).normalize('NFD')) {
        const entry = characters.get(decomposed) ?? {
          positions: [],
          consumed: 0,
        };
        entry.positions.push({
          start: visibleAt,
          end: visibleAt + character.length,
        });
        characters.set(decomposed, entry);
      }
      visibleAt += character.length;
    }
    for (const character of part) {
      const positions = Array.from(character.normalize('NFD'), (decomposed) => {
        const entry = characters.get(decomposed);
        const position = entry?.positions[entry.consumed];
        if (entry !== undefined) {
          entry.consumed += 1;
        }
        if (position === undefined) {
          throw new Error(
            'The canonical search character could not be mapped to prose.',
          );
        }
        return position;
      });
      spans.push({
        start: foldedAt,
        end: foldedAt + character.length,
        visibleStart: Math.min(...positions.map(({ start }) => start)),
        visibleEnd: Math.max(...positions.map(({ end }) => end)),
      });
      foldedAt += character.length;
    }
  }
  if (foldedParts.join('') !== folded) {
    throw new Error('The canonical search fold could not be mapped to prose.');
  }
  return {
    folded,
    visibleSpan: ({ start, end }: SearchSpan) => ({
      start: boundaryAfter(spans, start).visibleStart,
      anchorEnd: boundaryAfter(spans, start).visibleEnd,
      end: boundaryAfter(spans, Math.max(start, end - 1)).visibleEnd,
    }),
  };
};

/** Shared token-to-visible-text mapping for persisted evidence and live highlighting. */
export function* searchSourceTokens(text: string) {
  const source = foldedSource(text);
  for (const token of source.folded.matchAll(searchTokenRuns)) {
    yield {
      token: token[0],
      ...source.visibleSpan({
        start: token.index,
        end: token.index + token[0].length,
      }),
    };
  }
}

const matchingTerms = (
  token: string,
  trie: Trie,
): { readonly terms: ReadonlyArray<string>; readonly visited: number } => {
  const terms: Array<string> = [];
  let node = trie;
  let visited = 0;
  for (const character of token) {
    visited += 1;
    const child = node.children.get(character);
    if (child === undefined) {
      break;
    }
    node = child;
    if (node.term !== undefined) {
      terms.push(node.term);
    }
  }
  return { terms, visited };
};

export const scanSearchSource = (
  text: string,
  terms: ReadonlyArray<string>,
  evidenceBounds: SearchEvidenceBounds,
): {
  readonly evidenceByTerm: ReadonlyMap<string, SearchEvidence>;
  readonly evidenceRangeVisits: number;
  readonly evidenceRangeWrites: number;
  readonly evidenceWindowCount: number;
  readonly prefixCharactersVisited: number;
  readonly sourceTokenCount: number;
} => {
  const source = foldedSource(text);
  const trie = trieOf(terms);
  const evidence = searchEvidenceIndexOf(evidenceBounds);
  let prefixCharactersVisited = 0;
  let sourceTokenCount = 0;
  for (const token of source.folded.matchAll(searchTokenRuns)) {
    sourceTokenCount += 1;
    const found = matchingTerms(token[0], trie);
    prefixCharactersVisited += found.visited;
    if (found.terms.length > 0) {
      const visible = source.visibleSpan({
        start: token.index,
        end: token.index + token[0].length,
      });
      indexSearchEvidence(evidence, visible, found.terms);
    }
  }
  return {
    evidenceByTerm: evidence.evidenceByTerm,
    evidenceRangeVisits: evidence.rangeVisits,
    evidenceRangeWrites: evidence.rangeWrites,
    evidenceWindowCount: evidence.evidenceByBounds.size,
    prefixCharactersVisited,
    sourceTokenCount,
  };
};
