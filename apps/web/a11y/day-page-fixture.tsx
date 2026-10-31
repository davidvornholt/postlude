import { RouterProvider } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { journalWriteConflictMessage } from '../src/features/journal/errors/journal-errors.ts';
import { createRenderingRouter } from '../src/shared/testing/render-in-router.tsx';
import type {
  DayPageFixtureWindow,
  SaveOutcome,
} from './day-page-fixture-contract.ts';
import {
  eveningFromFixture,
  journalEntryFromFixture,
} from './day-page-fixture-contract.ts';
import { DayPage } from './day-page-fixture-module.ts';
import { eveningFixtureActions } from './evening-fixture-actions.ts';

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
    return Promise.resolve({
      revision: config.entry.revision + saveAttempt,
    });
  }
  if (outcome === 'pending') {
    return new Promise(() => undefined);
  }
  if (outcome === 'authentication') {
    // TanStack Start can resolve a raw middleware Response rather than reject
    // it, so the fixture exercises the browser boundary's real semantics.
    return Promise.resolve(new Response('', { status: 401 }));
  }
  if (outcome === 'conflict') {
    return Promise.resolve(
      new Response(journalWriteConflictMessage, { status: 409 }),
    );
  }
  const message =
    outcome === 'validation'
      ? 'Check the scripture reference and use a form such as Proverbs 12:5-13.'
      : 'This entry could not be saved. Your words are still here; check your connection.';
  return Promise.reject(new Error(message));
};

const eveningActions = eveningFixtureActions(config);

/**
 * The page as a route shows it. Leaving the day and coming back mounts it
 * anew, with the evening read again as the route's loader reads it.
 */
export const VisitedDayPage = () => {
  const [visit, setVisit] = useState({
    count: 0,
    evening: eveningFromFixture(config),
  });
  useEffect(() => {
    fixtureWindow.postludeRevisitDay = async () => {
      const evening = await eveningActions.readEvening(entry.date);
      setVisit(({ count }) => ({ count: count + 1, evening }));
    };
  }, []);
  return (
    <DayPage
      entry={entry}
      evening={visit.evening}
      eveningActions={eveningActions}
      key={visit.count}
      save={save}
      today={config.today}
    />
  );
};

const router = createRenderingRouter(<VisitedDayPage />);
await router.load();
const recordRoute = (pathname: string) => {
  document.documentElement.dataset.route = pathname;
};
recordRoute(router.state.location.pathname);
router.subscribe('onResolved', ({ toLocation }) => {
  recordRoute(toLocation.pathname);
});

const root = document.querySelector('#day-page-fixture');
if (root === null) {
  throw new Error('The day-page fixture root is missing.');
}

hydrateRoot(root, <RouterProvider router={router} />);
document.documentElement.dataset.hydrated = 'true';
