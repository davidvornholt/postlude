/**
 * The heirloom half of the design comparison: a public, unauthenticated tree
 * that renders the same two pages as the app, dressed in one candidate design.
 *
 * The faces are linked from this route rather than from the document, so they
 * only reach anyone actually looking at this theme, and they arrive in the
 * first response rather than after it. The palette is a wrapper class: it
 * redefines the `--pl-*` tokens for its whole subtree, so every semantic
 * utility inside — `bg-background`, `font-display`, `shadow-card` — resolves to
 * heirloom values without a single component knowing which theme it is in.
 */

import spectralCss from '@fontsource/spectral/400.css?url';
import spectralItalicCss from '@fontsource/spectral/400-italic.css?url';
import spectralMediumCss from '@fontsource/spectral/500.css?url';
import hankenGroteskCss from '@fontsource-variable/hanken-grotesk/index.css?url';
import { createFileRoute, Outlet } from '@tanstack/react-router';

import { HeirloomShell } from '#/features/design-comparison/ui/heirloom/shell.tsx';

const faces = [
  hankenGroteskCss,
  spectralCss,
  spectralItalicCss,
  spectralMediumCss,
];

const HeirloomLayout = () => (
  <div className="theme-heirloom min-h-svh bg-background font-sans text-ink">
    <HeirloomShell>
      <Outlet />
    </HeirloomShell>
  </div>
);

export const Route = createFileRoute('/heirloom')({
  component: HeirloomLayout,
  head: () => ({ links: faces.map((href) => ({ rel: 'stylesheet', href })) }),
});
