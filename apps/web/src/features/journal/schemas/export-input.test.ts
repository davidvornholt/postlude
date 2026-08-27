import { describe, expect, it } from 'bun:test';

import { decodeExportInput } from './export-input.ts';

describe('decodeExportInput', () => {
  it('keeps an explicit supported grouping', () => {
    expect(decodeExportInput({ grouping: 'month' })).toEqual({
      grouping: 'month',
    });
  });

  it('treats an omitted grouping as the former day-only export', () => {
    expect(decodeExportInput({})).toEqual({ grouping: 'day' });
    expect(decodeExportInput(undefined)).toEqual({ grouping: 'day' });
  });

  it('rejects a grouping the server does not implement', () => {
    expect(() => decodeExportInput({ grouping: 'quarter' })).toThrow();
  });
});
