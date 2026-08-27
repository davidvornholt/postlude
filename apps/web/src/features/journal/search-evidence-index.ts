export type SearchSpan = { readonly start: number; readonly end: number };

export type SearchEvidence = SearchSpan & {
  readonly matches: ReadonlyArray<SearchSpan>;
};

export type SearchEvidenceBounds = (anchor: number) => SearchSpan;

type MutableSearchEvidence = SearchSpan & {
  readonly matches: Array<SearchSpan>;
};

export type SearchEvidenceIndex = {
  readonly activeEvidence: Set<MutableSearchEvidence>;
  readonly boundsAt: SearchEvidenceBounds;
  readonly evidenceByBounds: Map<string, MutableSearchEvidence>;
  readonly evidenceByTerm: Map<string, MutableSearchEvidence>;
  readonly recentMatches: Array<SearchSpan>;
  rangeVisits: number;
  rangeWrites: number;
  recentMatchStart: number;
};

const recentMatchCompactionThreshold = 128;

export const searchEvidenceIndexOf = (
  boundsAt: SearchEvidenceBounds,
): SearchEvidenceIndex => ({
  activeEvidence: new Set(),
  boundsAt,
  evidenceByBounds: new Map(),
  evidenceByTerm: new Map(),
  recentMatches: [],
  rangeVisits: 0,
  rangeWrites: 0,
  recentMatchStart: 0,
});

const pruneRecentMatches = (
  index: SearchEvidenceIndex,
  start: number,
): void => {
  let oldest = index.recentMatches[index.recentMatchStart];
  while (oldest !== undefined && oldest.start < start) {
    index.recentMatchStart += 1;
    oldest = index.recentMatches[index.recentMatchStart];
  }
  if (
    index.recentMatchStart > recentMatchCompactionThreshold &&
    index.recentMatchStart * 2 > index.recentMatches.length
  ) {
    index.recentMatches.splice(0, index.recentMatchStart);
    index.recentMatchStart = 0;
  }
};

const appendToActiveEvidence = (
  index: SearchEvidenceIndex,
  match: SearchSpan,
): void => {
  for (const evidence of index.activeEvidence) {
    index.rangeVisits += 1;
    if (match.end > evidence.end) {
      index.activeEvidence.delete(evidence);
    } else {
      evidence.matches.push(match);
      index.rangeWrites += 1;
    }
  }
};

const evidenceAt = (
  index: SearchEvidenceIndex,
  bounds: SearchSpan,
): MutableSearchEvidence => {
  const key = `${bounds.start}:${bounds.end}`;
  const known = index.evidenceByBounds.get(key);
  if (known !== undefined) {
    return known;
  }
  const matches: Array<SearchSpan> = [];
  const recent = index.recentMatches.slice(index.recentMatchStart);
  for (const match of recent) {
    index.rangeVisits += 1;
    if (match.end <= bounds.end) {
      matches.push(match);
    }
  }
  const evidence = { ...bounds, matches };
  index.evidenceByBounds.set(key, evidence);
  index.activeEvidence.add(evidence);
  index.rangeWrites += matches.length;
  return evidence;
};

export const indexSearchEvidence = (
  index: SearchEvidenceIndex,
  match: SearchSpan,
  terms: ReadonlyArray<string>,
): void => {
  const bounds = index.boundsAt(match.start);
  pruneRecentMatches(index, bounds.start);
  index.recentMatches.push(match);
  appendToActiveEvidence(index, match);
  let evidence: MutableSearchEvidence | undefined;
  for (const term of terms) {
    if (!index.evidenceByTerm.has(term)) {
      evidence ??= evidenceAt(index, bounds);
      index.evidenceByTerm.set(term, evidence);
    }
  }
};
