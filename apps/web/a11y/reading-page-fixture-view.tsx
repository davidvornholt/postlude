import type { ReactNode } from 'react';
import { CalendarPage } from './calendar-page-fixture-module.ts';
import { OnThisDayPage } from './on-this-day-page-fixture-module.ts';
import type { ReadingPageFixtureConfig } from './reading-page-fixture-contract.ts';
import { ReviewPage } from './review-page-fixture-module.ts';

export const readingPageOf = (config: ReadingPageFixtureConfig): ReactNode => {
  if (config.kind === 'calendar') {
    return (
      <CalendarPage requestedDay={config.requestedDay} view={config.view} />
    );
  }
  if (config.kind === 'on-this-day') {
    return <OnThisDayPage view={config.view} />;
  }
  return <ReviewPage view={config.view} />;
};
