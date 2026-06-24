# design-spec.md | v1.0.0 | 2026-06-12
# Binding design directive for ALL UI work (dashboard, modals, HUD, Lite mode, reports).
# Every UI PR must include screenshots (desktop + mobile, room + Lite) reviewed against
# this spec BEFORE merge.

## 1. Aesthetic direction (commit to it, no drift)
"16-bit broadcast-studio scouting den": a warm, slightly worn 16-bit office watching the
World Cup. CRT/HUD language, pixel craft, paper artifacts. NOT a SaaS dashboard.

## 2. Palette (sampled from room_bg_v02; use these tokens, no new hues)
- `--bg-black:   #000000`  (letterbox, CRT off)
- `--wall-green: #122116` / `--wall-green-2: #1d311f`
- `--wood-900:   #181009` / `--wood-700: #341d0e` / `--wood-500: #4e2912`
- `--wood-300:   #876845` / `--wood-200: #9e7c54` / `--wood-100: #ac885e`
- `--paper:      #f4ede2` / `--paper-bright: #fffcf5`
- Accents (sample EXACT values from props before use): exit-sign red, LCD/LED green,
  desk-lamp amber. Accents are signals only (live, alerts, focus) — never large fills.

## 3. Typography
- Pixel fonts, self-hosted woff2 in `public/assets/fonts/` (NO CDN — site must work from
  Walrus without third-party requests): "Press Start 2P" for headers/HUD labels
  (sparingly, it's loud), "VT323" or "Silkscreen" for body/data/tables.
- Fallback `monospace`. System sans-serif (Inter/Roboto/system-ui) is FORBIDDEN in UI.

## 4. Components (16-bit dialog language)
- 2px hard borders, **border-radius: 0**, bevel via 2-tone border (light top/left =
  wood-100, dark bottom/right = wood-900) like 16-bit dialog boxes.
- Shadows: hard offset (e.g. `4px 4px 0 #000`), NEVER blurred drop-shadows.
- 8px spacing grid; panel fills = paper (documents/reports) or wall-green (HUD/CRT).
- Focus state: 2px accent outline + 1px offset, visible on every interactive element.
- Icons: pixel-art sprites or unicode box-drawing; emoji as icons is FORBIDDEN.

## 5. Motion
- DOM: CSS transitions, transform/opacity only; 120–200ms UI feedback, 300–400ms
  panel/modal; `steps(n)` easing where a pixel feel fits (cursor blink, LED, typing).
- Scene: Phaser tweens only. Do NOT add motion/react|framer-motion deps (bundle budget).
- Respect `prefers-reduced-motion: reduce` (kill non-essential animation).

## 6. Data viz
- Pixel charts: stepped/segmented lines, square markers, scanline grid on CRT-dark or
  paper panels; series colors from accents+wood ramp; tooltips = 16-bit dialog boxes.

## 7. Anti-patterns = instant review rejection ("generic AI design" tells)
- purple/blue gradients, glassmorphism, rounded-xl cards with soft shadows,
  Inter + Tailwind-default look, emoji icons, centered gradient hero text,
  generic admin-template layout, any hue outside section 2.

## 8. Design workflow
- **System-first:** define tokens → components → screens. No one-off styling; every value
  comes from the token system (section 2–4).
- **Motion:** principled durations/easing with accessibility first (`prefers-reduced-motion`).
  CSS transitions + Phaser tweens only — do NOT add `framer-motion`/`motion` (bundle budget).
- **Accessibility:** keyboard navigation + WCAG contrast audit on every UI PR.
