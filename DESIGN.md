# Design

Postlude is set like a thoughtfully made periodical, not like an app. Parchment grounds, deep warm inks, structure from typography and hairline rules rather than from boxes. The page you write on should feel like a page, and the app around it should get out of the way of the writing.

This file states the intent. The values live in `packages/ui/src/theme.css` and nowhere else; the shared shape classes live in `apps/web/src/shared/ui/design-classes.ts`. Read this before UI work, and follow it.

## The rules that hold it together

- **No cards, no shadows.** Nothing floats. A section is separated from the next by a rule and by space, not by a box with a border and a raised edge. Both shadow tokens are `none` in both color schemes and are audited as such.
- **Square corners.** There is no raised edge for a radius to soften, so nothing is rounded.
- **A section opens on a ruled eyebrow.** Small letterspaced capitals sitting on a hairline rule is how a section announces itself everywhere: the archive, the writing page, the navigation, the quiet controls.
- **One set column.** Body text keeps to roughly 65 characters (`columnClass`); the archive widens to fit a year of days (`wideColumnClass`). Nothing spans the viewport except the deep register.
- **One inverse register.** `deep-*` is the single dark panel, edge to edge, with its own column inside. It carries the weight a card would carry elsewhere — the morning scripture, a featured passage — and appears once or twice a page at most. An inset dark panel reads as a card; an edge-to-edge one reads as turning a page.
- **Colour is the welcome, never the structure.** Green is the one primary; clay is the accent. Structure is rules and type. If a thing needs colour to be understood, it needs a rule or a label instead.

## Type

Fraunces for display, Inter for everything set as text, both loaded once in `__root.tsx`. Fraunces carries an optical size axis, so its display cut sharpens on its own as the type grows. Inter stays quiet and holds tabular figures, which the archive needs. Faces resolve through `--pl-font-display` and `--pl-font-sans` rather than being named in components.

## Colour and dark mode

Dark mode is not a second palette. The page becomes the deep register's world, growing out of its ground and its ink — and the register itself inverts to parchment, or turning to it would stop feeling like turning a page and start feeling like nothing happened.

The activity ramp (`heat-q1` … `heat-q4`) is one hue whose lightness moves one way only, toward more activity. It descends in light mode and climbs in dark, because the ground is the light end in one and the dark end in the other. An unwritten day is not the bottom of the ramp: it takes the surface fill plus a contrasting outline, so "nothing written" never reads as "a little written".

## Motion

One easing curve, `--ease-standard`, used by every transition; no ad-hoc `ease-out` or inline `cubic-bezier(...)`. Motion today is confined to that: the navigation rule, the quiet control's rule, and the primary button's colour change. Nothing else moves, and no page depends on movement to be read.

Sections arriving as the reader reaches them is the intent for when the writing and archive pages land, not something the app does yet. When it arrives it should be built as a scroll-driven animation that only attaches where motion is welcome and the browser supports the timeline, so an element is never left holding a start state that nothing will advance, and every page stays fully legible with the animation never running.

## Accessibility

WCAG 2.2 AA is a floor the design is built to, not a pass applied afterwards. Every token pair that can carry normal-size text clears 4.5:1, and every activity mark clears 3:1 against its ground; `packages/ui/src/theme-contract.test.ts` recomputes both straight from the token values, so a pair no page has rendered yet is still held to it. `apps/web/a11y/` scans every reachable route under both color schemes on desktop and mobile. Nothing is communicated by colour alone.

## Changing it

Add a token rather than reaching for a nearby one or writing a literal; name it for what it means, not for what it looks like. Colours are authored as `oklch(...)` in `theme.css` only — no `#hex`, `rgb()`, or `hsl()` anywhere in app code, and no default Tailwind palette classes, which are switched off. A change to the design intent belongs in this file in the same commit as the change to the values.
