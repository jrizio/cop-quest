extends Node2D
## Controller for the driving map. Moves the cruiser with arrow keys / WASD and
## switches to a destination scene when the cruiser reaches a location entrance.
##
## Expected scene contents:
##   - a "Cruiser" node (the controlled vehicle, with a Camera2D child),
##   - a "Spawns" node with Marker2D spawn points (one named "Default"),
##   - an "Entrances" node with Marker2D points carrying metadata:
##       target = "res://..."  spawn = "FromTown"
##
## This is a top-down placeholder. The true isometric tile-based town with a
## proper road network is the M3 deliverable.

@export var speed: float = 95.0
@export var bounds: Rect2 = Rect2(20, 20, 560, 360)

const ENTRANCE_RADIUS := 16.0

var _cruiser: Node2D
var _cooldown: float = 0.5


func _ready() -> void:
	_cruiser = $Cruiser
	var spawn := get_node_or_null("Spawns/" + GameManager.pending_spawn) as Node2D
	if spawn == null:
		spawn = get_node_or_null("Spawns/Default") as Node2D
	if spawn != null:
		_cruiser.global_position = spawn.global_position


func _process(delta: float) -> void:
	if _cooldown > 0.0:
		_cooldown -= delta

	var v := Vector2(
		Input.get_axis("ui_left", "ui_right"),
		Input.get_axis("ui_up", "ui_down"))
	if Input.is_key_pressed(KEY_A): v.x -= 1.0
	if Input.is_key_pressed(KEY_D): v.x += 1.0
	if Input.is_key_pressed(KEY_W): v.y -= 1.0
	if Input.is_key_pressed(KEY_S): v.y += 1.0
	v = v.limit_length(1.0)

	_cruiser.global_position += v * speed * delta
	_cruiser.global_position = _cruiser.global_position.clamp(bounds.position, bounds.end)

	if _cooldown <= 0.0 and has_node("Entrances"):
		for e in $Entrances.get_children():
			if _cruiser.global_position.distance_to(e.global_position) < ENTRANCE_RADIUS:
				SceneManager.goto(String(e.get_meta("target", "")), String(e.get_meta("spawn", "Default")))
				return
