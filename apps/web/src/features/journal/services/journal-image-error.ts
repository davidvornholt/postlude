import { Data } from 'effect';

export class JournalImageError extends Data.TaggedError('JournalImageError')<{
  readonly message: string;
  readonly cause?: unknown;
}> {}
