import { Schema } from 'effect';

export class JournalImageError extends Schema.TaggedError<JournalImageError>()(
  'JournalImageError',
  { message: Schema.String, cause: Schema.optionalKey(Schema.Defect()) },
) {}
