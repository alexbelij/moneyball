<!-- TASK-09-demo-script.md | v0.1.0 | 2026-06-12 -->
# T09 — Demo video script (<3 min) draft

## Goal
Draft `docs/demo-script.md`: a timed shot-by-shot script for the hackathon video.
Judging criteria to optimize for, in order: Agent Memory Depth, Creativity,
Walrus Mainnet usage.

## Requirements
1. Hard limit 2:45 total; timestamped beats (e.g. `0:00–0:15 — cold open: ...`).
2. Structure: hook (cabinet wide shot) → problem (predictions w/o memory are coin
   flips) → memory depth proof (Day 1 vs Day 4+ agent answers side-by-side, takeaway
   milestones, evolution tab with param drift) → Walrus/MemWal mainnet writes shown
   live (relayer log or explorer) → lite mode + a11y flash (1 beat) → close with
   leaderboard + repo/site URL.
3. For every beat: exact screen/action to record, one-line voiceover text (EN,
   conversational, no marketing fluff), and fallback if the live backend is asleep.
4. Mark every claim that must be true at recording time (e.g. "5 agents have ≥N
   resolved predictions") as a `PRECONDITION:` line so we can prep data beforehand.
5. No video editing work — script only. Use real UI states reachable in the current
   build (cite component/tab names from the code, no invented screens).

## Acceptance criteria
- Reading the script aloud fits in 2:45 (state your word count; ~150 wpm budget).
- Every PRECONDITION is listed in a summary table at the top.
