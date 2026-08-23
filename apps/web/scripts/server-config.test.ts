import { describe, expect, it } from 'bun:test';

import { parsePort } from './server-config.ts';

const defaultPort = 3000;
const validPort = 8080;

describe('parsePort', () => {
  it('uses the default when PORT is absent', () => {
    expect(parsePort(undefined)).toBe(defaultPort);
  });

  it('accepts a valid override', () => {
    expect(parsePort(String(validPort))).toBe(validPort);
  });

  it.each(['abc', '1.5', '0', '-1', '65536'])(
    'rejects invalid PORT=%s',
    (value) => {
      expect(() => parsePort(value)).toThrow(
        'expected an integer between 1 and 65535',
      );
    },
  );
});
