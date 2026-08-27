import type { EntryDraft } from './schemas/entry.ts';
import { parseScriptureReference } from './scripture-reference.ts';

export type SaveStatus = 'saving' | 'failed' | 'unsaved' | 'saved';

export type AutosaveFailure =
  | {
      readonly kind: 'validation';
      readonly field: 'scriptureReference';
      readonly message: string;
    }
  | {
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
  /** The last actionable failure, cleared by recovery or a confirmed save. */
  readonly failure: AutosaveFailure | undefined;
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
});

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
  if (sameDraft(state.draft, state.stored.draft)) {
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
  };
  return sameDraft(settled.draft, settled.stored.draft)
    ? [settled, []]
    : [
        { ...settled, inFlight: rebasedDraft },
        [{ _tag: 'save', draft: rebasedDraft }],
      ];
};

/** Ignore a stale failure or an in-flight failure after an undo. */
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
  if (sameDraft(state.draft, state.stored.draft)) {
    return [
      { ...state, inFlight: undefined, failure: undefined },
      [{ _tag: 'cancel' }],
    ];
  }
  if (!sameDraft(state.draft, state.inFlight)) {
    const correctedReference =
      failure.kind === 'validation' &&
      (state.draft.scriptureReference.trim() === '' ||
        parseScriptureReference(state.draft.scriptureReference) !== undefined);
    if (failure.kind !== 'validation' || correctedReference) {
      return [
        {
          ...state,
          inFlight: state.draft,
          failure: correctedReference ? undefined : failure,
        },
        [{ _tag: 'save', draft: state.draft }],
      ];
    }
  }
  return [{ ...state, inFlight: undefined, failure }, []];
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
  const referenceChanged =
    state.failure?.kind === 'validation' &&
    draft.scriptureReference !== state.draft.scriptureReference;
  const correctedValidation =
    referenceChanged &&
    (draft.scriptureReference.trim() === '' ||
      parseScriptureReference(draft.scriptureReference) !== undefined);
  const edited: AutosaveState = {
    ...state,
    draft,
    failure: correctedValidation ? undefined : state.failure,
  };

  if (state.inFlight === undefined && sameDraft(draft, state.stored.draft)) {
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
