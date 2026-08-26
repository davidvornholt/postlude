import { describe, expect, it } from 'bun:test';
import { createDraftRecovery } from './recoverable-draft.ts';
import type { EntryDraft } from './schemas/entry.ts';

const draft: EntryDraft = {
  date: '2026-08-27',
  journalMarkdown: 'Still here.',
  scriptureMarkdown: '',
  scriptureReference: '',
};

const memoryStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value),
  };
};

describe('draft recovery', () => {
  it('keeps an unconfirmed draft in the current tab until it is cleared', () => {
    const recovery = createDraftRecovery(memoryStorage());

    recovery.retain(draft);
    expect(recovery.read(draft.date)).toEqual(draft);
    recovery.clear(draft.date);
    expect(recovery.read(draft.date)).toBeUndefined();
  });

  it('refuses malformed or cross-day browser data', () => {
    const storage = memoryStorage();
    const recovery = createDraftRecovery(storage);

    storage.setItem(
      'postlude:journal-draft:v1:2026-08-27',
      JSON.stringify({ ...draft, date: '2026-08-26' }),
    );
    expect(recovery.read(draft.date)).toBeUndefined();

    storage.setItem(
      'postlude:journal-draft:v1:2026-08-27',
      JSON.stringify({ ...draft, journalMarkdown: 42 }),
    );
    expect(recovery.read(draft.date)).toBeUndefined();
    expect(recovery.read(draft.date)).toBeUndefined();
  });
});
