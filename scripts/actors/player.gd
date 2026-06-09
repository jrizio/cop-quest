extends Node2D
## The officer the player controls inside rooms.
## Movement is either:
##   - click-to-walk: the room calls walk_to(point, on_arrive) when you click, or
##   - direct WASD / arrow keys (which cancels any pending click destination).
## When a click-walk reaches its destination, the optional on_arrive callback
## fires once — this is how "walk to the hotspot, THEN apply the verb" works.
##
## Drawn with simple primitives for now; swapped for an animated pixel-art
## sprite later. The origin (0,0) sits at the character's feet.

@export var speed: float = 60.0

## Movement is clamped to this rectangle, set by the room on spawn.
var bounds: Rect2 = Rect2(0, 0, 320, 200)

var _target: Vector2
var _has_target: bool = false
var _on_arrive: Callable = Callable()


## Walk to a world point. If on_arrive is given, it fires once on arrival.
func walk_to(point: Vector2, on_arrive: Callable = Callable()) -> void:
	_target = point
	_has_target = true
	_on_arrive = on_arrive


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
		global_position += kb * speed * delta
		global_position = global_position.clamp(bounds.position, bounds.end)
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
			global_position += to_target.normalized() * speed * delta
			global_position = global_position.clamp(bounds.position, bounds.end)


func _draw() -> void:
	draw_rect(Rect2(-5, -16, 10, 16), Color(0.13, 0.18, 0.45))
	draw_rect(Rect2(-4, -22, 8, 7), Color(0.92, 0.78, 0.64))
	draw_rect(Rect2(-5, -16, 10, 3), Color(0.25, 0.30, 0.60))
