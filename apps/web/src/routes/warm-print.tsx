/**
 * The warm print half of the design comparison: a public, unauthenticated tree
 * that renders the same two pages as the app, dressed in the second candidate
 * design.
 *
 * The faces are linked from this route rather than from the document, so they
 * only reach anyone actually looking at this theme, and they arrive in the
 * first response rather than after it. Fraunces is loaded with its optical size
 * axis, which is the point of choosing it: the display cut sharpens as the type
 * grows without a second file. The palette is a wrapper class: it redefines the
 * `--pl-*` tokens for its whole subtree, so every semantic utility inside —
 * `bg-background`, `font-display`, `bg-deep-ground` — resolves to warm print
 * values without a single component knowing which theme it is in.
 */

import frauncesCss from '@fontsource-variable/fraunces/standard.css?url';
import frauncesItalicCss from '@fontsource-variable/fraunces/standard-italic.css?url';
import interCss from '@fontsource-variable/inter/index.css?url';
import { createFileRoute, Outlet } from '@tanstack/react-router';

import { WarmPrintShell } from '#/features/design-comparison/ui/warm-print/shell.tsx';

const faces = [interCss, frauncesCss, frauncesItalicCss];

const WarmPrintLayout = () => (
  <div className="theme-warm-print min-h-svh bg-background font-sans text-ink">
    <WarmPrintShell>
      <Outlet />
    </WarmPrintShell>
  </div>
);

export const Route = createFileRoute('/warm-print')({
  component: WarmPrintLayout,
  head: () => ({ links: faces.map((href) => ({ rel: 'stylesheet', href })) }),
});
