# Cop Quest: Dead Reckoning

A complete Sierra-style police procedural adventure built in **Godot 4**, styled
after *Police Quest: Open Season* (1993). It has 320x200 256-color "digitized"
rooms, the hidden PQ4 icon bar, points for good procedure, and sudden
career-ending deaths for bad procedure.

> **Mesa Verde, California, 1995.** Homicide detective Gabe Navarro has spent one
> night in his new house when the phone rings. A longshoreman is dead in his car
> at the Pier 9 marina, gun in hand. It looks like a suicide, but it isn't.

The full story, cast, act structure, and how it continues the *Police Quest*
lineage (including where Sonny Bonds left off) are in
[`docs/STORY.md`](docs/STORY.md).

## Running it

1. Install **Godot 4.6+** (standalone): https://godotengine.org/download
2. In Godot, choose **Import**, pick this folder's `project.godot`, then click **Open**.
3. Press **F5** to play.

A full playthrough takes about 30–45 minutes. The maximum score is **142**.

## How to play (PQ4 interface)

| Action | How |
|--------|-----|
| Icon bar | Move the mouse to the **top edge** of the screen. |
| Change cursor | **Right-click** cycles Walk, Look, Hand, Talk, and your selected Item. |
| Use a cursor | **Left-click** on something. Gabe walks over, then acts. |
| Use an item on something | Open Inventory, choose **Select** (arrow), click the item, then click the target with it. |
| Use an item on yourself | In Inventory, choose **Hand** and click the item (gloves, vest, radio, notebook). |
| Case notes / hints | Use the **notebook** in your inventory. |
| Keys | `TAB` inventory · `ESC` control panel · `F5` save · `F7` restore · `F2` sound · `F1` help |

You'll need to follow procedure, just like the originals. Show your badge, sign
the scene log, photograph before you touch, glove up, bag your evidence, call
for backup, wear your vest, and identify yourself. Don't drink and drive.

## Locations

Home (bedroom and driveway) · city map · Pier 9 crime scene · County Coroner ·
MVPD Homicide squad room · HQ basement (Property & Evidence and the Crime Lab) ·
the Rusty Anchor bar · Warehouse 7 (outside and inside) · epilogue.

## Project layout

```
scenes/main.tscn        title screen (entry point)
scripts/core/           autoloads: GameManager (state, score, saves), SceneManager,
                        UI (icon bar, cursor, windows), Sound; PixelFont + font data
scripts/ui/             SierraDialog, InventoryWindow, IconBar
scripts/actors/         Actor (walk-cycle character), Walkmap (walk area + pathfinding)
scripts/rooms/          room.gd base class + one script per location
assets/art/bg|props     room paintings and occluder overlays   (tools/gen_rooms.js)
assets/art/chars        cast walk-cycle sheets                 (tools/gen_sprites.js)
assets/art/ui|items     icon bar, cursors, inventory icons     (tools/gen_ui.js)
assets/audio            synthesized SFX + title theme          (tools/gen_audio.js)
tests/                  automated playthrough / fail-state / input tests
docs/STORY.md           story bible and series map
```

Rooms are plain scripts that extend `Room`, with no `.tscn` per room. Each one
sets its background, walk polygon, perspective scaling and spawns in `_setup()`,
adds hotspots, exits, NPCs and props in `_build()`, and scripts the puzzles in
`interact(id, verb, item)` as coroutines (`await say(...)`, `await choose(...)`,
`award(...)`, `die(...)`).

## Art & audio pipeline (no dependencies, just Node)

All of the art and sound is generated procedurally and checked in:

```
node tools/gen_rooms.js      # paints all rooms (or: node tools/gen_rooms.js marina)
node tools/gen_sprites.js    # re-dresses officer_walk.png into the whole cast
node tools/gen_ui.js         # icons, cursors, items, scripts/core/font_data.gd
node tools/gen_audio.js      # SFX + title theme
```

After regenerating, reopen the project in the editor (or run Godot with
`--headless --import`) so it reimports the PNGs.

- `gen_sprites.js` segments every frame of `officer_walk.png` into body zones at full resolution, then paints each costume, hairstyle, face detail and build. Each character is written at four pre-scaled sizes (`<id>.png`, `@86`, `@74`, `@64`), and the game uses whichever is closest to the on-screen size. Use `DUMP=<id> FR=<col>,<row> OUTF=x.png node tools/gen_sprites.js` to inspect one frame at full size.
- `paint.js` is a small supersampled painter. It does textures, perspective,
  light pools, and a median-cut 256-color palette with ordered dither.
- The bedroom is your photo `assets/art/bedroom_bg.png`, regraded and furnished
  with moving boxes by `gen_rooms.js`. **Don't run the legacy `gen_art.js`**,
  because it overwrites that photo.
- `pixelate.js` and `slice_sheet.js` still turn real photos and renders into
  backgrounds and walk sheets (see `assets/source/README.md`). Coordinates in
  `gen_rooms.js` are mirrored by the room scripts (hotspots, walk areas,
  occluder baselines), so change both together.

## Tests

Run these headless with the Godot console executable:

```
godot --headless --path . res://tests/playthrough.tscn   # plays the whole game: expects 142/142
godot --headless --path . res://tests/fail_states.tscn   # DUI, no vest, no backup, no gun, save/restore
godot --headless --path . res://tests/walk_check.tscn    # every spawn/approach point is walkable + reachable
godot --headless --path . res://tests/click_input.tscn   # real mouse clicks: verb cycling, walk, act, exit
godot --headless --path . res://tests/smoke.tscn         # loads every room
```
