# Project-specific rules

## Effect posture in apps/web

`apps/web` currently has no app-owned async service boundaries. Its async code is better-auth adapter glue, which stays plain-promise because better-auth owns the calling convention. The Effect data layer (the parity pattern of `effect-client.ts` plus `runtime.ts`) lands with the first app-owned feature, tracked in the deferred issue "Adopt the Effect data layer with the first app-owned feature" (issue #7).
