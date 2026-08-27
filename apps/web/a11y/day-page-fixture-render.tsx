import { renderInRouter } from '../src/shared/testing/render-in-router.tsx';
import {
  type DayPageFixtureConfig,
  journalEntryFromFixture,
} from './day-page-fixture-contract.ts';
import { DayPage } from './day-page-fixture-module.ts';

const neverSaves = () => new Promise<never>(() => undefined);

export const renderDayPageFixture = (
  config: DayPageFixtureConfig,
): Promise<string> =>
  renderInRouter(
    <DayPage
      anniversaries={config.anniversaries}
      entry={journalEntryFromFixture(config.entry)}
      save={neverSaves}
      today={config.today}
    />,
  );
