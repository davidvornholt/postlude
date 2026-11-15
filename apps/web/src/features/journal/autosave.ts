import type { EntryDraft } from './schemas/entry.ts';

export type SaveStatus = 'saving' | 'failed' | 'unsaved' | 'saved';

export type AutosaveFailure = {
  /** `network` is any failure without a clear answer, so it may have committed. */
  readonly kind: 'authentication' | 'conflict' | 'network';
  readonly message: string;
};

export type AutosaveState = {
  /** The newest text, whether or not anyone has been told about it yet. */
  readonly draft: EntryDraft;
  /** The newest text the server has confirmed it holds. */
  readonly stored: ConfirmedDraft;
  /** The snapshot currently being written, or nothing when none is. */
  readonly inFlight: EntryDraft | undefined;
  /** Conflicts stay actionable and block writes until current prose matches. */
  readonly failure: AutosaveFailure | undefined;
  /**
   * Sent snapshots whose network failure may have hidden a committed write.
   * While there are any, the last confirmed copy proves nothing and even an
   * undo back to it has to be sent. Later failures, such as an expired
   * sign-in, say nothing about those writes, so only a confirmed save or a
   * fresh server copy clears them. A fresh copy that equals one of them at the
   * revision it would have created is this tab's own write.
   */
  readonly unconfirmedWrites: ReadonlyArray<EntryDraft>;
};

export type ConfirmedDraft = {
  readonly draft: EntryDraft;
  readonly revision: number;
};

export type AutosaveCommand =
  | { readonly _tag: 'save'; readonly draft: EntryDraft }
  | { readonly _tag: 'schedule' }
  | { readonly _tag: 'cancel' };

export type AutosaveEvent =
  | { readonly _tag: 'edited'; readonly draft: EntryDraft }
  | { readonly _tag: 'quiet' }
  | { readonly _tag: 'flush' }
  | { readonly _tag: 'stored'; readonly revision: number }
  | { readonly _tag: 'failed'; readonly failure: AutosaveFailure };

type Step = readonly [AutosaveState, ReadonlyArray<AutosaveCommand>];

export const sameDraft = (a: EntryDraft, b: EntryDraft): boolean =>
  a.date === b.date &&
  a.journalMarkdown === b.journalMarkdown &&
  a.scriptureMarkdown === b.scriptureMarkdown &&
  a.scriptureReference === b.scriptureReference;

/** A page that has just opened: what is on screen is what the table holds. */
export const openAutosave = (stored: ConfirmedDraft): AutosaveState => ({
  draft: stored.draft,
  stored,
  inFlight: undefined,
  failure: undefined,
  unconfirmedWrites: [],
});

export const hasUnconfirmedWrite = (state: AutosaveState): boolean =>
  state.unconfirmedWrites.length > 0;

const rememberedUnconfirmedWrites = 10;

/**
 * Keep the first unconfirmed write and the latest ones. The first is the
 * likeliest to have committed, because a dropped connection usually fails every
 * later send before it reaches the server; the latest cover a flaky
 * connection. A write that falls out only means its fresh copy is reported as
 * a conflict, as for another tab's save.
 */
const rememberUnconfirmedWrite = (
  writes: ReadonlyArray<EntryDraft>,
  sent: EntryDraft,
): ReadonlyArray<EntryDraft> => {
  const remembered = [...writes, sent];
  return remembered.length <= rememberedUnconfirmedWrites
    ? remembered
    : [remembered[0], ...remembered.slice(1 - rememberedUnconfirmedWrites)];
};

export const saveStatus = (state: AutosaveState): SaveStatus => {
  if (state.inFlight !== undefined) {
    return 'saving';
  }
  if (state.failure !== undefined) {
    return 'failed';
  }
  return sameDraft(state.draft, state.stored.draft) ? 'saved' : 'unsaved';
};

const beginSave = (state: AutosaveState): Step => {
  if (state.inFlight !== undefined) {
    return [state, []];
  }
  if (state.failure?.kind === 'conflict') {
    return [state, [{ _tag: 'cancel' }]];
  }
  if (
    !hasUnconfirmedWrite(state) &&
    sameDraft(state.draft, state.stored.draft)
  ) {
    return [state, [{ _tag: 'cancel' }]];
  }
  return [
    { ...state, inFlight: state.draft },
    [{ _tag: 'save', draft: state.draft }],
  ];
};

/** Confirm the in-flight snapshot, then send any newer draft. */
const settleStored = (state: AutosaveState, revision: number): Step => {
  if (state.inFlight === undefined) {
    return [state, []];
  }
  const confirmedDraft = { ...state.inFlight, baseRevision: revision };
  const rebasedDraft = { ...state.draft, baseRevision: revision };
  const settled: AutosaveState = {
    ...state,
    draft: rebasedDraft,
    stored: { draft: confirmedDraft, revision },
    inFlight: undefined,
    failure: undefined,
    unconfirmedWrites: [],
  };
  return sameDraft(settled.draft, settled.stored.draft)
    ? [settled, []]
    : [
        { ...settled, inFlight: rebasedDraft },
        [{ _tag: 'save', draft: rebasedDraft }],
      ];
};

/**
 * Ignore a stale failure. Newer prose, an undo included, is sent against the
 * same base revision: if the failed write was committed, the server refuses it
 * as a conflict instead of overwriting anything.
 */
const settleFailed = (state: AutosaveState, failure: AutosaveFailure): Step => {
  if (state.inFlight === undefined) {
    return [state, []];
  }
  if (failure.kind === 'conflict') {
    const recoverableDraft = sameDraft(state.draft, state.stored.draft)
      ? state.inFlight
      : state.draft;
    return [
      {
        ...state,
        draft: recoverableDraft,
        inFlight: undefined,
        failure,
      },
      [{ _tag: 'cancel' }],
    ];
  }
  if (
    failure.kind === 'authentication' &&
    !hasUnconfirmedWrite(state) &&
    sameDraft(state.draft, state.stored.draft)
  ) {
    // A refused sign-in wrote nothing, so the undo is what the server holds.
    return [
      { ...state, inFlight: undefined, failure: undefined },
      [{ _tag: 'cancel' }],
    ];
  }
  const failed: AutosaveState = {
    ...state,
    failure,
    unconfirmedWrites:
      failure.kind === 'network'
        ? rememberUnconfirmedWrite(state.unconfirmedWrites, state.inFlight)
        : state.unconfirmedWrites,
  };
  if (!sameDraft(state.draft, state.inFlight)) {
    return [
      { ...failed, inFlight: state.draft },
      [{ _tag: 'save', draft: state.draft }],
    ];
  }
  return [{ ...failed, inFlight: undefined }, []];
};

const settling: Record<
  Exclude<
    AutosaveEvent,
    { readonly _tag: 'edited' | 'failed' | 'stored' }
  >['_tag'],
  (state: AutosaveState) => Step
> = {
  quiet: beginSave,
  flush: beginSave,
};

const editDraft = (state: AutosaveState, draft: EntryDraft): Step => {
  const edited: AutosaveState = { ...state, draft };

  if (
    state.inFlight === undefined &&
    !hasUnconfirmedWrite(state) &&
    sameDraft(draft, state.stored.draft)
  ) {
    return state.failure?.kind === 'conflict'
      ? [edited, [{ _tag: 'cancel' }]]
      : [{ ...edited, failure: undefined }, [{ _tag: 'cancel' }]];
  }
  return [edited, [{ _tag: 'schedule' }]];
};

export const advanceAutosave = (
  state: AutosaveState,
  event: AutosaveEvent,
): Step => {
  if (event._tag === 'edited') {
    return editDraft(state, event.draft);
  }
  if (event._tag === 'failed') {
    return settleFailed(state, event.failure);
  }
  if (event._tag === 'stored') {
    return settleStored(state, event.revision);
  }
  return settling[event._tag](state);
};
