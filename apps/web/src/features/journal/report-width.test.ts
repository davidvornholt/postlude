import { describe, expect, it } from 'bun:test';
import { createReportWidthMemory, reportWidthKey } from './report-width.ts';

const memoryStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
};

const refusingStorage = {
  getItem: (): string | null => {
    throw new Error('Storage is refused.');
  },
  setItem: (): void => {
    throw new Error('Storage is refused.');
  },
};

describe('report width memory', () => {
  it('starts in the column and remembers the width it was last given', () => {
    const memory = createReportWidthMemory(memoryStorage());

    expect(memory.read()).toBe('column');
    memory.remember('wide');
    expect(memory.read()).toBe('wide');
    memory.remember('column');
    expect(memory.read()).toBe('column');
  });

  it('reads anything it did not write as the column', () => {
    const storage = memoryStorage();
    storage.setItem(reportWidthKey, 'enormous');

    expect(createReportWidthMemory(storage).read()).toBe('column');
  });

  it('keeps working in the column when the browser refuses storage', () => {
    const memory = createReportWidthMemory(refusingStorage);

    expect(() => memory.remember('wide')).not.toThrow();
    expect(memory.read()).toBe('column');
  });
});
