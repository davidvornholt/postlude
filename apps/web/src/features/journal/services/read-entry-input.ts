import { Schema } from 'effect';

import { JournalDateSchema } from '../schemas/entry.ts';

const ReadDatedEntryInput = Schema.Struct({
  date: JournalDateSchema,
});

/** The GET decoder runs before the repository handler and needs no runtime. */
export const decodeReadDatedEntryInput =
  Schema.decodeUnknownSync(ReadDatedEntryInput);
