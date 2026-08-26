import { Data } from 'effect';

export class TestDatabaseSetupError extends Data.TaggedError(
  'TestDatabaseSetupError',
)<{
  readonly message: string;
  readonly cause: unknown;
}> {}
