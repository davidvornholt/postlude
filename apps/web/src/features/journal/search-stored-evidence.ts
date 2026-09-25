import type { SearchDocument } from './search-document.ts';
import { normalizeSearchText } from './search-query.ts';
import { searchSourceTokens } from './search-source-scan.ts';

const whitespaceRuns = /\s+/gu;
const horizontalWhitespaceRuns = /[^\S\n]+/gu;
const lineBreakRuns = /\n+/gu;
const leadingContext = 60;
const excerptCharacters = 240;
const maximumCodeUnitsPerCharacter = 2;
const lowSurrogateStart = 0xdc_00;
const lowSurrogateEnd = 0xdf_ff;

export type StoredSearchEvidence = {
  readonly kind: 'evening' | 'scripture-notes' | 'passage-reference';
  readonly token: string;
  readonly position: number;
  readonly excerpt: string;
  readonly matchStart: number;
  readonly matchLength: number;
};

const evidenceWindow = (
  text: string,
  kind: StoredSearchEvidence['kind'],
  found: {
    readonly token: string;
    readonly start: number;
    readonly end: number;
  },
): StoredSearchEvidence => {
  const hardLines = kind === 'passage-reference';
  const lineStart = hardLines ? text.lastIndexOf('\n', found.start) + 1 : 0;
  const nextLine = hardLines ? text.indexOf('\n', found.start) : -1;
  const lineEnd = nextLine === -1 ? text.length : nextLine;
  let start = Math.max(lineStart, found.start - leadingContext);
  const first = text.charCodeAt(start);
  if (first >= lowSurrogateStart && first <= lowSurrogateEnd) {
    start += 1;
  }
  const available = text.slice(
    start,
    Math.min(lineEnd, start + excerptCharacters * maximumCodeUnitsPerCharacter),
  );
  const excerpt = Array.from(available).slice(0, excerptCharacters).join('');
  const matchStart = Array.from(text.slice(start, found.start)).length;
  const matchEnd = Array.from(
    text.slice(start, Math.min(found.end, start + excerpt.length)),
  ).length;
  return {
    kind,
    token: found.token,
    position: found.start,
    excerpt,
    matchStart,
    matchLength: matchEnd - matchStart,
  };
};

const sourceEvidence = (
  raw: string,
  kind: StoredSearchEvidence['kind'],
): ReadonlyArray<StoredSearchEvidence> => {
  const hardLines = kind === 'passage-reference';
  const normalized = normalizeSearchText(raw);
  const text = hardLines
    ? normalized
        .replace(horizontalWhitespaceRuns, ' ')
        .replace(lineBreakRuns, '\n')
        .trim()
    : normalized.replace(whitespaceRuns, ' ').trim();
  const seen = new Set<string>();
  const result: Array<StoredSearchEvidence> = [];
  for (const found of searchSourceTokens(text)) {
    if (!seen.has(found.token)) {
      seen.add(found.token);
      result.push(evidenceWindow(text, kind, found));
    }
  }
  return result;
};

/** One small window per distinct canonical token, computed only when prose changes. */
export const storedSearchEvidence = (
  document: Pick<
    SearchDocument,
    'journalText' | 'scriptureText' | 'scriptureReferenceText'
  >,
): ReadonlyArray<StoredSearchEvidence> => [
  ...sourceEvidence(document.journalText, 'evening'),
  ...sourceEvidence(document.scriptureText, 'scripture-notes'),
  ...sourceEvidence(document.scriptureReferenceText, 'passage-reference'),
];
