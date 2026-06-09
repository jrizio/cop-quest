extends Node2D
## The officer the player controls inside rooms.
## Supports both classic Sierra click-to-walk and WASD/arrow direct control.
## Drawn with simple primitives for now — swapped for an animated pixel-art
## sprite in a later milestone. The origin (0,0) sits at the character's feet.

@export var speed: float = 60.0

## Movement is clamped to this rectangle, set by the room on spawn.
var bounds: Rect2 = Rect2(0, 0, 320, 200)

var _target: Vector2
var _has_target: bool = false


func _process(delta: float) -> void:
	var kb := Vector2(
		Input.get_axis("ui_left", "ui_right"),
		Input.get_axis("ui_up", "ui_down"))
	if Input.is_key_pressed(KEY_A): kb.x -= 1.0
	if Input.is_key_pressed(KEY_D): kb.x += 1.0
	if Input.is_key_pressed(KEY_W): kb.y -= 1.0
	if Input.is_key_pressed(KEY_S): kb.y += 1.0
	kb = kb.limit_length(1.0)

	var move := Vector2.ZERO
	if kb != Vector2.ZERO:
		_has_target = false
		move = kb
	elif _has_target:
		var to_target := _target - global_position
		if to_target.length() <= 2.0:
			_has_target = false
		else:
			move = to_target.normalized()

	if move != Vector2.ZERO:
		global_position += move * speed * delta
		global_position = global_position.clamp(bounds.position, bounds.end)


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		_target = get_global_mouse_position()
		_has_target = true


func _draw() -> void:
	# Body (uniform), then head, then a lighter shirt band.
	draw_rect(Rect2(-5, -16, 10, 16), Color(0.13, 0.18, 0.45))
	draw_rect(Rect2(-4, -22, 8, 7), Color(0.92, 0.78, 0.64))
	draw_rect(Rect2(-5, -16, 10, 3), Color(0.25, 0.30, 0.60))
