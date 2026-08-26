# Review decisions registry

Durable, already-litigated review decisions. How reviewers must treat entries and when orchestrators append them is defined in the `review` and `review-fix` skills.

Entry format: heading `### D-NNN (date, status) — title`, where status is `decided` or `open`, followed by the decision and its rationale in prose. Entries are never edited silently; superseding an entry means a new entry that references the old id.

## Entries

### D-001 (2026-08-23, decided) — Auth tables keep better-auth's naive timestamp shape

The four better-auth tables declare their timestamp columns as `timestamp` without time zone with `DEFAULT now()`, so a value produced by the default records the database server's wall clock instead of an absolute instant. This is accepted. better-auth's adapter always supplies these values explicitly on every write it performs, so the column defaults never fire in practice, and deviating from the shape better-auth generates risks adapter drift on upgrades. Revisit only if a write path to these tables appears that does not go through the adapter.

### D-002 (2026-08-23, decided) — Root test:a11y script is required by the standards structure check

The review flagged the root `test:a11y` Turbo alias as duplicating what the root `check` script already runs. The alias stays: the standards structure gate hard-fails without it, observed while scaffolding this repository. Revisit only if the standards template drops the requirement.

### D-003 (2026-08-23, decided) — Word counts are not database-constrained against the markdown they count

The `entry` table stores `journal_word_count` and `scripture_word_count` as plain numbers next to the markdown they describe, and no database constraint ties one to the other, so a wrong number would make the archive heatmap show a day as heavier or lighter than it was. This is accepted. A CHECK constraint can only compare values already in the row, and counting words in markdown means tokenising prose, which is not something SQL can express as a constraint. The app write path is the only writer to `entry` and therefore owns the invariant: it computes both counts from the same markdown it saves in the same statement. Tests for that write path will pin the invariant when the write path lands. Revisit if a second write path to `entry` appears — an importer, a migration backfill, or manual SQL — because the invariant then has no single owner.

### D-004 (2026-08-23, decided) — The server-function guard test passes with nothing to guard yet

`apps/web/src/shared/auth/sensitive-server-fns.test.ts` scans the app's source for server functions — functions the browser calls to run code on the server — and fails when one does not carry the `sessionRequired` middleware that turns away a caller with no session. The app has one server function today, `hasAuthorizedSessionFn`, and it is on the allowlist of surfaces that must answer while signed out, so the guard check currently runs against an empty list and would pass whatever the code looked like. That is accepted and deliberate: the test is a ratchet, placed so the first server function a feature adds cannot land unguarded without the suite going red. The part of it that is not vacuous today is the allowlist assertion, which pins the exact set of surfaces reachable without a session — that one server function, plus the two route files with request handlers, the liveness probe and better-auth's catch-all — and fails both when a new public surface appears and when a listed one disappears. Revisit if the scan approach changes.

### D-005 (2026-08-23, decided) — The guard scan's ratchet stands under the chain-walking rewrite

D-004 closed with "revisit if the scan approach changes", and the approach changed: the scan no longer slices marker-to-next-same-marker text spans but walks each marker's call chain directly, resolves `createServerFn` and `createFileRoute` from any import specifier, accepts `sessionRequired` only from the resolved real middleware module, and keeps its allowlists per function and per HTTP verb instead of per file. D-004's substantive claim is re-affirmed under the new approach. The production guard check remains vacuous — the one real server function is the allowlisted `hasAuthorizedSessionFn` — but the guard logic itself is now non-vacuously proven against inline fixtures covering guarded, unguarded, trailing-middleware, re-exported-marker, and decoy-guard shapes, so a scan regression fails the suite even while the production list is empty. Revisit under the same condition as D-004.

### D-006 (2026-08-23, decided) — Re-entry guards keep the explicit RefObject<boolean> annotation

`login.tsx` and `_app.tsx` annotate their re-entry guards as `const started: RefObject<boolean> = useRef(false)`. A review proposed dropping the annotation as redundant because React 19's types already infer `RefObject<boolean>`. Removal keeps `tsc --noEmit` green, but Biome then narrows the ref's `current` to the literal `false` and fails `lint/suspicious/noUnnecessaryConditions` on the `if (started.current)` checks in both files, observed directly during the final repair. The annotation is load-bearing for lint, not decoration. Revisit if Biome's narrowing changes or the guard pattern is replaced.

### D-007 (2026-08-26, decided) — Current and hovered navigation links may share a rule that differs only in colour

The navigation marks the current page with a hairline rule under the label in the primary green, and extends a `currentColor` rule under any link the pointer is over. While the pointer sits on a link that is not the current page, the two rules differ only in hue, which a review read as information carried by colour alone. This is accepted. A hover is a transient state the reader produces themselves and locates by their own pointer, so it is not information they have to recover from the page; the durable "you are here" state is carried by `aria-current="page"` for assistive technology and by a rule that is out at full width while every other link's is at zero width for everyone else. Nothing the reader must know is colour-only. Revisit if the current-page rule ever rests at the same width as a hovered one, because the hue would then be the only difference in a state that is not transient.

### D-008 (2026-08-26, decided) — Navigation and the quiet controls are set as 12px letterspaced capitals

The navigation links and the sign-out control are set in the design's eyebrow style — small letterspaced capitals — rather than in sentence-case body text as the scaffold had them. A review raised the drop in type size as a legibility concern. This is accepted: it is the vocabulary of the design David picked, where structure comes from typography rather than boxes, and eyebrows are how a section or a control announces itself. The accessibility bar is held separately and was measured: the touch targets clear WCAG 2.2 SC 2.5.8 with target-size checks explicitly enabled, and the ink pairs clear 4.5:1 in the token audit. Revisit if a control ever depends on the eyebrow style to be recognised as interactive at all, since size then compounds a discoverability problem rather than standing alone as a type choice.

### D-009 (2026-08-26, decided) — Shared class recipes are composed in modules, outside the Tailwind class sorter's reach

The shared shape and control recipes are built as arrays of class fragments joined into one string, so the `className` attributes that consume them hold a variable rather than a literal and Biome's `useSortedClasses` cannot see or sort them. This is accepted. Which of two utilities setting the same property wins is decided by their emission order in the generated stylesheet, never by their order inside a class attribute, so sorting is a readability convention and not a correctness mechanism — and the recipes are already structured around that fact, keeping every state colour out of the shared base string precisely because attribute order cannot order it. Composing in a module is what stops one page drifting from another by retyping the same classes. Revisit if a Tailwind or Biome release makes attribute order semantically meaningful, or if a local `cn`-style helper is introduced for another reason, since the rule's `functions` option would then cover these call sites for free.
