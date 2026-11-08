import { describe, expect, it } from 'bun:test';

import { dayPickerTarget, sameDayIn } from './day-picker-keys.ts';

describe('dayPickerTarget', () => {
  it('moves by a day and by a week', () => {
    expect(dayPickerTarget('ArrowLeft', false, '2026-11-01')).toBe(
      '2026-10-31',
    );
    expect(dayPickerTarget('ArrowRight', false, '2026-11-07')).toBe(
      '2026-11-08',
    );
    expect(dayPickerTarget('ArrowUp', false, '2026-11-07')).toBe('2026-10-31');
    expect(dayPickerTarget('ArrowDown', false, '2026-11-07')).toBe(
      '2026-11-14',
    );
  });

  it('goes to the edges of the week, which runs Monday to Sunday', () => {
    // 2026-11-07 is a Saturday.
    expect(dayPickerTarget('Home', false, '2026-11-07')).toBe('2026-11-02');
    expect(dayPickerTarget('End', false, '2026-11-07')).toBe('2026-11-08');
  });

  it('moves by a month, or by a year with Shift, keeping the nearest day', () => {
    expect(dayPickerTarget('PageUp', false, '2026-03-31')).toBe('2026-02-28');
    expect(dayPickerTarget('PageDown', false, '2026-01-31')).toBe('2026-02-28');
    expect(dayPickerTarget('PageUp', true, '2024-02-29')).toBe('2023-02-28');
    expect(dayPickerTarget('PageDown', true, '2026-11-07')).toBe('2027-11-07');
  });

  it('stops at the first and last day the journal can hold', () => {
    expect(dayPickerTarget('ArrowUp', false, '0001-01-03')).toBe('0001-01-01');
    expect(dayPickerTarget('ArrowDown', false, '9999-12-30')).toBe(
      '9999-12-31',
    );
    expect(dayPickerTarget('PageUp', false, '0001-01-15')).toBe('0001-01-15');
    expect(dayPickerTarget('PageDown', true, '9999-06-15')).toBe('9999-06-15');
  });

  it('leaves every other key alone', () => {
    expect(dayPickerTarget('Enter', false, '2026-11-07')).toBeUndefined();
    expect(dayPickerTarget('a', false, '2026-11-07')).toBeUndefined();
  });
});

describe('sameDayIn', () => {
  it('keeps the day of the month where the month has it', () => {
    expect(sameDayIn('2026-11-07', '2026-12')).toBe('2026-12-07');
    expect(sameDayIn('2026-10-31', '2026-11')).toBe('2026-11-30');
  });
});
