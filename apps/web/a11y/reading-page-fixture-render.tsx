import { renderInRouter } from '../src/shared/testing/render-in-router.tsx';
import type { ReadingPageFixtureConfig } from './reading-page-fixture-contract.ts';
import { readingPageOf } from './reading-page-fixture-view.tsx';

export const renderReadingPageFixture = (config: ReadingPageFixtureConfig) =>
  renderInRouter(readingPageOf(config));
