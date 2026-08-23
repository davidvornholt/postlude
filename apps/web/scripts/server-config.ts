import { z } from 'zod';

const defaultPort = 3000;
const minimumPort = 1;
const maximumPort = 65_535;
const portSchema = z.coerce
  .number()
  .int()
  .min(minimumPort)
  .max(maximumPort)
  .default(defaultPort);

export const parsePort = (value: unknown): number => {
  // An exported but empty PORT means unset, the way src/shared/env.ts reads
  // every other value in this process; z.coerce would otherwise turn it into 0.
  const blank = typeof value === 'string' && value.trim().length === 0;
  const result = portSchema.safeParse(blank ? undefined : value);
  if (!result.success) {
    throw new Error(
      `Invalid PORT: expected an integer between 1 and 65535. ${z.prettifyError(result.error)}`,
    );
  }
  return result.data;
};
