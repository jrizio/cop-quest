# Cop Quest — Roadmap

## Milestones

- **M1 — Walking skeleton (DONE / current).** Title → bedroom → driveway →
  driving map → HQ → clock in → home. Placeholder art. Proves every core
  system once: scene management, spawn points, player movement, inventory,
  hotspots, exits, the driving mode, and the shift toggle.

- **M2 — The Sierra feel.** Built in testable increments:
  - **2A (DONE):** Right-click verb interface (Walk / Look / Use / Talk / Take),
    cursor verb label, walk-to-then-act, walk-to-exit. Replaces M1's proximity
    auto-triggers.
  - **2B:** Collision + walkable areas — player becomes a `CharacterBody2D`,
    furniture/walls become solid (sliding; navmesh pathfinding is a later polish).
  - **2C:** Save & load; day/time HUD.
  - **2D:** First procedurally-generated pixel-art room (the bedroom) + locked
    palette and sprite dimensions.

- **M3 — The town.** True isometric `TileMap` driving map with a road network
  and a following `Camera2D` over a larger town; 2–3 more visitable buildings
  (diner, gas station, park). Free-roam driving between locations.

- **M4 — A playable shift.** Clock in → briefing → vehicle-inspection procedure
  → one call/objective out in town → return → clock out. First complete loop,
  including the Police Quest "do procedures in the correct order" check.

- **M5 — Content & polish.** More rooms and NPCs, a small case to solve, music
  & SFX, a title menu, and a web export to share via a link.

## Known simplifications (intentional, revisited later)

- Movement has **no collision** yet — the player/cruiser are clamped to a
  rectangle rather than blocked by walls/buildings (M2B / M3).
- The driving map is a small **top-down placeholder**, not isometric (M3).
- Driving-map building entrances are still **proximity-based** (you drive into
  them) — intentional; verbs only apply on foot.
- Hotspots are simple colored squares so they're visible without art (M2D).

## Open design questions

- Verb UI style: classic verb list vs. right-click verb cycling.
- Scope: single tutorial-shift demo first, or a multi-day story.
- Pixel-art spec: lock a palette + sprite dimensions before M2 art begins.
