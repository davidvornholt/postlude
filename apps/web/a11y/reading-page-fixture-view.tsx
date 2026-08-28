import type { ReactNode } from 'react';
import { CalendarPage } from './calendar-page-fixture-module.ts';
import { OnThisDayPage } from './on-this-day-page-fixture-module.ts';
import type { ReadingPageFixtureConfig } from './reading-page-fixture-contract.ts';

export const readingPageOf = (config: ReadingPageFixtureConfig): ReactNode =>
  config.kind === 'calendar' ? (
    <CalendarPage requestedDay={config.requestedDay} view={config.view} />
  ) : (
    <OnThisDayPage view={config.view} />
  );
