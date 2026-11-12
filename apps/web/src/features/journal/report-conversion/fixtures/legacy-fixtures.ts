/**
 * The old report pages the conversion is tested on: each template /wrap had,
 * rendered at its commit in agent-skills with made-up data, and the page
 * Postlude's sample days carried. No real day is among them.
 */

import { Schema } from 'effect';

import type { LegacyShape } from '../legacy-report.ts';
import postludeSample from './postlude-sample.json' with { type: 'json' };
import wrap17 from './wrap-17.json' with { type: 'json' };
import wrap43 from './wrap-43.json' with { type: 'json' };
import wrap45 from './wrap-45.json' with { type: 'json' };
import wrap47 from './wrap-47.json' with { type: 'json' };

const LegacyFixtureSchema = Schema.Struct({
  source: Schema.String,
  day: Schema.String,
  dayMetrics: Schema.Unknown,
  reportHtml: Schema.String,
});

export type LegacyFixture = typeof LegacyFixtureSchema.Type;

const decodeFixture = Schema.decodeUnknownSync(LegacyFixtureSchema);

const fixtures: Readonly<Record<LegacyShape, unknown>> = {
  'wrap-47': wrap47,
  'wrap-45': wrap45,
  'wrap-43': wrap43,
  'wrap-17': wrap17,
  'postlude-sample': postludeSample,
};

export const legacyFixture = (shape: LegacyShape): LegacyFixture =>
  decodeFixture(fixtures[shape]);
