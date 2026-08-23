# @postlude/ui

Design tokens for Postlude.

`src/theme.css` defines the semantic `--pl-*` tokens (oklch only, light plus
`prefers-color-scheme: dark`) and maps them into Tailwind via `@theme`. The
default Tailwind palette is disabled — components color themselves exclusively
through these tokens.

The current values are a scaffold placeholder. The design comparison
(`/heirloom` vs `/warm-print`) supplies the real candidates; the winning seed
replaces this file via design-init.
