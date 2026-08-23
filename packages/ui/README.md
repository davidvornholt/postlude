# @postlude/ui

Design tokens for Postlude.

`src/theme.css` defines the semantic `--pl-*` tokens (oklch only, light plus `prefers-color-scheme: dark`) and maps them into Tailwind via `@theme`. The default Tailwind palette is disabled, so components color themselves exclusively through these tokens. `:root` also declares `color-scheme: light dark` so browser-painted chrome (scrollbars, form controls, the canvas behind the page) follows the same preference the dark palette does.

Both palettes carry the same accessibility bar. `src/theme-contract.test.ts` asserts that light and dark declare exactly the same token set in both directions, and `apps/web` scans every route under both color schemes, so a token that only reads well in one mode fails the gate.

The current values are a scaffold placeholder. The design comparison (`/heirloom` vs `/warm-print`) supplies the real candidates; the winning seed replaces this file via design-init.
