import { DayPage } from '../src/features/journal/ui/day-page.tsx';
import { renderInRouter } from '../src/shared/testing/render-in-router.tsx';
import {
  type DayPageFixtureConfig,
  journalEntryFromFixture,
} from './day-page-fixture-contract.ts';

const neverSaves = () => new Promise<never>(() => undefined);

export const renderDayPageFixture = (
  config: DayPageFixtureConfig,
): Promise<string> =>
  renderInRouter(
    <DayPage
      entry={journalEntryFromFixture(config.entry)}
      save={neverSaves}
      today={config.today}
    />,
  );
