import type { SearchDocument } from './search-document.ts';
import { normalizeSearchText } from './search-query.ts';
import { searchSourceTokens } from './search-source-scan.ts';

const whitespaceRuns = /\s+/gu;
const horizontalWhitespaceRuns = /[^\S\n]+/gu;
const lineBreakRuns = /\n+/gu;
/** A blank line, however much other whitespace surrounds it. */
const paragraphBreaks = /\n[^\S\n]*\n\s*/gu;
const leadingContext = 60;
const excerptCharacters = 240;
const maximumCodeUnitsPerCharacter = 2;
const lowSurrogateStart = 0xdc_00;
const lowSurrogateEnd = 0xdf_ff;

export type StoredSearchEvidence = {
  readonly kind:
    | 'evening'
    | 'scripture-notes'
    | 'passage-reference'
    | 'day-log';
  readonly token: string;
  readonly position: number;
  readonly excerpt: string;
  readonly matchStart: number;
  readonly matchLength: number;
  readonly anchorLength: number;
};

/** Whether a window stays on the line its match is on. */
const keepsLines = (kind: StoredSearchEvidence['kind']) =>
  kind === 'passage-reference' || kind === 'day-log';

const evidenceWindow = (
  text: string,
  kind: StoredSearchEvidence['kind'],
  found: {
    readonly token: string;
    readonly start: number;
    readonly end: number;
    readonly anchorEnd: number;
  },
): StoredSearchEvidence => {
  const anchorLength = Array.from(
    text.slice(found.start, found.anchorEnd),
  ).length;
  const [firstCanonicalCharacter] = Array.from(found.token);
  const canonicalComponents = Array.from(
    firstCanonicalCharacter?.normalize('NFD') ?? '',
  ).length;
  if (anchorLength > canonicalComponents) {
    // Canonical composition can jump over arbitrarily many intervening marks.
    // In that case show the actual canonical token, rather than a clipped
    // source fragment that no longer represents its matching character.
    const excerpt = Array.from(found.token)
      .slice(0, excerptCharacters)
      .join('');
    return {
      kind,
      token: found.token,
      position: found.start,
      excerpt,
      matchStart: 0,
      matchLength: Array.from(excerpt).length,
      anchorLength: 1,
    };
  }
  const hardLines = keepsLines(kind);
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
    anchorLength,
  };
};

/**
 * The text whose windows are stored. A passage reference keeps one rendering
 * per line, and a day log one paragraph per line, so a window never runs into
 * the next one: a day log's paragraph may begin with its own time range.
 */
const evidenceText = (raw: string, kind: StoredSearchEvidence['kind']) => {
  const normalized = normalizeSearchText(raw);
  switch (kind) {
    case 'passage-reference':
      return normalized
        .replace(horizontalWhitespaceRuns, ' ')
        .replace(lineBreakRuns, '\n')
        .trim();
    case 'day-log':
      return normalized
        .split(paragraphBreaks)
        .map((paragraph) => paragraph.replace(whitespaceRuns, ' ').trim())
        .filter((paragraph) => paragraph !== '')
        .join('\n');
    default:
      return normalized.replace(whitespaceRuns, ' ').trim();
  }
};

const sourceEvidence = (
  raw: string,
  kind: StoredSearchEvidence['kind'],
): ReadonlyArray<StoredSearchEvidence> => {
  const text = evidenceText(raw, kind);
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

/** The day log's windows, computed when /wrap stores the log. */
export const dayLogSearchEvidence = (
  dayLog: string,
): ReadonlyArray<StoredSearchEvidence> => sourceEvidence(dayLog, 'day-log');
