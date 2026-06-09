# Cop Quest

A Police Quest–style Sierra adventure built in **Godot 4**, with retro SCI/VGA
pixel-art presentation. Free-roam suburban town: start your day at home, drive
your cruiser to Police HQ, work your shift, and head home.

## Running it

1. Install **Godot 4.x** (standalone, no installer): https://godotengine.org/download
2. Launch Godot → **Import** → pick the `project.godot` in this folder → **Open**.
3. Press **F5** (or the ▶ play button) to run.

> Godot isn't required to *edit* the text files, but you need it to play.

## Controls

- **Rooms:** **left-click** to walk (or use **WASD / arrow keys**).
- **Verbs (Sierra style):** **right-click cycles the active verb** — Walk, Look,
  Use, Talk, Take — shown next to the cursor. Pick a verb, then **left-click a
  hotspot**: your officer walks over and applies it (e.g. *Look* the badge to
  read it, *Take* it to pocket it, *Use* the cruiser to drive).
- **Driving:** **WASD / arrow keys** to drive; reach a building to enter it.

## The M1 loop (vertical slice)

Title screen → **bedroom** (pick up car keys + badge) → **driveway** (enter the
cruiser — needs the keys) → **driving map** (drive up the road to HQ) →
**HQ bullpen** (walk to the duty desk to clock in) → drive home to clock out.

This is intentionally built with placeholder colored blocks. It exists to prove
every core system works end to end before we invest in art. See
[`docs/ROADMAP.md`](docs/ROADMAP.md) for what comes next.

## Project layout

```
scenes/      rooms/  driving/  actors/   + main.tscn (title)
scripts/     core/ (autoloads)  rooms/  driving/  actors/
docs/        roadmap & design notes
```

### Art pipeline

Pixel art is generated procedurally by a dependency-free Node script and checked
in as PNGs under `assets/art/`. To tweak the look, edit the draw routines and
regenerate:

```
node tools/gen_art.js
```

So far the **bedroom** is fully illustrated (background, the officer sprite, and
item icons). The driveway, HQ, and town are next.

To use a **real image** (photo / render / AI-generated) instead, drop an 8-bit
PNG in `assets/source/` and pixelate it onto the game grid:

```
node tools/pixelate.js assets/source/bedroom.png assets/art/bedroom_bg.png --levels 6 --dither
```

See `assets/source/README.md` for options. The pixelator is dependency-free
(includes its own PNG decoder).

For a **character sprite** from a render (it can have a solid background — the
tool removes it and crops to the figure):

```
node tools/pixelate.js assets/source/officer.png assets/art/officer.png \
  --w 44 --h 60 --fit contain --bgremove --bgtol 48 --levels 12 --alphacut 128
```

`--fit contain` fits the whole figure (bottom-aligned feet), `--bgremove`
flood-fills the background to transparent, `--alphacut` makes crisp edges. If you
change the sprite height, update the player sprite's `offset` (set y to
`-height/2`) in `scenes/actors/player.tscn` so the feet stay planted.

**Tuning `--bgtol`:** it's the color distance from the background that counts as
"background." Set it *below* the gap between the background and the nearest
character color, or the fill leaks in and carves chunks out of the figure (e.g.
a light gray bg vs. a white shirt are only ~69 apart, so 48 is safe but 70 eats
the shirt). Lower = safer but may leave a thin halo; raise only if halo remains.

### Depth sorting (walking behind furniture)

The bedroom's bed is a separate cutout sprite (`assets/art/bed.png`, carved from
the photo by `tools/extract_bed.js`) so the player can pass behind it. In
`bedroom.tscn`, the bed and player live under a `World` node with
`y_sort_enabled = true`: nodes are drawn back-to-front by their Y position. The
bed's node sits at its **baseline** (its front edge, ~y=177); when the player's
feet are above that line the bed draws in front, below it the player draws in
front. To make another object an occluder: cut it out (edit the polygon in
`extract_bed.js` or add a similar tool), add it under `World`, and put its node's
Y at the object's front edge.

### Core systems

- **GameManager** (autoload) — inventory, flags, shift state, pending spawn.
- **SceneManager** (autoload) — scene transitions with a named spawn point.
- **UI** (autoload) — message box + inventory line, rebuilt in code each run.
- **room.gd** — generic room: spawns the player, runs metadata-driven hotspots
  (`pickup` / `exit` / `duty`).
- **driving.gd** — drives the cruiser, triggers location entrances.
