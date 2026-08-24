# @postlude/ui

Design tokens for Postlude.

`src/theme.css` defines the semantic `--pl-*` tokens (oklch only, light plus `prefers-color-scheme: dark`) and maps them into Tailwind via `@theme`. The default Tailwind palette is disabled, so components color themselves exclusively through these tokens. `:root` also declares `color-scheme: light dark` so browser-painted chrome (scrollbars, form controls, the canvas behind the page) follows the same preference the dark palette does.

The type faces resolve through `--pl-font-display` and `--pl-font-sans`. The Tailwind mapping is `@theme inline`, which substitutes each `var(--pl-*)` at the element that uses the utility instead of resolving it once at `:root`. Each comparison stylesheet redefines the tokens under its own wrapper class. Utilities such as `bg-background`, `text-ink`, `font-display`, and `shadow-card` then resolve to the candidate values inside that wrapper while the rest of the app keeps the base palette.

## Token groups

Surfaces (`background`, `surface`, `surface-sunken`), inks (`ink`, `ink-muted`, `ink-faint`), the primary and accent families, `positive` / `critical`, borders, and two shadow tokens (`shadow-card`, `shadow-featured`, both `none` in the scaffold). Two groups exist for the pages the design comparison builds:

- **The activity ramp.** `heat-q1` through `heat-q4` form one sequential hue whose lightness moves toward more activity. The direction reverses with the color scheme, so order carries the meaning rather than darkness alone. `heat-none` fills an unwritten day, while `heat-none-mark` draws the contrasting outline that separates no entry from the ramp.
- **The deep register.** `deep-ground`, `deep-ink`, `deep-ink-muted`, and `deep-rule` define an inverted panel that stays dark in both color schemes instead of following the page.

## Audits

Both color schemes carry the same accessibility bar, and the numeric audits hold it. `src/theme-audit.ts` reads the `--pl-*` declarations of a selector straight from the CSS. It recomputes the WCAG contrast ratio for every token pair that can carry normal-size text. It also checks the activity ramp for monotone lightness and a visible step between neighbours. Every q1 through q4 fill and the `heat-none-mark` outline must clear 3:1 against the ground where that theme renders the heatmap. Heirloom uses `surface`; Warm Print and the scaffold use `background`. Ratios come from `src/oklch-contrast.ts`, which converts oklch through OKLab and sRGB in the same sequence as the browser. Chromium fixtures pin the conversion.

`src/theme-contract.test.ts` runs those audits on the base tokens and adds the structural rules: light and dark declare exactly the same color token set in both directions, the faces are declared once outside the schemes, and every `var(--pl-*)` reference resolves.

`src/comparison-themes.test.ts` runs the same audits on each design comparison theme. A theme is one row in its `themes` list — the file plus the wrapper class it defines — and every check runs on it, including the rule that a theme must redefine the whole base token set rather than silently inheriting half the scaffold palette.

The browser accessibility scan does not cover this and cannot. `apps/web` scans its unauthenticated routes under both color schemes. Everything behind sign-in needs a real GitHub OAuth round trip, so the signed-in shell is out of reach. A scan can also only measure colors that are actually painted, so a token no component renders yet is never evaluated by it at all.

## Comparison themes

`src/comparison-heirloom.css` defines `.theme-heirloom`: warm cream grounds, warm espresso inks, one forest green primary, burnished brass as the sparing accent, Spectral over Hanken Grotesk, square corners, quiet shadows in light mode, and raised surface tones instead of shadows in dark.

`src/comparison-warm-print.css` defines `.theme-warm-print`: paper grounds, carbon inks, a green primary, and a warm clay accent in both color schemes. It pairs Fraunces with Inter, keeps square corners, and casts no shadows.

`apps/web/src/styles.css` imports both comparison stylesheets into the global base stylesheet. Their selectors do nothing until a route layout adds `.theme-heirloom` or `.theme-warm-print`. The `/heirloom` and `/warm-print` layouts each link only the font files used by that candidate.

The base values in `src/theme.css` are a scaffold placeholder. The design comparison (`/heirloom` vs `/warm-print`) supplies the real candidates; the winning seed replaces this file via design-init.
