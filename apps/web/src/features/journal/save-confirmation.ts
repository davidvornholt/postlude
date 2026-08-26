/** Validate what TanStack Start resolved for a journal write. */

import { Schema } from 'effect';

import {
  type SaveConfirmation,
  SaveConfirmationSchema,
} from './schemas/entry.ts';

const decodeConfirmation = Schema.decodeUnknownPromise(SaveConfirmationSchema);

export const decodeSaveConfirmation = (
  result: unknown,
): Promise<SaveConfirmation> => {
  if (result instanceof Response && !result.ok) {
    return Promise.reject(result);
  }
  return decodeConfirmation(result);
};
