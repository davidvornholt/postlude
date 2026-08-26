import { Schema } from 'effect';

import { JournalDateSchema } from '../schemas/entry.ts';

const ReadEntryInput = Schema.Struct({
  date: Schema.optional(JournalDateSchema),
});

/** The GET decoder runs before the repository handler and needs no runtime. */
export const decodeReadEntryInput = Schema.decodeUnknownSync(ReadEntryInput);
