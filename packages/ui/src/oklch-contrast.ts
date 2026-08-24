/**
 * WCAG contrast for the oklch values in `theme.css`.
 *
 * WCAG is defined on the 8-bit sRGB a browser paints, not on oklch, so a token
 * value goes through the same pipeline the browser does before the ratio is
 * taken: OKLab to linear sRGB, per-channel clamp into the display gamut, gamma
 * encode, round to 8 bits. Chromium's canvas conversion agrees channel for
 * channel on every value in `theme.css` but one: the red channel of light
 * mode's `--pl-background` lands 0.006 of a step past a rounding boundary,
 * close enough that Chromium's own arithmetic settles on the other side of it
 * and paints 247 where this gives 248. That 1/255 difference moves the ratio of
 * a pair drawn on `--pl-background` by up to 0.03, and the closest such pair
 * clears the 4.5 minimum by 0.68, so it cannot change a verdict.
 * `oklch-contrast.test.ts` pins both sides of it.
 *
 * The coefficients below are the published constants of the standards named
 * with each group; they are transcribed, not derived here.
 */

const oklchPattern =
  /^oklch\(\s*(?<lightness>[\d.]+)\s+(?<chroma>[\d.]+)\s+(?<hue>[\d.]+)\s*\)$/u;

const degreesPerHalfTurn = 180;
const cube = 3;
const channelMaximum = 255;
const hexadecimal = 16;
const digitsPerChannel = 2;
const luminanceOffset = 0.05;

/** OKLab a and b to the cube roots of the LMS cone responses (CSS Color 4). */
const lmsFromOklab = {
  longA: 0.396_337_777_4,
  longB: 0.215_803_757_3,
  mediumA: -0.105_561_345_8,
  mediumB: -0.063_854_172_8,
  shortA: -0.089_484_177_5,
  shortB: -1.291_485_548,
} as const;

/** LMS cone responses to linear sRGB (CSS Color 4). */
const linearSrgbFromLms = {
  redLong: 4.076_741_662_1,
  redMedium: -3.307_711_591_3,
  redShort: 0.230_969_929_2,
  greenLong: -1.268_438_004_6,
  greenMedium: 2.609_757_401_1,
  greenShort: -0.341_319_396_5,
  blueLong: -0.004_196_086_3,
  blueMedium: -0.703_418_614_7,
  blueShort: 1.707_614_701,
} as const;

/** The sRGB transfer function (IEC 61966-2-1). */
const srgbTransfer = {
  linearThreshold: 0.003_130_8,
  encodedThreshold: 0.040_45,
  linearSlope: 12.92,
  scale: 1.055,
  offset: 0.055,
  exponent: 2.4,
} as const;

/** Relative luminance channel weights (WCAG 2, relative luminance). */
const luminanceWeights = {
  red: 0.2126,
  green: 0.7152,
  blue: 0.0722,
} as const;

const oklchToLinearSrgb = (
  lightness: number,
  chroma: number,
  hue: number,
): ReadonlyArray<number> => {
  const radians = (hue * Math.PI) / degreesPerHalfTurn;
  const a = chroma * Math.cos(radians);
  const b = chroma * Math.sin(radians);
  const long =
    (lightness + lmsFromOklab.longA * a + lmsFromOklab.longB * b) ** cube;
  const medium =
    (lightness + lmsFromOklab.mediumA * a + lmsFromOklab.mediumB * b) ** cube;
  const short =
    (lightness + lmsFromOklab.shortA * a + lmsFromOklab.shortB * b) ** cube;
  return [
    linearSrgbFromLms.redLong * long +
      linearSrgbFromLms.redMedium * medium +
      linearSrgbFromLms.redShort * short,
    linearSrgbFromLms.greenLong * long +
      linearSrgbFromLms.greenMedium * medium +
      linearSrgbFromLms.greenShort * short,
    linearSrgbFromLms.blueLong * long +
      linearSrgbFromLms.blueMedium * medium +
      linearSrgbFromLms.blueShort * short,
  ];
};

const encodeGamma = (channel: number): number => {
  const clamped = Math.min(1, Math.max(0, channel));
  return clamped <= srgbTransfer.linearThreshold
    ? srgbTransfer.linearSlope * clamped
    : srgbTransfer.scale * clamped ** (1 / srgbTransfer.exponent) -
        srgbTransfer.offset;
};

const decodeGamma = (channel: number): number =>
  channel <= srgbTransfer.encodedThreshold
    ? channel / srgbTransfer.linearSlope
    : ((channel + srgbTransfer.offset) / srgbTransfer.scale) **
      srgbTransfer.exponent;

const coordinates = (
  value: string,
): { lightness: number; chroma: number; hue: number } => {
  const groups = oklchPattern.exec(value)?.groups;
  if (groups === undefined) {
    throw new Error(`Not a plain oklch colour: ${value}`);
  }
  return {
    lightness: Number(groups.lightness),
    chroma: Number(groups.chroma),
    hue: Number(groups.hue),
  };
};

/** The L of an `oklch(L C H)` value, which is what orders a sequential ramp. */
export const oklchLightness = (value: string): number =>
  coordinates(value).lightness;

/** The 8-bit sRGB channels a browser paints for an `oklch(L C H)` value. */
export const srgbChannels = (value: string): ReadonlyArray<number> => {
  const { lightness, chroma, hue } = coordinates(value);
  return oklchToLinearSrgb(lightness, chroma, hue).map((channel) =>
    Math.round(channelMaximum * encodeGamma(channel)),
  );
};

export const srgbHex = (value: string): string =>
  `#${srgbChannels(value)
    .map((channel) =>
      channel.toString(hexadecimal).padStart(digitsPerChannel, '0'),
    )
    .join('')}`;

const relativeLuminance = (value: string): number => {
  const [red, green, blue] = srgbChannels(value).map((channel) =>
    decodeGamma(channel / channelMaximum),
  );
  return (
    luminanceWeights.red * red +
    luminanceWeights.green * green +
    luminanceWeights.blue * blue
  );
};

export const contrastRatio = (
  foreground: string,
  background: string,
): number => {
  const first = relativeLuminance(foreground) + luminanceOffset;
  const second = relativeLuminance(background) + luminanceOffset;
  return first > second ? first / second : second / first;
};
