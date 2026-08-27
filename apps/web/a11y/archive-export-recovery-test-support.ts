import type * as playwright from '@playwright/test';
import {
  getResponseHeaders,
  requestHandler,
} from '@tanstack/react-start/server';

import { exportDownloadResponse } from '../src/features/journal/services/download-response.ts';
import { applyPrivateResponseHeaders } from '../src/shared/auth/private-response.ts';
import { runSessionRequired } from '../src/shared/auth/session-required.ts';

const exportFileName = 'postlude-2026-08-26-daily.zip';
const styleSheetAssets = [
  /^\/assets\/index-[A-Za-z\d_-]+\.css$/u,
  /^\/assets\/standard-(?!italic-)[A-Za-z\d_-]+\.css$/u,
  /^\/assets\/standard-italic-[A-Za-z\d_-]+\.css$/u,
  /^\/assets\/styles-[A-Za-z\d_-]+\.css$/u,
] as const;

export const privateFailureDetail = 'database diagnostic for private journal';

export const productionStyleSheetHrefs = async (
  page: playwright.Page,
): Promise<readonly [string, ...Array<string>]> => {
  await page.goto('/login');
  const assets = await page
    .locator('link')
    .evaluateAll((links) =>
      links
        .filter((link) => (link as HTMLLinkElement).rel === 'stylesheet')
        .map((link) => new URL((link as HTMLLinkElement).href).pathname),
    );
  const unexpected = assets.filter(
    (asset) => !styleSheetAssets.some((pattern) => pattern.test(asset)),
  );
  const missing = styleSheetAssets.filter(
    (pattern) => assets.filter((asset) => pattern.test(asset)).length !== 1,
  );
  const [first, ...rest] = assets;
  if (first === undefined || unexpected.length > 0 || missing.length > 0) {
    throw new Error(
      `Expected the four canonical production stylesheets, found ${assets.join(', ')}.`,
    );
  }
  return [first, ...rest];
};

export const answerWithUnavailableExport = async (
  route: playwright.Route,
  styleSheetHrefs: readonly [string, ...Array<string>],
): Promise<void> => {
  const body = new ReadableStream<Uint8Array>({
    start: (controller) => controller.error(new Error(privateFailureDetail)),
  });
  const recovery = await exportDownloadResponse({
    body,
    fileName: () => exportFileName,
    signal: new AbortController().signal,
    styleSheetHrefs,
  });
  const request = new Request(route.request().url(), { method: 'POST' });
  const handler = requestHandler(() =>
    runSessionRequired({
      request,
      authorize: () => Promise.resolve(true),
      next: () => Promise.resolve(recovery),
      publishHeaders: () => applyPrivateResponseHeaders(getResponseHeaders()),
    }),
  );
  const result = await handler(request, {});
  await route.fulfill({
    body: await result.text(),
    headers: Object.fromEntries(result.headers),
    status: result.status,
  });
};

type RecoveryFonts = {
  readonly bodyFamily: string;
  readonly displayFamily: string;
  readonly frauncesLoaded: boolean;
  readonly interLoaded: boolean;
};

export const recoveryFonts = async (
  page: playwright.Page,
): Promise<RecoveryFonts> =>
  page.evaluate(async () => {
    const inter = '16px "Inter Variable"';
    const fraunces = '48px "Fraunces Variable"';
    const heading = document.querySelector('h1');
    if (heading === null) {
      throw new Error('The recovery heading is missing.');
    }
    const [interFaces, frauncesFaces] = await Promise.all([
      document.fonts.load(inter, 'Postlude'),
      document.fonts.load(fraunces, 'Export unavailable'),
    ]);
    await document.fonts.ready;
    return {
      bodyFamily: getComputedStyle(document.body).fontFamily,
      displayFamily: getComputedStyle(heading).fontFamily,
      frauncesLoaded:
        frauncesFaces.length > 0 &&
        document.fonts.check(fraunces, 'Export unavailable'),
      interLoaded:
        interFaces.length > 0 && document.fonts.check(inter, 'Postlude'),
    };
  });

type RecoveryContrasts = {
  readonly focusIndicator: number;
  readonly hoverText: number;
};

export const recoveryActionContrasts = async (
  page: playwright.Page,
  action: playwright.Locator,
): Promise<RecoveryContrasts> => {
  await action.hover();
  await action.evaluate((element) => {
    for (const animation of element.getAnimations()) {
      animation.finish();
    }
  });
  const hover = await action.evaluate((element) => {
    const style = getComputedStyle(element);
    return { background: style.backgroundColor, foreground: style.color };
  });
  await action.focus();
  const focus = await action.evaluate((element) => ({
    background: getComputedStyle(document.body).backgroundColor,
    foreground: getComputedStyle(element).outlineColor,
  }));

  return page.evaluate(
    ({ focusColors, hoverColors }) => {
      const colorChannelCount = 3;
      const colorChannelMaximum = 255;
      const linearChannelThreshold = 0.040_45;
      const linearChannelDivisor = 12.92;
      const gammaOffset = 0.055;
      const gammaDivisor = 1.055;
      const gammaExponent = 2.4;
      const redLuminanceWeight = 0.2126;
      const greenLuminanceWeight = 0.7152;
      const blueLuminanceWeight = 0.0722;
      const contrastOffset = 0.05;
      const channelsOf = (color: string): ReadonlyArray<number> => {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        const context = canvas.getContext('2d', {
          willReadFrequently: true,
        });
        if (context === null) {
          throw new Error('The browser did not provide a canvas context.');
        }
        context.fillStyle = color;
        context.fillRect(0, 0, 1, 1);
        return Array.from(
          context.getImageData(0, 0, 1, 1).data.slice(0, colorChannelCount),
        );
      };
      const luminance = (color: string): number => {
        const channels = channelsOf(color).map((channel) => {
          const normalized = channel / colorChannelMaximum;
          return normalized <= linearChannelThreshold
            ? normalized / linearChannelDivisor
            : ((normalized + gammaOffset) / gammaDivisor) ** gammaExponent;
        });
        return (
          (channels[0] ?? 0) * redLuminanceWeight +
          (channels[1] ?? 0) * greenLuminanceWeight +
          (channels[2] ?? 0) * blueLuminanceWeight
        );
      };
      const contrast = (first: string, second: string): number => {
        const firstLuminance = luminance(first);
        const secondLuminance = luminance(second);
        return (
          (Math.max(firstLuminance, secondLuminance) + contrastOffset) /
          (Math.min(firstLuminance, secondLuminance) + contrastOffset)
        );
      };
      return {
        focusIndicator: contrast(
          focusColors.foreground,
          focusColors.background,
        ),
        hoverText: contrast(hoverColors.foreground, hoverColors.background),
      };
    },
    { focusColors: focus, hoverColors: hover },
  );
};
