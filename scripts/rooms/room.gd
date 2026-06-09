extends Node2D
## Generic room controller used by every walkable location (bedroom, driveway,
## HQ, ...). A room scene is expected to contain:
##   - a "Player" instance,
##   - a "Spawns" node holding Marker2D spawn points (one named "Default"),
##   - an optional "Hotspots" node holding Marker2D interaction points.
##
## Each hotspot uses node metadata to declare what it does:
##   action = "pickup" : item_id, label                      -> adds to inventory
##   action = "exit"   : target, spawn, [requires, requires_msg] -> change scene
##   action = "duty"   :                                      -> clock in / out
##
## Interaction is proximity-based for this milestone (walk near a hotspot to
## trigger it). A later milestone replaces this with a Look/Use/Talk verb UI.

@export var bounds: Rect2 = Rect2(0, 0, 320, 200)

const PICKUP_RADIUS := 12.0
const EXIT_RADIUS := 14.0
const DUTY_RADIUS := 14.0

var _player: Node2D
var _cooldown: float = 0.4   # grace period so we don't re-trigger the exit we just used
var _fired: Dictionary = {}  # hotspots that have already fired (for one-shot actions)


func _ready() -> void:
	_player = $Player
	_player.bounds = bounds

	var spawn := get_node_or_null("Spawns/" + GameManager.pending_spawn) as Node2D
	if spawn == null:
		spawn = get_node_or_null("Spawns/Default") as Node2D
	if spawn != null:
		_player.global_position = spawn.global_position


func _process(delta: float) -> void:
	if _cooldown > 0.0:
		_cooldown -= delta
	if not has_node("Hotspots"):
		return

	for h in $Hotspots.get_children():
		var dist := _player.global_position.distance_to(h.global_position)
		match String(h.get_meta("action", "")):
			"pickup":
				if dist < PICKUP_RADIUS:
					_do_pickup(h)
			"exit":
				if dist < EXIT_RADIUS and _cooldown <= 0.0:
					_do_exit(h)
					return
			"duty":
				if dist < DUTY_RADIUS and not _fired.has(h):
					_do_duty(h)


func _do_pickup(h: Node) -> void:
	var id := String(h.get_meta("item_id", ""))
	var label := String(h.get_meta("label", id))
	if id != "" and not GameManager.has_item(id):
		GameManager.add_item(id)
		UI.show_message("You pick up the %s." % label)
	h.queue_free()


func _do_exit(h: Node) -> void:
	var requires := String(h.get_meta("requires", ""))
	if requires != "" and not GameManager.has_item(requires):
		UI.show_message(String(h.get_meta("requires_msg", "You can't go there yet.")))
		_cooldown = 1.5  # avoid spamming the message every frame
		return
	SceneManager.goto(String(h.get_meta("target", "")), String(h.get_meta("spawn", "Default")))


func _do_duty(h: Node) -> void:
	_fired[h] = true
	if not GameManager.shift_started:
		GameManager.shift_started = true
		UI.show_message("You report to the duty desk. Your shift has begun, Officer.")
	else:
		GameManager.shift_started = false
		UI.show_message("You clock out. Shift complete — head home and get some rest.")
