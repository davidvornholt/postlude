/**
 * When a typed draft becomes a stored one.
 *
 * Postlude saves as you write, so nothing is ever "submitted" and there is no
 * moment where losing the page would lose the evening. That makes the ordering
 * the whole problem: a writer types faster than a round trip, and a naive
 * "save on every keystroke" produces overlapping writes whose replies can come
 * back in any order, the last of which would decide what the table holds.
 *
 * This module is the rule, and only the rule. It holds no timer and makes no
 * request: it takes what happened and returns what should be true next, plus
 * what the caller should go and do. That is what lets every case below be
 * tested as plain values — including the ones a browser produces once a month,
 * like a reply arriving after the writer has already typed something newer.
 *
 * One save is in flight at a time, always. Edits made while a save is in the
 * air are not queued behind it; they simply become the next save, once, when
 * the reply lands. So a burst of typing costs two writes rather than twenty,
 * and the last write always carries the newest text.
 */

import type { EntryDraft } from './schemas/entry.ts';

/** What the writer is told, in the order of urgency the page shows it in. */
export type SaveStatus = 'saving' | 'failed' | 'unsaved' | 'saved';

export type AutosaveFailure =
  | {
      readonly kind: 'validation';
      readonly field: 'scriptureReference';
      readonly message: string;
    }
  | {
      readonly kind: 'authentication' | 'network';
      readonly message: string;
    };

export type AutosaveState = {
  /** The newest text, whether or not anyone has been told about it yet. */
  readonly draft: EntryDraft;
  /** The newest text the server has confirmed it holds. */
  readonly stored: EntryDraft;
  /** The snapshot currently being written, or nothing when none is. */
  readonly inFlight: EntryDraft | undefined;
  /** The last actionable failure, cleared by recovery or a confirmed save. */
  readonly failure: AutosaveFailure | undefined;
};

/** Work the state machine asks its coordinator to perform. */
export type AutosaveCommand =
  | { readonly _tag: 'save'; readonly draft: EntryDraft }
  | { readonly _tag: 'schedule' }
  | { readonly _tag: 'cancel' };

/** Events from the editor, coordinator, and in-flight request. */
export type AutosaveEvent =
  | { readonly _tag: 'edited'; readonly draft: EntryDraft }
  | { readonly _tag: 'quiet' }
  | { readonly _tag: 'flush' }
  | { readonly _tag: 'stored' }
  | { readonly _tag: 'failed'; readonly failure: AutosaveFailure };

type Step = readonly [AutosaveState, ReadonlyArray<AutosaveCommand>];

/** Compare fields so object key order can never read as an edit. */
export const sameDraft = (a: EntryDraft, b: EntryDraft): boolean =>
  a.date === b.date &&
  a.journalMarkdown === b.journalMarkdown &&
  a.scriptureMarkdown === b.scriptureMarkdown &&
  a.scriptureReference === b.scriptureReference;

/** A page that has just opened: what is on screen is what the table holds. */
export const openAutosave = (stored: EntryDraft): AutosaveState => ({
  draft: stored,
  stored,
  inFlight: undefined,
  failure: undefined,
});

/**
 * What the writer is told. A save in the air outranks a past failure, and a
 * past failure outranks unsaved text, because "failed" is the only one of the
 * three that says something is wrong rather than merely pending.
 */
export const saveStatus = (state: AutosaveState): SaveStatus => {
  if (state.inFlight !== undefined) {
    return 'saving';
  }
  if (state.failure !== undefined) {
    return 'failed';
  }
  return sameDraft(state.draft, state.stored) ? 'saved' : 'unsaved';
};

/**
 * Starts a save, unless one is already in flight or there is nothing to write.
 * Shared by the two events that ask for one, so waiting for the quiet period
 * and pressing retry cannot drift apart.
 */
const beginSave = (state: AutosaveState): Step => {
  if (state.inFlight !== undefined) {
    return [state, []];
  }
  if (sameDraft(state.draft, state.stored)) {
    return [state, [{ _tag: 'cancel' }]];
  }
  return [
    { ...state, inFlight: state.draft },
    [{ _tag: 'save', draft: state.draft }],
  ];
};

/** Confirm the in-flight snapshot, then send any newer draft. */
const settleStored = (state: AutosaveState): Step => {
  if (state.inFlight === undefined) {
    return [state, []];
  }
  const settled: AutosaveState = {
    ...state,
    stored: state.inFlight,
    inFlight: undefined,
    failure: undefined,
  };
  return sameDraft(settled.draft, settled.stored)
    ? [settled, []]
    : [
        { ...settled, inFlight: settled.draft },
        [{ _tag: 'save', draft: settled.draft }],
      ];
};

/** Ignore a stale failure or an in-flight failure after an undo. */
const settleFailed = (state: AutosaveState, failure: AutosaveFailure): Step => {
  if (state.inFlight === undefined) {
    return [state, []];
  }
  if (sameDraft(state.draft, state.stored)) {
    return [
      { ...state, inFlight: undefined, failure: undefined },
      [{ _tag: 'cancel' }],
    ];
  }
  return [{ ...state, inFlight: undefined, failure }, []];
};

/**
 * Every event that carries nothing but its name, and what it settles into. A
 * record rather than a switch: the key type is the tag union, so adding an
 * event to `AutosaveEvent` and forgetting to handle it is a type error rather
 * than a case that quietly falls through.
 */
const settling: Record<
  Exclude<AutosaveEvent, { readonly _tag: 'edited' | 'failed' }>['_tag'],
  (state: AutosaveState) => Step
> = {
  quiet: beginSave,
  flush: beginSave,
  stored: settleStored,
};

const editDraft = (state: AutosaveState, draft: EntryDraft): Step => {
  const correctedValidation =
    state.failure?.kind === 'validation' &&
    draft.scriptureReference !== state.draft.scriptureReference;
  const edited: AutosaveState = {
    ...state,
    draft,
    failure: correctedValidation ? undefined : state.failure,
  };

  if (state.inFlight === undefined && sameDraft(draft, state.stored)) {
    return [{ ...edited, failure: undefined }, [{ _tag: 'cancel' }]];
  }
  return [edited, [{ _tag: 'schedule' }]];
};

/**
 * The rule itself: the state this event leaves behind, and what the caller
 * should do about it.
 *
 * An edit does not clear a past failure. The writer has unsaved text and the
 * last attempt to store it did not work, and both of those are still true
 * until a save succeeds; saying "unsaved" instead would quietly downgrade a
 * problem to a pending change.
 */
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
  return settling[event._tag](state);
};
