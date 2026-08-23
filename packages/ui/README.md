# @postlude/ui

Design tokens for Postlude.

`src/theme.css` defines the semantic `--pl-*` tokens (oklch only, light plus `prefers-color-scheme: dark`) and maps them into Tailwind via `@theme`. The default Tailwind palette is disabled, so components color themselves exclusively through these tokens. `:root` also declares `color-scheme: light dark` so browser-painted chrome (scrollbars, form controls, the canvas behind the page) follows the same preference the dark palette does.

Both palettes carry the same accessibility bar, and the numeric audit in `src/theme-contract.test.ts` is what holds it. That test recomputes the WCAG contrast ratio of every token pair that can carry normal-size text — each text color against each surface it can sit on, plus `--pl-on-primary` on the filled primary control — in light and dark, and fails below 4.5:1. It reads the ratios from the token values themselves via `src/oklch-contrast.ts`, which converts oklch the way a browser does (OKLab to linear sRGB, clamp into gamut, gamma encode, round to 8 bits) and is pinned against colors read back from Chromium. The same file also asserts that light and dark declare exactly the same token set in both directions.

The browser accessibility scan does not cover this and cannot. `apps/web` scans two rendered surfaces under both color schemes: the sign-in page (`/login`, which `/` also redirects to) and the themed not-found page. Everything behind sign-in needs a real GitHub OAuth round trip, so the signed-in shell and `/archive` are out of reach. A scan can also only measure colors that are actually painted, so a token no component renders yet — most of this palette today — is never evaluated by it at all.

The current values are a scaffold placeholder. The design comparison (`/heirloom` vs `/warm-print`) supplies the real candidates; the winning seed replaces this file via design-init.
