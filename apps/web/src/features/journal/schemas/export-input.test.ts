import { describe, expect, it } from 'bun:test';

import { decodeExportFormData, decodeExportInput } from './export-input.ts';

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

  it('decodes native form data and defaults an older field-less POST', () => {
    const explicit = new FormData();
    explicit.set('grouping', 'week');
    expect(decodeExportFormData(explicit)).toEqual({ grouping: 'week' });
    expect(decodeExportFormData(new FormData())).toEqual({ grouping: 'day' });
  });
});
