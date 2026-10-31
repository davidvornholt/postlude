import { unansweredEveningActions } from '../src/features/journal/testing/evening-view.ts';
import { renderInRouter } from '../src/shared/testing/render-in-router.tsx';
import {
  type DayPageFixtureConfig,
  eveningFromFixture,
  journalEntryFromFixture,
} from './day-page-fixture-contract.ts';
import { DayPage } from './day-page-fixture-module.ts';

const neverSaves = () => new Promise<never>(() => undefined);

export const renderDayPageFixture = (
  config: DayPageFixtureConfig,
): Promise<string> =>
  renderInRouter(
    <DayPage
      entry={journalEntryFromFixture(config.entry)}
      evening={eveningFromFixture(config)}
      eveningActions={unansweredEveningActions}
      save={neverSaves}
      today={config.today}
    />,
  );
