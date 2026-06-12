<!-- interactivity-spec.md | v0.1.0 | 2026-06-12 -->
# Interactive Objects & States Spec

Restored by Anna 2026-06-12 (DM). Source of truth for prop states, hover behaviour and agent animations. Status legend: **MVP** = required for submission, **V2** = nice-to-have, **?** = open question (Anna to decide).

## Global hover rule
Every interactive element must visually stand out on hover: outline + slight glow (pixel-consistent, no smooth blur halos).

## Objects

| Object | States / behaviour | Status |
|---|---|---|
| **TV** | 1) `off`: black screen + red LED (bottom-right). 2) `static`: noise/flicker anim (JS/CSS) + green LED — "no broadcast". 3) `live`: looped match-frame anim or splash w/ flicker + green LED. Sprites done (`6cf8c2f`, props.json `tv_set.states`). | MVP |
| **Door** | `closed`; hover = slightly ajar outward (sprite TBD — needs drawing); click → corridor location transition. | hover MVP, corridor V2? |
| **Light switch** | toggle room lighting | ? |
| **Radio / cassette player** | not placed yet; click toggles online radio; mini browser player appears at bottom | ? |
| **Coffee machine** | click → brews fresh coffee | ? |
| **Folders / notebooks** | click → modal with random memory data (club/match info etc.) — demonstrates agent memory storage/processing. Good for Memory Depth judging criterion. | MVP |
| **Agents** | hover: turn head to camera (turn around if back to us), stop walking. Click → data modal (predictions/evolution/memory tabs). | MVP |
| **Mugs / cups** | pixel steam animation for 1–3 min after a drink is brewed | tied to coffee machine ? |

## Agent animations (hardest)
- walk; sit (side / half-side / back / facing camera depending on seat);
- shuffle/hold papers (walking and sitting);
- coffee run: approach machine and occlude it **standing back to camera** — avoids animating cup/coffee appearing.

## Notes
- LED colors: red `#c03030`, green `#39c04a` (already in props.json).
- All anims sprite-frame or JS/CSS; no smooth tweens that break pixel-art style.
