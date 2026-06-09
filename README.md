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

### Core systems

- **GameManager** (autoload) — inventory, flags, shift state, pending spawn.
- **SceneManager** (autoload) — scene transitions with a named spawn point.
- **UI** (autoload) — message box + inventory line, rebuilt in code each run.
- **room.gd** — generic room: spawns the player, runs metadata-driven hotspots
  (`pickup` / `exit` / `duty`).
- **driving.gd** — drives the cruiser, triggers location entrances.
