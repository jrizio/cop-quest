class_name Actor
extends Node2D
## A walking character (the player or an NPC). Uses an 8x4 walk sheet from
## assets/art/chars (rows: down, up, right, left). The node origin is the
## character's feet. Scales with the room's perspective (Sierra style) and
## walks along paths from the room's Walkmap.

signal arrived(ok: bool)

const FW := 64                 # level-1 frame size (tools/gen_sprites.js)
const FH := 96
## Pre-scaled sheet levels, largest first: [scale, file suffix]. The actor
## draws the smallest level that is still >= its on-screen size, so sprites
## are area-downsampled offline instead of decimated at runtime.
const LEVELS := [[1.0, ""], [0.86, "@86"], [0.74, "@74"], [0.64, "@64"]]
const ROW_DOWN := 0
const ROW_UP := 1
const ROW_RIGHT := 2
const ROW_LEFT := 3

var speed := 62.0
var walk_fps := 10.0
var sheet_id := ""
var room: Node = null          # owning Room (perspective + walkmap)
var fixed_scale := 0.0         # >0 overrides perspective (e.g. clerks behind a counter)

var _sprite: Sprite2D
var _sheets: Array = []        # Texture2D per LEVELS entry
var _level := -1
var _s := 1.0                  # current on-screen scale
var _row := ROW_DOWN
var _anim := 0.0
var _path := PackedVector2Array()
var _moving := false
var _stuck := 0.0


func _init(p_sheet: String = "gabe", facing: int = ROW_DOWN) -> void:
	_sprite = Sprite2D.new()
	_sprite.centered = false
	_sprite.hframes = 8
	_sprite.vframes = 4
	add_child(_sprite)
	set_sheet(p_sheet)
	face(facing)


func set_sheet(id: String) -> void:
	sheet_id = id
	_sheets.clear()
	for lv in LEVELS:
		var path := "res://assets/art/chars/%s%s.png" % [id, lv[1]]
		_sheets.append(load(path) if ResourceLoader.exists(path) else null)
	_level = -1
	_apply_scale()


func _apply_scale() -> void:
	# pick the smallest pre-scaled sheet that is still at least as big as needed
	var lvl := 0
	for i in LEVELS.size():
		if _sheets[i] != null and LEVELS[i][0] >= _s - 0.001:
			lvl = i
	if lvl != _level:
		_level = lvl
		var tex: Texture2D = _sheets[lvl]
		var fr := _sprite.frame
		_sprite.texture = tex
		_sprite.frame = fr
		var fw := tex.get_width() / 8.0
		var fh := tex.get_height() / 4.0
		_sprite.offset = Vector2(-roundf(fw / 2.0), -fh + 1)
	var k: float = _s / LEVELS[_level][0]
	_sprite.scale = Vector2(k, k)


func face(row: int) -> void:
	_row = row
	_sprite.frame = _row * 8


func face_point(p: Vector2) -> void:
	var v := p - position
	if absf(v.x) > absf(v.y) * 0.6:
		face(ROW_RIGHT if v.x > 0 else ROW_LEFT)
	else:
		face(ROW_DOWN if v.y > 0 else ROW_UP)


func place(p: Vector2) -> void:
	position = p
	_update_scale()


func is_moving() -> bool:
	return _moving


## Start walking to a point (clamped to the walkable area). Emits `arrived`.
func walk_to(p: Vector2) -> void:
	var wm: Walkmap = room.walkmap if room else null
	var target := wm.clamp_point(p) if wm else p
	_path = wm.find_path(wm.clamp_point(position), target) if wm else PackedVector2Array([target])
	_moving = true
	_stuck = 0.0


## Walk and wait. Returns true if the destination was reached.
func walk_to_async(p: Vector2) -> bool:
	walk_to(p)
	var ok: bool = await arrived
	return ok


func stop() -> void:
	if _moving:
		_moving = false
		_path.clear()
		arrived.emit(false)


func _process(delta: float) -> void:
	var moved := false
	if _moving:
		if _path.is_empty():
			_moving = false
			arrived.emit(true)
		else:
			var tgt := _path[0]
			var step := speed * delta * clampf(_s * 1.15, 0.45, 1.2)
			var to := tgt - position
			if to.length() <= step:
				position = tgt
				_path.remove_at(0)
			else:
				var d := to.normalized() * step
				var wm: Walkmap = room.walkmap if room else null
				var nxt := position + d
				if wm and not wm.is_walkable(nxt):
					# slide along edges
					if wm.is_walkable(position + Vector2(d.x, 0)):
						nxt = position + Vector2(d.x, 0)
					elif wm.is_walkable(position + Vector2(0, d.y)):
						nxt = position + Vector2(0, d.y)
					else:
						nxt = position
				if nxt == position:
					_stuck += delta
					if _stuck > 0.25:
						_moving = false
						_path.clear()
						arrived.emit(position.distance_to(tgt) < 24.0)
				else:
					_stuck = 0.0
					if absf(d.x) > absf(d.y) * 0.8:
						_row = ROW_RIGHT if d.x > 0 else ROW_LEFT
					else:
						_row = ROW_DOWN if d.y > 0 else ROW_UP
					position = nxt
					moved = true
			_update_scale()
	if moved:
		_anim += delta
		_sprite.frame = _row * 8 + 1 + int(_anim * walk_fps) % 7
	else:
		_anim = 0.0
		_sprite.frame = _row * 8


func _update_scale() -> void:
	var s := 1.0
	if fixed_scale > 0.0:
		s = fixed_scale
	elif room and room.has_method("scale_at"):
		s = room.scale_at(position.y)
	if not is_equal_approx(s, _s) or _level < 0:
		_s = s
		_apply_scale()


## Screen-space bounds of the sprite (for click hit-testing).
func bounds() -> Rect2:
	var w := FW * _s * 0.52
	var h := (FH - 6) * _s
	return Rect2(position.x - w / 2.0, position.y - h, w, h)
