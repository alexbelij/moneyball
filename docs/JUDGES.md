<!-- docs/JUDGES.md | v1.0.0 | 2026-06-24 -->

# Judges — 10-Minute Tour

Everything below is visible in the **live app with no wallet** (guest mode is full-featured). Wallet connect only adds the "disagree/roast" write actions and admin tools.

- **Live app:** https://taken.wal.app  (served natively from Walrus Sites — not Vercel/Netlify)
- **On-chain memory (MemWalAccount):** [`0x265869e1…0046e5`](https://suiscan.xyz/mainnet/object/0x265869e118b19010b9af78bf4c91ea0e050560101dad55e79be11949af0046e5)
- **First load may take ~30–50s** if the backend is cold (free tier) — give it a moment, then refresh.

---

## The one thing to look at first (C1 — Memory Depth)

1. Open https://taken.wal.app and click **Skip** past the intro.
2. Click the **Sofia Mendes** agent in the room.
3. Open the **"Day1 vs Now"** tab.

You'll see a genuine before/after: Sofia's **Brier score improved 0.722 → 0.547** after memory-driven evolution, with the **exact parameter deltas** that changed. This is not cosmetic — the new parameters change her *future* picks.

Why it's authentic:
- Every number comes from a **deterministic reflection engine**, not the LLM. After each batch of resolved World Cup matches an agent "sleeps", scores itself (Brier + per-topic calibration), and writes a **new, versioned parameter set as a Walrus blob**. The LLM only phrases the narrative text.
- Evolution is **outcome-triggered** (after ≥3 resolved predictions), tied to real FIFA 2026 results — reproducible, not hallucinated.
- Each of the **5 agents has its own memory namespace**. Provenance badges mark each prediction `[SEED]` or `[LIVE]`.

---

## The full tour

| Step | Where | What it shows | Criterion |
|---|---|---|---|
| 1 | Room (cabinet) | 5 named agents, live match ticker, pixel-art arcade | C2 |
| 2 | Any agent → **Overview** | Methodology + recent predictions with confidence | C1/C3 |
| 3 | Any agent → **Day1 vs Now** | Before/after parameter drift + Brier improvement | **C1** |
| 4 | Any agent → **Evolution** | Dated sleep/evolve events with deltas | **C1** |
| 5 | Agent → **Disagree** (wallet) | Your disagreement is remembered per Sui wallet | C1 |
| 6 | MemWalAccount on Suiscan | On-chain object holding the memories | C3 |
| 7 | Lite-mode toggle | Canvas-free, keyboard nav, reduced motion | C3 |

---

## Verify it's really on Walrus mainnet (C3)

- The site itself is a **Walrus Site** at `taken.wal.app`.
- All durable state — agent parameters, prediction history, sleep/evolution reports, user memories — is stored **only** on Walrus mainnet via the **MemWal SDK**. There is no SQL/Redis/IndexedDB; the backend rebuilds its read-model from Walrus on every boot.
- On-chain proof: the [MemWalAccount object](https://suiscan.xyz/mainnet/object/0x265869e118b19010b9af78bf4c91ea0e050560101dad55e79be11949af0046e5) on Sui mainnet.

---

## Creativity (C2)

A cinematic **16-bit-inspired pixel-art arcade cabinet** (Phaser 3) with five distinct agent personas — Dr. Morgan (Bayesian statistician), Scout Alvarez (intuition scout), Viktor Kane (contrarian), Sofia Mendes (expected-value bettor), Madame Pythia (narrative/numerology oracle). Strict design system (no gradients, no rounded corners, pixel-perfect), animated thought bubbles, interactive props, and shareable retro tickets.

---

## Technical execution (C3)

- TypeScript backend (Express + Socket.io) + React 18 / Phaser 3 frontend, pnpm monorepo.
- **567 automated tests** (211 backend + 356 frontend) with CI guards for design drift and WCAG contrast.
- Deterministic prediction engine; LLM is used only to phrase text, never to decide numbers.
- See [`docs/memory-design.md`](memory-design.md), [`docs/walrus-memory-integration.md`](walrus-memory-integration.md), [`docs/api.md`](api.md).
