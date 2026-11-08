/**
 * Chance without a clock and without `Math.random`, for made-up journals.
 *
 * The same seed draws the same sequence on every run, so a test asserts against
 * the same journal each time and a preview shows the same one on every rebuild.
 */

export type Random = () => number;

const lehmerMultiplier = 48_271;
/** 2^31 − 1, prime, so the sequence visits every state before repeating. */
const lehmerModulus = 2_147_483_647;
const lehmerStates = lehmerModulus - 1;

/** Numbers from 0 up to but not including 1, as a Lehmer generator draws them. */
export const seededRandom = (seed: number): Random => {
  let state = (Math.abs(Math.trunc(seed)) % lehmerStates) + 1;
  return (): number => {
    state = (state * lehmerMultiplier) % lehmerModulus;
    return (state - 1) / lehmerStates;
  };
};

export const chance = (random: Random, probability: number): boolean =>
  random() < probability;

/** A whole number from `low` through `high`. */
export const between = (random: Random, low: number, high: number): number =>
  low + Math.floor(random() * (high - low + 1));

/** The whole numbers a sample value is drawn from, both ends included. */
export type Span = { readonly low: number; readonly high: number };

export const within = (random: Random, { low, high }: Span): number =>
  between(random, low, high);

export const pick = <T>(random: Random, items: ReadonlyArray<T>): T => {
  const item = items[Math.floor(random() * items.length)];
  if (item === undefined) {
    throw new RangeError('Nothing to pick from.');
  }
  return item;
};

/** One of the values, each as likely as its weight says. */
export const weighted = <T>(
  random: Random,
  choices: ReadonlyArray<{ readonly value: T; readonly weight: number }>,
): T => {
  const total = choices.reduce((sum, { weight }) => sum + weight, 0);
  let left = random() * total;
  for (const { value, weight } of choices) {
    left -= weight;
    if (left < 0) {
      return value;
    }
  }
  const last = choices.at(-1);
  if (last === undefined) {
    throw new RangeError('Nothing to choose from.');
  }
  return last.value;
};

/** The items in a drawn order, leaving the given array as it was. */
export const shuffled = <T>(
  random: Random,
  items: ReadonlyArray<T>,
): Array<T> => {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    const current = result[index] as T;
    result[index] = result[other] as T;
    result[other] = current;
  }
  return result;
};
