import { describe, expect, it } from 'bun:test';
import { Effect, Layer } from 'effect';
import { AgentNoteGenerationError } from '../errors/journal-errors.ts';
import {
  abandonedNoteMessage,
  agentNoteViewOf,
  type StoredAgentNote,
} from '../schemas/agent-area.ts';
import { draft, journalDatabase } from '../testing/database-harness.ts';
import {
  type AgentNoteDraft,
  AgentNoteGenerator,
  type AgentNoteInput,
  agentNoteHistoryDays,
  notConfiguredMessage,
} from './agent-note-generator.ts';
import {
  AgentNotes,
  closedDayNeededMessage,
  unexpectedFailureMessage,
} from './agent-notes.ts';

const { withEvening } = journalDatabase();

const day = '2026-10-09';

/** `AgentNotes` with this generator, writing each note before returning. */
const notesWith = (
  generate: (
    input: AgentNoteInput,
  ) => Effect.Effect<AgentNoteDraft, AgentNoteGenerationError>,
) =>
  AgentNotes.pipe(
    Effect.provide(
      AgentNotes.layerAwaited.pipe(
        Layer.provide(
          Layer.succeed(
            AgentNoteGenerator,
            AgentNoteGenerator.of({ generate }),
          ),
        ),
      ),
    ),
  );

const notConfiguredNotes = AgentNotes.pipe(
  Effect.provide(
    AgentNotes.layerAwaited.pipe(
      Layer.provide(AgentNoteGenerator.notConfigured),
    ),
  ),
);

const writing = (note: string) => () =>
  Effect.succeed({ note, model: 'note-model' });

describe('closing a day', () => {
  it('writes the note from the day, its ratings, /wrap, and the days before', async () => {
    const inputs: Array<AgentNoteInput> = [];
    const outcome = await withEvening(({ entries, ratings }) =>
      Effect.gen(function* () {
        const notes = yield* notesWith((input) => {
          inputs.push(input);
          return Effect.succeed({ note: 'A steady day.', model: 'note-model' });
        });
        const entry = yield* entries.save(draft(day, 'Long walk, then work.'));
        yield* ratings.save({ date: day, energy: 'okay', progress: 'solid' });
        const closed = yield* notes.closeDay(day);
        return { entry, closed };
      }),
    );
    expect(inputs).toHaveLength(1);
    const [given] = inputs;
    expect(given?.entry.journalMarkdown).toBe('Long walk, then work.');
    expect(given?.rating.energy).toBe('okay');
    expect(given?.wrap.dayMetrics).toBeNull();
    expect(given?.history).toHaveLength(agentNoteHistoryDays);
    expect(given?.history.at(-1)?.date).toBe('2026-10-08');
    expect(outcome.closed.rating.closedAt).toBeInstanceOf(Date);
    expect(outcome.closed.agentNote).toMatchObject({
      status: 'ready',
      note: 'A steady day.',
      model: 'note-model',
      basedOnRevision: outcome.entry.revision,
      entryRevision: outcome.entry.revision,
      error: null,
    });
  });

  it('writes a note for a day with no entry from revision 0', async () => {
    const closed = await withEvening(({ ratings }) =>
      Effect.gen(function* () {
        const notes = yield* notesWith(writing('Nothing written.'));
        yield* ratings.save({ date: day, energy: 'okay', progress: 'solid' });
        return yield* notes.closeDay(day);
      }),
    );
    expect(closed.agentNote.status).toBe('ready');
    expect(closed.agentNote.basedOnRevision).toBe(0);
  });

  it('says plainly that no generator is set up', async () => {
    const closed = await withEvening(({ ratings }) =>
      Effect.gen(function* () {
        const notes = yield* notConfiguredNotes;
        yield* ratings.save({ date: day, energy: 'okay', progress: 'solid' });
        return yield* notes.closeDay(day);
      }),
    );
    expect(closed.rating.closedAt).toBeInstanceOf(Date);
    expect(closed.agentNote.status).toBe('failed');
    expect(closed.agentNote.error).toBe(notConfiguredMessage);
  });

  it('does not ask again for a day closed already', async () => {
    let calls = 0;
    await withEvening(({ ratings }) =>
      Effect.gen(function* () {
        const notes = yield* notesWith(() => {
          calls += 1;
          return Effect.succeed({ note: 'Once.', model: 'note-model' });
        });
        yield* ratings.save({ date: day, energy: 'okay', progress: 'solid' });
        yield* notes.closeDay(day);
        yield* notes.closeDay(day);
      }),
    );
    expect(calls).toBe(1);
  });
});

describe('a failed note', () => {
  it('keeps the previous note and shows why the new one failed', async () => {
    const note = await withEvening(({ ratings }) =>
      Effect.gen(function* () {
        yield* ratings.save({ date: day, energy: 'okay', progress: 'solid' });
        const first = yield* notesWith(writing('The first note.'));
        yield* first.closeDay(day);
        const failing = yield* notesWith(() =>
          Effect.fail(
            new AgentNoteGenerationError({ message: 'The model is busy.' }),
          ),
        );
        return yield* failing.regenerate(day);
      }),
    );
    expect(note.status).toBe('failed');
    expect(note.error).toBe('The model is busy.');
    expect(note.note).toBe('The first note.');
  });

  it('stores a generic message when the generator dies', async () => {
    const note = await withEvening(({ ratings }) =>
      Effect.gen(function* () {
        yield* ratings.save({ date: day, energy: 'okay', progress: 'solid' });
        const dying = yield* notesWith(() =>
          Effect.die(new Error('secret prompt text')),
        );
        return (yield* dying.closeDay(day)).agentNote;
      }),
    );
    expect(note.status).toBe('failed');
    expect(note.error).toBe(unexpectedFailureMessage);
  });
});

describe('regenerating', () => {
  it('needs a closed day', async () => {
    const error = await withEvening(({ ratings }) =>
      Effect.gen(function* () {
        const notes = yield* notesWith(writing('Never.'));
        yield* ratings.save({ date: day, energy: 'okay', progress: 'solid' });
        return yield* Effect.flip(notes.regenerate(day));
      }),
    );
    expect(error.message).toBe(closedDayNeededMessage);
  });

  it('replaces a stale note with one from the current entry', async () => {
    const outcome = await withEvening(({ entries, ratings }) =>
      Effect.gen(function* () {
        let version = 0;
        const notes = yield* notesWith(() => {
          version += 1;
          return Effect.succeed({
            note: `Note ${version}.`,
            model: 'note-model',
          });
        });
        const first = yield* entries.save(draft(day, 'First words.'));
        yield* ratings.save({ date: day, energy: 'okay', progress: 'solid' });
        yield* notes.closeDay(day);
        yield* entries.save(draft(day, 'Second words.', '', first.revision));
        const stale = yield* notes.read(day);
        const renewed = yield* notes.regenerate(day);
        return { stale, renewed };
      }),
    );
    expect(outcome.stale.status).toBe('stale');
    expect(outcome.stale.note).toBe('Note 1.');
    expect(outcome.renewed.status).toBe('ready');
    expect(outcome.renewed.note).toBe('Note 2.');
    expect(outcome.renewed.basedOnRevision).toBe(outcome.renewed.entryRevision);
  });

  it('leaves the note in place when the day is reopened', async () => {
    const note = await withEvening(({ ratings }) =>
      Effect.gen(function* () {
        const notes = yield* notesWith(writing('Kept.'));
        yield* ratings.save({ date: day, energy: 'okay', progress: 'solid' });
        yield* notes.closeDay(day);
        yield* ratings.reopen(day);
        return yield* notes.read(day);
      }),
    );
    expect(note.status).toBe('ready');
    expect(note.note).toBe('Kept.');
  });
});

describe('the note as the page shows it', () => {
  const stored: StoredAgentNote = {
    status: 'pending',
    note: null,
    model: null,
    basedOnRevision: null,
    error: null,
    requestedAt: new Date('2026-10-09T20:00:00Z'),
    generatedAt: null,
    entryRevision: 3,
  };

  it('shows a recent request as pending', () => {
    const view = agentNoteViewOf(stored, new Date('2026-10-09T20:14:00Z'));
    expect(view.status).toBe('pending');
  });

  it('shows a request lost to a restart as failed', () => {
    const view = agentNoteViewOf(stored, new Date('2026-10-09T20:16:00Z'));
    expect(view.status).toBe('failed');
    expect(view.error).toBe(abandonedNoteMessage);
  });
});
