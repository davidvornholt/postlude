/**
 * Made-up sentences from templates. `{a|b|c}` in a template becomes one of its
 * choices, so a few dozen templates read as many different days.
 */

import { pick, type Random } from './sample-random.ts';

const choiceGroup = /\{[^{}]+\}/gu;
const whitespace = /\s+/u;
const wordCharacter = /\p{L}|\p{N}/u;

export const fillTemplate = (random: Random, template: string): string =>
  template.replaceAll(choiceGroup, (group) =>
    pick(random, group.slice(1, -1).split('|')),
  );

/** Words as the prose reads them, near enough to aim a length at. */
export const roughWordCount = (text: string): number =>
  text.split(whitespace).filter((word) => wordCharacter.test(word)).length;
