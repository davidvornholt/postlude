import { describe, expect, it } from 'bun:test';

import {
  clockAt,
  clockOf,
  clockRange,
  isoInstantAt,
  minutesBetween,
  minutesText,
  offsetMinutesOf,
} from './day-report-format.ts';

describe('report values as text', () => {
  it('writes minutes as hours and minutes', () => {
    expect(minutesText(0)).toBe('0 min');
    expect(minutesText(45)).toBe('45 min');
    expect(minutesText(120)).toBe('2 h');
    expect(minutesText(125)).toBe('2 h 5 min');
    expect(minutesText(1500)).toBe('25 h');
  });

  it('reads the clock time an instant was written in', () => {
    expect(clockOf('2026-10-29T09:05:00+01:00')).toBe('09:05');
    expect(clockOf('2026-10-29T23:59:30.120Z')).toBe('23:59');
    expect(clockOf('not a time')).toBe('–');
    expect(
      clockRange('2026-10-29T09:05:00+01:00', '2026-10-29T10:00:00+01:00'),
    ).toBe('09:05–10:00');
  });

  it('reads the offset of an instant in minutes east of UTC', () => {
    expect(offsetMinutesOf('2026-10-29T09:05:00+01:00')).toBe(60);
    expect(offsetMinutesOf('2026-10-29T09:05:00-03:30')).toBe(-210);
    expect(offsetMinutesOf('2026-10-29T09:05:00Z')).toBe(0);
  });

  it('works out the clock time of any moment at an offset', () => {
    const nine = Date.parse('2026-10-29T08:00:00Z');
    expect(clockAt(nine, 60)).toBe('09:00');
    expect(clockAt(nine, -540)).toBe('23:00');
    expect(clockAt(Date.parse('2026-10-29T23:30:00Z'), 60)).toBe('00:30');
  });

  it('counts the whole minutes between two instants', () => {
    expect(
      minutesBetween('2026-10-29T09:00:00+01:00', '2026-10-29T08:45:00Z'),
    ).toBe(45);
  });

  it('writes a moment as an instant to the minute, as /wrap does', () => {
    const at = Date.parse('2026-10-29T08:05:42Z');
    expect(isoInstantAt(at, 60)).toBe('2026-10-29T09:05:00+01:00');
    expect(isoInstantAt(at, -210)).toBe('2026-10-29T04:35:00-03:30');
    expect(isoInstantAt(Date.parse('2026-10-29T23:30:00Z'), 60)).toBe(
      '2026-10-30T00:30:00+01:00',
    );
    expect(Date.parse(isoInstantAt(at, 60))).toBe(
      Date.parse('2026-10-29T08:05:00Z'),
    );
  });
});
