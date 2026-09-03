# @postlude/ui

Design tokens for Postlude. This package holds the visual values and the audits that keep them honest.

`src/theme.css` defines the semantic `--pl-*` tokens (oklch only, light plus `prefers-color-scheme: dark`) and maps them into Tailwind via `@theme`. The default Tailwind palette is disabled, so components color themselves exclusively through these tokens. `:root` also declares `color-scheme: light dark` so browser-painted chrome (scrollbars, form controls, the canvas behind the page) follows the same preference the dark palette does.

The type faces resolve through `--pl-font-display` and `--pl-font-sans`. The Tailwind mapping is `@theme inline`, which substitutes each `var(--pl-*)` at the element that uses the utility instead of resolving it once at `:root`. That is what lets a subtree redefine a token — a future high-contrast scheme, a design exploration — and re-skin every utility below it rather than nothing at all.

The file is tokens only: it declares no classes and no keyframes, so nothing here styles an element on its own. What a page renders comes from Tailwind's own base layer and from the utilities on its elements, both resolving these tokens; the one authored rule in the app is the `body` default in `apps/web/src/styles.css`, which reaches for the same tokens.

## Token groups

Surfaces (`background`, `surface`, `surface-sunken`), inks (`ink`, `ink-muted`, `ink-faint`), the primary and accent families, `positive` / `critical`, borders, and two shadow tokens (`shadow-card`, `shadow-featured`, both `none` — nothing in Postlude floats, and the tokens exist so a utility that names one resolves). Two groups serve the archive and the writing page:

- **The activity ramp.** `heat-q1` through `heat-q4` form one sequential hue whose lightness moves toward more activity. The direction reverses with the color scheme, so order carries the meaning rather than darkness alone. `heat-none` fills an unwritten day, while `heat-none-mark` draws the contrasting outline that separates no entry from the ramp.
- **The deep register.** `deep-ground`, `deep-ink`, `deep-ink-muted`, and `deep-rule` define the one separate panel. It is dark against the light page, and against the dark one it lifts a little off the background instead of inverting to parchment, so turning to it always reads as a change of register without putting a lamp on the page in a dark room.

## Audits

Both color schemes carry the same accessibility bar, and the numeric audits hold it. `src/theme-audit.ts` reads the `--pl-*` declarations of a selector straight from the CSS. It recomputes the WCAG contrast ratio for every token pair that can carry normal-size text. It also checks the activity ramp for monotone lightness and a visible step between neighbours, requires every q1 through q4 fill and the `heat-none-mark` outline to clear 3:1 against `background`, and requires `deep-rule` to clear 3:1 against `deep-ground`. Ratios come from `src/oklch-contrast.ts`, which converts oklch through OKLab and sRGB in the same sequence as the browser. Chromium fixtures pin the conversion.

`src/theme-contract.test.ts` runs those audits on the tokens and adds the structural rules: light and dark declare exactly the same color token set in both directions, the faces are declared once outside the schemes, every `var(--pl-*)` reference resolves, every color is authored as `oklch(...)`, and no shadow token is ever switched on. Mutation cases prove the ramp and deep-register audits fail when a mark or rule blends into its ground rather than passing vacuously.

The browser accessibility scan complements rather than replaces these audits. `apps/web` scans public routes and isolated signed-in page fixtures under both colour schemes, including the deep register where it is painted. A scan can only measure the combinations present in those fixtures, however, so a token pair no current component renders remains invisible without the exhaustive numeric contract.
