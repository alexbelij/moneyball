<!-- TASK-06-frontend-type-errors.md | v0.1.0 | 2026-06-12 -->
# T06 — Fix 5 pre-existing frontend type errors (deploy blocker)

## Context
`apps/frontend` build script is `tsc && vite build`. On a fresh install, `tsc --noEmit`
fails with 5 errors — meaning the production build for the Walrus Sites deploy will fail.
Errors come from dependency drift (`@mysten/dapp-kit` / `@mysten/sui` resolved newer
than when code was written), not from recent task branches.

## Error list (fresh install, tsc 5.x)
1. `src/sui/dapp-kit.ts(14)` + `(15)`: `createNetworkConfig` entries now require a `network` field
   (`{ url }` is not assignable to `NetworkConfig`).
2. `src/components/WalletControls.tsx`: `currentWallet.name` — property `name` no longer on the
   `connecting/disconnected` union members; guard on `connectionStatus === 'connected'` or use optional access.
3. `src/components/WalletDebugPanel.tsx(52)`: same `currentWallet.name` union issue.
4. `src/hooks/useSocket.ts(41)`: `emit` called with 2 args where the typed signature takes 1 —
   check `@moneyball/shared` event typing and fix the call or the type.

## Requirements
1. Fix all 5 errors with minimal runtime-behavior change. No `any`, no `@ts-ignore`
   unless impossible otherwise (then comment why).
2. Decide and document in the PR: either pin the @mysten package versions in package.json
   (exact versions, no `^`) or adapt code to the new API. Prefer adapting.
3. Add CI step `pnpm -C apps/frontend exec tsc -p tsconfig.json --noEmit` once green.
4. Manually smoke: `pnpm -C apps/frontend build` must complete.

## Acceptance criteria
- `tsc --noEmit` and `vite build` green on fresh install; CI typecheck step added and green.
- Wallet connect flow unchanged (describe what you re-tested in the PR).
