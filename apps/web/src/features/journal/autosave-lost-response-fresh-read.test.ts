/**
 * A fresh server copy after a lost save: the tab builds on it only when it is
 * the tab's own lost write, and otherwise still reports another tab's change.
 */

import { describe, expect, it } from 'bun:test';

import { saveStatus } from './autosave.ts';
import {
  conflictKeeping,
  observe,
  openDay,
  original,
  reloadRoute,
  savedAs,
  saveFromAnotherTab,
  settleEffects,
} from './autosave-lost-response.test-support.ts';

const loseSave = async (day: ReturnType<typeof openDay>): Promise<void> => {
  day.server.loseNextResponse();
  day.coordinator.edit({ journalMarkdown: 'A' });
  day.coordinator.flush();
  day.server.dropResponses();
  await settleEffects();
};

describe("a fresh read showing the tab's own lost save", () => {
  it('rebases the next save onto it', async () => {
    const day = openDay();
    await loseSave(day);
    day.coordinator.edit({ journalMarkdown: 'AB' });
    reloadRoute(day);
    await settleEffects();

    expect(day.server.held()).toMatchObject({
      draft: { journalMarkdown: 'AB' },
      revision: 3,
    });
    expect(observe(day)).toEqual(savedAs('AB'));
  });

  it('rebases after the retry was already refused', async () => {
    const day = openDay();
    await loseSave(day);
    day.coordinator.edit({ journalMarkdown: 'AB' });
    await settleEffects();
    expect(day.coordinator.snapshot().failure?.kind).toBe('conflict');

    reloadRoute(day);
    await settleEffects();

    expect(day.server.held().draft.journalMarkdown).toBe('AB');
    expect(observe(day)).toEqual(savedAs('AB'));
  });

  it('rebases when the fresh read arrives during the retry', async () => {
    const day = openDay();
    await loseSave(day);
    day.server.holdNextResponse();
    day.coordinator.edit({ journalMarkdown: 'AB' });
    await settleEffects();
    expect(saveStatus(day.coordinator.snapshot())).toBe('saving');

    reloadRoute(day);
    day.server.releaseResponses();
    await settleEffects();

    expect(day.server.held()).toMatchObject({
      draft: { journalMarkdown: 'AB' },
      revision: 3,
    });
    expect(observe(day)).toEqual(savedAs('AB'));
  });

  it('rebases when the server rewrote the passage line', async () => {
    const day = openDay();
    day.server.loseNextResponse();
    day.coordinator.edit({
      journalMarkdown: 'A',
      scriptureReference: 'joh 3,16',
    });
    day.coordinator.flush();
    day.server.dropResponses();
    await settleEffects();
    expect(day.server.held().draft.scriptureReference).toBe('John 3:16');

    day.coordinator.edit({ journalMarkdown: 'AB' });
    reloadRoute(day);
    await settleEffects();

    expect(day.server.held()).toMatchObject({
      draft: { journalMarkdown: 'AB', scriptureReference: 'John 3:16' },
      revision: 3,
    });
    expect(saveStatus(day.coordinator.snapshot())).toBe('saved');
  });
});

describe('building on the own lost save keeps what the writer meant', () => {
  it('saves an undo made while the refused retry was in flight', async () => {
    const day = openDay();
    await loseSave(day);
    day.server.holdNextResponse();
    day.coordinator.edit({ journalMarkdown: 'AB' });
    await settleEffects();
    day.coordinator.edit({ journalMarkdown: original.journalMarkdown });

    reloadRoute(day);
    day.server.releaseResponses();
    await settleEffects();

    expect(day.server.held()).toMatchObject({
      draft: { journalMarkdown: original.journalMarkdown },
      revision: 3,
    });
    expect(observe(day)).toEqual(savedAs(original.journalMarkdown));
  });

  it('saves an undo made while a retry of the lost text was in flight', async () => {
    const day = openDay();
    await loseSave(day);
    day.server.holdNextResponse();
    day.coordinator.flush();
    await settleEffects();
    day.coordinator.edit({ journalMarkdown: original.journalMarkdown });

    reloadRoute(day);
    day.server.releaseResponses();
    await settleEffects();

    expect(day.server.held()).toMatchObject({
      draft: { journalMarkdown: original.journalMarkdown },
      revision: 3,
    });
    expect(observe(day)).toEqual(savedAs(original.journalMarkdown));
  });

  it.each(['John 3:16-16', 'Johannes 3:16', 'joh 3,16'])(
    'rebases while the stored passage line %p stays as it was',
    async (line) => {
      const day = openDay(undefined, { ...original, scriptureReference: line });
      await loseSave(day);
      expect(day.server.held().draft.scriptureReference).toBe(line);

      day.coordinator.edit({ journalMarkdown: 'AB' });
      reloadRoute(day);
      await settleEffects();

      expect(day.server.held()).toMatchObject({
        draft: { journalMarkdown: 'AB', scriptureReference: line },
        revision: 3,
      });
      expect(observe(day)).toEqual(savedAs('AB'));
    },
  );
});

describe("a fresh read showing another tab's save", () => {
  it('reports another tab whose save arrives during the retry', async () => {
    const day = openDay();
    await loseSave(day);
    await saveFromAnotherTab(day.server, 'Other tab');
    day.server.holdNextResponse();
    day.coordinator.edit({ journalMarkdown: 'AB' });
    await settleEffects();

    reloadRoute(day);
    day.server.releaseResponses();
    await settleEffects();

    expect(day.server.held().draft.journalMarkdown).toBe('Other tab');
    expect(day.coordinator.snapshot().failure?.kind).toBe('conflict');
    expect(observe(day)).toEqual(conflictKeeping('AB'));
  });

  it('reports a newer save from another tab', async () => {
    const day = openDay();
    await loseSave(day);
    await saveFromAnotherTab(day.server, 'Other tab');
    day.coordinator.edit({ journalMarkdown: 'AB' });
    reloadRoute(day);
    await settleEffects();

    expect(day.server.held().draft.journalMarkdown).toBe('Other tab');
    expect(day.coordinator.snapshot().failure?.kind).toBe('conflict');
    expect(observe(day)).toEqual(conflictKeeping('AB'));
  });

  it('reports another tab when the lost save never committed', async () => {
    const day = openDay(
      (server) => (draft) =>
        draft.journalMarkdown === 'A'
          ? Promise.reject(new TypeError('Failed to fetch'))
          : server.save(draft),
    );
    day.coordinator.edit({ journalMarkdown: 'A' });
    day.coordinator.flush();
    await settleEffects();
    await saveFromAnotherTab(day.server, 'Other tab');
    day.coordinator.edit({ journalMarkdown: 'AB' });
    reloadRoute(day);
    await settleEffects();

    expect(day.server.held()).toMatchObject({
      draft: { journalMarkdown: 'Other tab' },
      revision: 2,
    });
    expect(observe(day)).toEqual(conflictKeeping('AB'));
  });

  it('reports another tab that wrote the same text later', async () => {
    const day = openDay();
    await loseSave(day);
    await saveFromAnotherTab(day.server, 'Other tab');
    await saveFromAnotherTab(day.server, 'A');
    day.coordinator.edit({ journalMarkdown: 'AB' });
    reloadRoute(day);
    await settleEffects();

    expect(day.server.held()).toMatchObject({
      draft: { journalMarkdown: 'A' },
      revision: 4,
    });
    expect(observe(day)).toEqual(conflictKeeping('AB'));
  });
});
