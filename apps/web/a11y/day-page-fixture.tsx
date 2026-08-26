import { RouterProvider } from '@tanstack/react-router';
import { hydrateRoot } from 'react-dom/client';

import { DayPage } from '../src/features/journal/ui/day-page.tsx';
import { createRenderingRouter } from '../src/shared/testing/render-in-router.tsx';
import '../src/styles.css';
import type {
  DayPageFixtureWindow,
  SaveOutcome,
} from './day-page-fixture-contract.ts';
import { journalEntryFromFixture } from './day-page-fixture-contract.ts';

const fixtureWindow = globalThis as unknown as DayPageFixtureWindow;
const config = fixtureWindow.postludeDayPageFixture;
const entry = journalEntryFromFixture(config.entry);

let saveAttempt = 0;

const outcomeAt = (attempt: number): SaveOutcome =>
  config.saveOutcomes[attempt] ?? config.saveOutcomes.at(-1) ?? 'stored';

const save = (): Promise<unknown> => {
  const outcome = outcomeAt(saveAttempt);
  saveAttempt += 1;
  document.documentElement.dataset.saveAttempts = String(saveAttempt);
  if (outcome === 'stored') {
    return Promise.resolve();
  }
  if (outcome === 'pending') {
    return new Promise(() => undefined);
  }
  const message =
    outcome === 'validation'
      ? 'Check the scripture reference and use a form such as Proverbs 12:5-13.'
      : 'This entry could not be saved. Your words are still here; check your connection.';
  return Promise.reject(new Error(message));
};

const router = createRenderingRouter(
  <DayPage entry={entry} save={save} today={config.today} />,
);
await router.load();

const root = document.querySelector('#day-page-fixture');
if (root === null) {
  throw new Error('The day-page fixture root is missing.');
}

hydrateRoot(root, <RouterProvider router={router} />);
document.documentElement.dataset.hydrated = 'true';
