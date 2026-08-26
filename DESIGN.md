# Design

Postlude is set like a thoughtfully made periodical, not like an app. Parchment grounds, deep warm inks, structure from typography and hairline rules rather than from boxes. The page you write on should feel like a page, and the app around it should get out of the way of the writing.

This file states the intent. The values live in `packages/ui/src/theme.css` and nowhere else; the shared shape classes live in `apps/web/src/shared/ui/design-classes.ts`, and the control recipes built from them — the primary button, the quiet control, and the deep register's field — live in `apps/web/src/shared/ui/form-classes.ts`. Read this before UI work, and follow it.

## The rules that hold it together

- **No cards, no shadows.** Nothing floats. A section is separated from the next by a rule and by space, not by a box with a border and a raised edge. Both shadow tokens are `none` in both color schemes and are audited as such.
- **Square corners.** There is no raised edge for a radius to soften, so nothing is rounded.
- **An eyebrow announces a section.** Small letterspaced capitals are how a section opens and how a control names itself, with a hairline rule where one part of the page has to be separated from the next. The navigation links, the archive's year nav, the sign-out control, and the sign-in page's opening line are set that way today. The navigation draws its rule as its current-page and hover behaviour. The year nav is the same choice the navigation makes — which of a row of places you are in — so it wears the same recipe from `form-classes.ts` rather than a second copy of it, and the year being shown is marked by the rule and not by colour alone. The sign-out control keeps its rule out at rest and deepens the type and the rule together when a pointer or a press reaches it, because a rule only a hover can draw is a rule a phone never gets, and a control has to look like a control before it is touched. It sits at the foot of the page rather than in the navigation row: the pages are told apart by weight, so a control standing among them at a link's weight, wearing a rule the inactive links do not, reads as a third page and as the one you are on.
- **One set column.** Body text keeps to roughly 65 characters (`columnClass`); the archive widens to fit a year of days (`wideColumnClass`). The measure is what the column holds: a rule or a ground may run the full width — the header's hairline already does — but the deep register is the one block of *content* that steps outside it.
- **One inverse register.** `deep-*` is the single dark panel, edge to edge, with its own column inside. It carries the weight a card would carry elsewhere — and appears once or twice a page at most. An inset dark panel reads as a card; an edge-to-edge one reads as turning a page. The writing page's morning scripture section is the one that renders it today. Anything focusable inside it takes `deepFocusRingClass` rather than the standard ring with a deep-ink outline appended: which of two utilities setting the same property wins is decided by their order in the generated stylesheet, not by the `class` attribute, and the standard ring's green is emitted last — so the appended one would silently lose and leave a 2.11:1 ring on the deep ground, under the 3:1 a focus indicator has to clear.
- **Colour is the welcome, never the structure.** Green is the one primary; clay is the accent. Structure is rules and type. If a thing needs colour to be understood, it needs a rule or a label instead.

## Type

Fraunces for display, Inter for everything set as text, both loaded once in `__root.tsx`. Fraunces carries an optical size axis, so its display cut sharpens on its own as the type grows. Inter stays quiet and holds tabular figures, which the archive needs. Faces resolve through `--pl-font-display`, `--pl-font-sans`, and `--pl-font-mono` rather than being named in components.

The monospace face is a third token but not a third webfont: it is the device's own stack and is loaded by nobody. Markdown can hold a fenced code block, where the alignment is the content and a proportional face destroys it, and a journal that contains one every few months does not deserve a download for it.

### The written page

Markdown is typed and rendered in place, so a heading, a list, and a quote all reach the page without a component to hang a utility on. Entry headings begin at `h3`, below the date at `h1` and the morning or evening section at `h2`, whether the safe server renderer or the hydrated editor is visible. `.journal-prose` in `apps/web/src/styles.css` is where they are set, and `.journal-prose-deep` re-points its colour properties for the inverse register rather than restating the block. Structure there follows the same rule as everywhere else: a quote and a code block are a hairline down the left, never a filled box, and a link is underlined rather than coloured — an underline works on the parchment and on the deep ground without a second token.

An empty writing area is the hardest thing on the page to draw, because there is nothing in it and the design has no boxes to put around it. `.journal-writing` gives it the rule a paper form puts under the line you are meant to write on, standing off the foot of the words and following them down as the entry grows, and strengthening under a pointer the way both controls do. The editor and the safe semantic Markdown shown before hydration wear it alike, so the page does not resize when the editor arrives. The prompt inside it is set in italic and a step fainter than the writing, and asks a question rather than naming a subject, because the one thing a prompt must never be mistaken for is a line the writer already put there.

## Colour and dark mode

Dark mode is not a second palette. The page becomes the deep register's world, growing out of its ground and its ink — and the register itself inverts to parchment, or turning to it would stop feeling like turning a page and start feeling like nothing happened.

The activity ramp (`heat-q1` … `heat-q4`) is one hue whose lightness moves one way only, toward more activity. It descends in light mode and climbs in dark, because the ground is the light end in one and the dark end in the other. An unwritten day is not the bottom of the ramp: it takes the surface fill plus a contrasting outline, so "nothing written" never reads as "a little written".

The archive's activity map renders the ramp, at `apps/web/src/features/journal/ui/activity-map.tsx`. A day's step is its place among the days actually written, not a fixed word count: the quartiles are recomputed over the window, so a writer of long entries and a writer of short ones each get the whole ramp. The grid is one image rather than 371 squares — it carries a summary label and a month-by-month description, and the way into a day is the collapsed table beneath it, because 371 links in the tab order would put the whole year between the writer and the next thing on the page.

## Motion

One easing curve, `--ease-standard`, used by every transition; no ad-hoc `ease-out` or inline `cubic-bezier(...)`. Motion today is confined to that: the navigation rule extending under a link, and the colour change each of the two controls makes under a pointer. Nothing else moves, and no page depends on movement to be read.

The archive has landed without it. Sections arriving as the reader reaches them is still the intent, and the archive is the page that would carry it — it is the one page long enough to scroll through. It should be built as a scroll-driven animation that only attaches where motion is welcome and the browser supports the timeline, so an element is never left holding a start state that nothing will advance, and the page stays fully legible with the animation never running.

## Accessibility

WCAG 2.2 AA is a floor the design is built to, not a pass applied afterwards. Every token pair that can carry normal-size text clears 4.5:1, and every activity mark clears 3:1 against its ground; `packages/ui/src/theme-contract.test.ts` recomputes both straight from the token values, so a pair no page has rendered yet is still held to it. `apps/web/a11y/` scans every route reachable without signing in, under both color schemes on desktop and mobile. Everything behind the sign-in is out of its reach, because getting there needs a real GitHub OAuth round trip; those pages are server-rendered and asserted in `bun test` instead. Nothing is communicated by colour alone.

## Changing it

Add a token rather than reaching for a nearby one or writing a literal; name it for what it means, not for what it looks like. Colours are authored as `oklch(...)` in `theme.css` only — no `#hex`, `rgb()`, or `hsl()` anywhere in app code, and no default Tailwind palette classes, which are switched off. A change to the design intent belongs in this file in the same commit as the change to the values.
