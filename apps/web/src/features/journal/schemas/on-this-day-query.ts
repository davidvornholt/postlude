import { Schema } from 'effect';

import { JournalDateSchema } from './entry.ts';

export const OnThisDayQuery = Schema.Struct({
  date: Schema.optional(JournalDateSchema),
});

export type OnThisDayQueryParams = Schema.Schema.Type<typeof OnThisDayQuery>;

export const decodeOnThisDayQuery = Schema.decodeUnknownSync(OnThisDayQuery);
