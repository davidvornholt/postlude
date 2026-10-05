import { Schema } from 'effect';

export class TestDatabaseSetupError extends Schema.TaggedError<TestDatabaseSetupError>()(
  'TestDatabaseSetupError',
  { message: Schema.String, cause: Schema.Defect() },
) {}
