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
  const result = portSchema.safeParse(value);
  if (!result.success) {
    throw new Error(
      `Invalid PORT: expected an integer between 1 and 65535. ${z.prettifyError(result.error)}`,
    );
  }
  return result.data;
};
