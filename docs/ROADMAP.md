# Cop Quest — Roadmap

## Milestones

- **M1 — Walking skeleton (DONE / current).** Title → bedroom → driveway →
  driving map → HQ → clock in → home. Placeholder art. Proves every core
  system once: scene management, spawn points, player movement, inventory,
  hotspots, exits, the driving mode, and the shift toggle.

- **M2 — The Sierra feel.** Look / Use / Talk / Take verb interface (replacing
  proximity auto-triggers); proper message/narration boxes; save & load; a
  day/time HUD; upgrade the player to a `CharacterBody2D` with real walkable-area
  pathfinding (`NavigationRegion2D`). First real pixel-art room: the bedroom.

- **M3 — The town.** True isometric `TileMap` driving map with a road network
  and a following `Camera2D` over a larger town; 2–3 more visitable buildings
  (diner, gas station, park). Free-roam driving between locations.

- **M4 — A playable shift.** Clock in → briefing → vehicle-inspection procedure
  → one call/objective out in town → return → clock out. First complete loop,
  including the Police Quest "do procedures in the correct order" check.

- **M5 — Content & polish.** More rooms and NPCs, a small case to solve, music
  & SFX, a title menu, and a web export to share via a link.

## Known M1 simplifications (intentional, revisited later)

- Interactions are **proximity-based**, not verb-based (M2).
- Movement has **no collision** — the player/cruiser are clamped to a rectangle
  rather than blocked by walls/buildings (M2/M3).
- The driving map is a small **top-down placeholder**, not isometric (M3).
- Hotspots are simple colored squares so they're visible without art.

## Open design questions

- Verb UI style: classic verb list vs. right-click verb cycling.
- Scope: single tutorial-shift demo first, or a multi-day story.
- Pixel-art spec: lock a palette + sprite dimensions before M2 art begins.
