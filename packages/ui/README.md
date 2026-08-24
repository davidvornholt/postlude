# @postlude/ui

Design tokens for Postlude.

`src/theme.css` defines the semantic `--pl-*` tokens (oklch only, light plus `prefers-color-scheme: dark`) and maps them into Tailwind via `@theme`. The default Tailwind palette is disabled, so components color themselves exclusively through these tokens. `:root` also declares `color-scheme: light dark` so browser-painted chrome (scrollbars, form controls, the canvas behind the page) follows the same preference the dark palette does.

The type faces resolve through tokens too — `--pl-font-display` and `--pl-font-sans` — and the Tailwind mapping is `@theme inline`, which substitutes each `var(--pl-*)` at the element that uses the utility instead of resolving it once at `:root`. That is what lets a wrapper class re-skin a whole subtree: redefine the tokens under `.theme-heirloom` and every `bg-background`, `text-ink`, `font-display` and `shadow-card` inside it changes with them, while the rest of the app keeps the base palette.

## Token groups

Surfaces (`background`, `surface`, `surface-sunken`), inks (`ink`, `ink-muted`, `ink-faint`), the primary and accent families, `positive` / `critical`, borders, and two shadow tokens (`shadow-card`, `shadow-featured`, both `none` in the scaffold). Two groups exist for the pages the design comparison builds:

- **The activity ramp** — `heat-none` plus `heat-q1` … `heat-q4`. Sequential by design: one hue, lightness moving one way only, so a darker cell always means a longer entry. `heat-none` is the unwritten day and sits with the surfaces rather than on the ramp, because "no entry" must not read as a lighter shade of "entry" — the hairline border a cell carries is what marks it empty.
- **The deep register** — `deep-ground`, `deep-ink`, `deep-ink-muted`, `deep-rule`. An inverted panel that stays dark in both color schemes instead of following the ground.

## Audits

Both palettes carry the same accessibility bar, and the numeric audits hold it. `src/theme-audit.ts` owns the machinery: it reads the `--pl-*` declarations of a selector in one color scheme straight out of the CSS, recomputes the WCAG contrast ratio of every token pair that can carry normal-size text (each text color against each surface it can sit on, `--pl-on-primary` on the filled primary control, and the deep register's two inks on `deep-ground`), and checks the ramp for monotone lightness, a visible step between neighbours, and a light end that still reads against the ground. Ratios come from `src/oklch-contrast.ts`, which converts oklch the way a browser does (OKLab to linear sRGB, clamp into gamut, gamma encode, round to 8 bits) and is pinned against colors read back from Chromium.

`src/theme-contract.test.ts` runs those audits on the base tokens and adds the structural rules: light and dark declare exactly the same color token set in both directions, the faces are declared once outside the schemes, and every `var(--pl-*)` reference resolves.

`src/comparison-themes.test.ts` runs the same audits on each design comparison theme. A theme is one row in its `themes` list — the file plus the wrapper class it defines — and every check runs on it, including the rule that a theme must redefine the whole base token set rather than silently inheriting half the scaffold palette.

The browser accessibility scan does not cover this and cannot. `apps/web` scans its unauthenticated routes under both color schemes. Everything behind sign-in needs a real GitHub OAuth round trip, so the signed-in shell is out of reach. A scan can also only measure colors that are actually painted, so a token no component renders yet is never evaluated by it at all.

## Comparison themes

`src/comparison-heirloom.css` defines `.theme-heirloom`: warm cream grounds, warm espresso inks, one forest green primary, burnished brass as the sparing accent, Spectral over Hanken Grotesk, square corners, real (quiet) shadows in light mode and raised surface tones instead of shadows in dark. `apps/web` imports it from the `/heirloom` layout route so Vite scopes it to that route's chunk.

The base values in `src/theme.css` are a scaffold placeholder. The design comparison (`/heirloom` vs `/warm-print`) supplies the real candidates; the winning seed replaces this file via design-init.
