import type { JournalDate } from '../src/features/journal/journal-day.ts';

export type ExportControlFixtureConfig = {
  readonly responseDelayMs: number;
  readonly today: JournalDate;
};

export type ExportControlFixtureWindow = Window & {
  postludeExportControlFixture: ExportControlFixtureConfig;
};
