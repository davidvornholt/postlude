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

export type AutosaveState = {
  /** The newest text, whether or not anyone has been told about it yet. */
  readonly draft: EntryDraft;
  /** The newest text the server has confirmed it holds. */
  readonly stored: EntryDraft;
  /** The snapshot currently being written, or nothing when none is. */
  readonly inFlight: EntryDraft | undefined;
  /** Whether the last attempt came back a failure. Cleared by a success. */
  readonly failed: boolean;
};

/**
 * What the caller has to go and do. `schedule` restarts the quiet period a
 * save waits for; `cancel` calls it off, which matters when the writer undoes
 * their way back to the stored text and there is no longer anything to write.
 */
export type AutosaveCommand =
  | { readonly _tag: 'save'; readonly draft: EntryDraft }
  | { readonly _tag: 'schedule' }
  | { readonly _tag: 'cancel' };

/**
 * `quiet` is the scheduled save coming due. `flush` is every reason to save
 * without waiting — leaving the field, leaving the page, pressing retry.
 * `stored` and `failed` are how the in-flight save ended.
 */
export type AutosaveEvent =
  | { readonly _tag: 'edited'; readonly draft: EntryDraft }
  | { readonly _tag: 'quiet' }
  | { readonly _tag: 'flush' }
  | { readonly _tag: 'stored' }
  | { readonly _tag: 'failed' };

type Step = readonly [AutosaveState, ReadonlyArray<AutosaveCommand>];

/**
 * Whether two drafts say the same thing. Field by field rather than by
 * serialising both, so a key order the browser chose can never read as an edit
 * and start a write nobody asked for.
 */
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
  failed: false,
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
  if (state.failed) {
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

/**
 * The reply landed and the row now holds what was sent. What was sent is read
 * off the state rather than off the event, so a reply cannot claim to have
 * stored text that was never in the air — the newer text the writer typed
 * meanwhile stays unstored, and is written next.
 */
const settleStored = (state: AutosaveState): Step => {
  if (state.inFlight === undefined) {
    return [state, []];
  }
  const settled: AutosaveState = {
    ...state,
    stored: state.inFlight,
    inFlight: undefined,
    failed: false,
  };
  return sameDraft(settled.draft, settled.stored)
    ? [settled, []]
    : [
        { ...settled, inFlight: settled.draft },
        [{ _tag: 'save', draft: settled.draft }],
      ];
};

/**
 * The attempt came back a failure. A failure with nothing in the air is a reply
 * to a save this rule no longer believes in — a stale round trip — and marking
 * the page failed on the strength of it would show an error for a write that
 * has already been superseded.
 */
const settleFailed = (state: AutosaveState): Step =>
  state.inFlight === undefined
    ? [state, []]
    : [{ ...state, inFlight: undefined, failed: true }, []];

/**
 * Every event that carries nothing but its name, and what it settles into. A
 * record rather than a switch: the key type is the tag union, so adding an
 * event to `AutosaveEvent` and forgetting to handle it is a type error rather
 * than a case that quietly falls through.
 */
const settling: Record<
  Exclude<AutosaveEvent, { readonly _tag: 'edited' }>['_tag'],
  (state: AutosaveState) => Step
> = {
  quiet: beginSave,
  flush: beginSave,
  stored: settleStored,
  failed: settleFailed,
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
): Step =>
  event._tag === 'edited'
    ? [{ ...state, draft: event.draft }, [{ _tag: 'schedule' }]]
    : settling[event._tag](state);
