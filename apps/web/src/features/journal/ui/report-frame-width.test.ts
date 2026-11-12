import { describe, expect, it } from 'bun:test';

import { reportRoomOf } from './report-frame-width.ts';

/** A screen scaled by 5/3, as the browser reports it. */
const fiveThirds = Math.fround(5 / 3);

const roomAt = (screen: number, pixelRatio: number): number =>
  reportRoomOf({ column: 864, screen, pageFrame: 896, pixelRatio });

describe('reportRoomOf', () => {
  it('reaches out of the column as far as the widest page, or as the screen leaves room for', () => {
    expect(roomAt(1400, 1)).toBe(252);
    expect(roomAt(1301, 1)).toBe(202);
    expect(roomAt(2560, 2)).toBe(309);
  });

  it('gives up a few pixels so that the room is a whole number of device pixels', () => {
    expect(roomAt(1301, 1.5)).toBe(202);
    expect(roomAt(1301, fiveThirds)).toBe(201);
    expect(roomAt(1301, 1.25)).toBe(200);
    expect(roomAt(2560, 1.5)).toBe(308);
    expect(roomAt(1400, 1.1)).toBe(250);
  });

  it('keeps all of the room where no few pixels less would end on whole device pixels', () => {
    expect(roomAt(1400, 1.33)).toBe(252);
  });

  it('has no room where the screen leaves none', () => {
    expect(roomAt(896, 1)).toBe(0);
    expect(roomAt(890, 1.5)).toBe(0);
  });
});
