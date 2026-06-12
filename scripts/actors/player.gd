extends Node2D
## The officer the player controls inside rooms.
## Movement is either:
##   - click-to-walk: the room calls walk_to(point, on_arrive) when you click, or
##   - direct WASD / arrow keys (which cancels any pending click destination).
## When a click-walk reaches its destination, the optional on_arrive callback
## fires once — this is how "walk to the hotspot, THEN apply the verb" works.
##
## The walkable area is a polygon (the room's visible floor), set by the room
## from a Polygon2D child named "WalkArea". The origin (0,0) is at the
## character's feet, so the polygon constrains where the feet can stand.
## Rooms without a WalkArea fall back to the `bounds` rectangle.

@export var speed: float = 60.0

## Fallback rectangle when no walk polygon is set.
var bounds: Rect2 = Rect2(0, 0, 320, 200)

## Visible-floor polygon in room coordinates. Empty = use bounds.
var walk_poly: PackedVector2Array = PackedVector2Array()

## Perspective scaling (Sierra style): the character shrinks toward the back of
## the room. Set by the room. Disabled while near_y <= far_y.
var persp_far_y: float = 0.0      # room Y of the deepest walkable line
var persp_near_y: float = 0.0     # room Y of the front of the screen
var persp_far_scale: float = 1.0  # character scale at far_y
var persp_near_scale: float = 1.0 # character scale at near_y

var _target: Vector2
var _has_target: bool = false
var _on_arrive: Callable = Callable()


## Walk to a world point. If on_arrive is given, it fires once on arrival.
## The destination is clamped into the walkable area.
func walk_to(point: Vector2, on_arrive: Callable = Callable()) -> void:
	_target = clamp_to_walkable(point)
	_has_target = true
	_on_arrive = on_arrive


## Teleport (spawn) to a point, applying walkable clamping and perspective.
func place_at(point: Vector2) -> void:
	global_position = clamp_to_walkable(point)
	_update_perspective()


func _process(delta: float) -> void:
	var kb := Vector2(
		Input.get_axis("ui_left", "ui_right"),
		Input.get_axis("ui_up", "ui_down"))
	if Input.is_key_pressed(KEY_A): kb.x -= 1.0
	if Input.is_key_pressed(KEY_D): kb.x += 1.0
	if Input.is_key_pressed(KEY_W): kb.y -= 1.0
	if Input.is_key_pressed(KEY_S): kb.y += 1.0
	kb = kb.limit_length(1.0)

	# Keyboard control overrides (and cancels) any click destination.
	if kb != Vector2.ZERO:
		_has_target = false
		_on_arrive = Callable()
		_move(kb * speed * delta)
		return

	if _has_target:
		var to_target := _target - global_position
		if to_target.length() <= 2.0:
			_has_target = false
			var cb := _on_arrive
			_on_arrive = Callable()
			if cb.is_valid():
				cb.call()
		else:
			_move(to_target.normalized() * speed * delta)


## Apply a movement step, sliding along the walkable-area edge when the full
## step would leave it (try full step, then x-only, then y-only).
## Steps are scaled with perspective so walking "into" the room looks natural.
func _move(step: Vector2) -> void:
	step *= scale.x
	for attempt in [step, Vector2(step.x, 0.0), Vector2(0.0, step.y)]:
		var next: Vector2 = global_position + attempt
		if _is_walkable(next):
			global_position = next
			_update_perspective()
			return
	# Fully blocked: cancel a pending click-walk so we don't grind forever.
	_has_target = false


func _update_perspective() -> void:
	if persp_near_y <= persp_far_y:
		return
	var t := clampf((global_position.y - persp_far_y) / (persp_near_y - persp_far_y), 0.0, 1.0)
	var s := lerpf(persp_far_scale, persp_near_scale, t)
	scale = Vector2(s, s)


func _is_walkable(p: Vector2) -> bool:
	if walk_poly.size() >= 3:
		return Geometry2D.is_point_in_polygon(p, walk_poly)
	return p == p.clamp(bounds.position, bounds.end)


## Nearest in-area point to `p` (p itself if already inside).
func clamp_to_walkable(p: Vector2) -> Vector2:
	if walk_poly.size() >= 3:
		if Geometry2D.is_point_in_polygon(p, walk_poly):
			return p
		var best := p
		var best_d := INF
		for i in walk_poly.size():
			var a := walk_poly[i]
			var b := walk_poly[(i + 1) % walk_poly.size()]
			var q := Geometry2D.get_closest_point_to_segment(p, a, b)
			var d := p.distance_squared_to(q)
			if d < best_d:
				best_d = d
				best = q
		# Nudge slightly inward so the point tests as inside.
		return best + (get_polygon_centroid() - best).normalized() * 0.5
	return p.clamp(bounds.position, bounds.end)


func get_polygon_centroid() -> Vector2:
	var c := Vector2.ZERO
	for v in walk_poly:
		c += v
	return c / walk_poly.size()
