/**
 * How far apart two theme colors look, to full color vision and to each of
 * the three dichromacies, for marks that are told apart by color alone.
 *
 * Each color is taken as the browser paints it, simulated with the Machado,
 * Oliveira and Fernandes (2009) matrices at full severity, and the distance is
 * then measured in OKLab, scaled by 100. The matrices act on linear-light
 * sRGB, which is where the paper defines them. Protanopia and deuteranopia
 * are the common red-green deficiencies; tritanopia is rare but loses the
 * blue-yellow axis the other two keep, so a palette that leans on that axis
 * has to hold up without it too.
 *
 * The coefficients below are the published constants of the sources named
 * with each group; they are transcribed, not derived here.
 */

import { paintedLinearSrgb } from './oklch-contrast.ts';

export type Vision = 'normal' | 'protanopia' | 'deuteranopia' | 'tritanopia';
export const visions: ReadonlyArray<Vision> = [
  'normal',
  'protanopia',
  'deuteranopia',
  'tritanopia',
];

/** A 3×3 matrix by its entries, row first: m12 is row one, column two. */
type Matrix = {
  readonly m11: number;
  readonly m12: number;
  readonly m13: number;
  readonly m21: number;
  readonly m22: number;
  readonly m23: number;
  readonly m31: number;
  readonly m32: number;
  readonly m33: number;
};

/** Machado, Oliveira and Fernandes (2009), severity 1.0, on linear sRGB. */
const simulations: Record<Exclude<Vision, 'normal'>, Matrix> = {
  protanopia: {
    m11: 0.152_286,
    m12: 1.052_583,
    m13: -0.204_868,
    m21: 0.114_503,
    m22: 0.786_281,
    m23: 0.099_216,
    m31: -0.003_882,
    m32: -0.048_116,
    m33: 1.051_998,
  },
  deuteranopia: {
    m11: 0.367_322,
    m12: 0.860_646,
    m13: -0.227_968,
    m21: 0.280_085,
    m22: 0.672_501,
    m23: 0.047_413,
    m31: -0.011_82,
    m32: 0.042_94,
    m33: 0.968_881,
  },
  tritanopia: {
    m11: 1.255_528,
    m12: -0.076_749,
    m13: -0.178_779,
    m21: -0.078_411,
    m22: 0.930_809,
    m23: 0.147_602,
    m31: 0.004_733,
    m32: 0.691_367,
    m33: 0.3039,
  },
};

/** Linear sRGB to LMS cone responses (CSS Color 4). */
const lmsFromLinearSrgb: Matrix = {
  m11: 0.412_221_470_8,
  m12: 0.536_332_536_3,
  m13: 0.051_445_992_9,
  m21: 0.211_903_498_2,
  m22: 0.680_699_545_1,
  m23: 0.107_396_956_6,
  m31: 0.088_302_461_9,
  m32: 0.281_718_837_6,
  m33: 0.629_978_700_5,
};

/** The cube roots of the LMS cone responses to OKLab (CSS Color 4). */
const oklabFromLms: Matrix = {
  m11: 0.210_454_255_3,
  m12: 0.793_617_785,
  m13: -0.004_072_046_8,
  m21: 1.977_998_495_1,
  m22: -2.428_592_205,
  m23: 0.450_593_709_9,
  m31: 0.025_904_037_1,
  m32: 0.782_771_766_2,
  m33: -0.808_675_766,
};

/** OKLab differences are small fractions; the convention reads them ×100. */
const distanceScale = 100;

const apply = (
  { m11, m12, m13, m21, m22, m23, m31, m32, m33 }: Matrix,
  [first = 0, second = 0, third = 0]: ReadonlyArray<number>,
): ReadonlyArray<number> => [
  m11 * first + m12 * second + m13 * third,
  m21 * first + m22 * second + m23 * third,
  m31 * first + m32 * second + m33 * third,
];

const clampChannel = (channel: number): number =>
  Math.min(1, Math.max(0, channel));

const oklab = (linear: ReadonlyArray<number>): ReadonlyArray<number> =>
  apply(oklabFromLms, apply(lmsFromLinearSrgb, linear).map(Math.cbrt));

const seen = (value: string, vision: Vision): ReadonlyArray<number> => {
  const linear = paintedLinearSrgb(value);
  return oklab(
    vision === 'normal'
      ? linear
      : apply(simulations[vision], linear).map(clampChannel),
  );
};

/** The OKLab distance ×100 between two colors, as one kind of vision sees them. */
export const perceivedDistance = (
  first: string,
  second: string,
  vision: Vision,
): number => {
  const [lightness = 0, a = 0, b = 0] = seen(first, vision);
  const [otherLightness = 0, otherA = 0, otherB = 0] = seen(second, vision);
  return (
    distanceScale *
    Math.hypot(lightness - otherLightness, a - otherA, b - otherB)
  );
};
