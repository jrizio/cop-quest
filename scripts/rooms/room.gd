extends Node2D
## Generic room controller used by every walkable location.
##
## A room scene contains:
##   - a "Player" instance,
##   - a "Spawns" node with Marker2D spawn points (one named "Default"),
##   - an optional "Hotspots" node with Marker2D interaction points.
##
## Interaction is now VERB-BASED (Sierra style). The player picks a verb by
## right-clicking (handled in UI), then left-clicks a hotspot. We walk to the
## hotspot first, then apply the current verb on arrival.
##
## Hotspot metadata:
##   action = "pickup" : item_id, label, [look]      -> Take/Use adds to inventory
##   action = "exit"   : target, spawn, [look, requires, requires_msg] -> change scene
##   action = "duty"   : [look]                       -> Use/Talk clocks in / out
##   look (any)        : description shown by the Look verb

@export var bounds: Rect2 = Rect2(0, 0, 320, 200)

const CLICK_RADIUS := 16.0

var _player: Node2D


func _ready() -> void:
	# Player may be nested under a Y-sorted "World" node (for depth sorting with
	# furniture) or be a direct child in simpler rooms.
	_player = get_node_or_null("World/Player")
	if _player == null:
		_player = get_node_or_null("Player")
	_player.bounds = bounds

	var spawn := get_node_or_null("Spawns/" + GameManager.pending_spawn) as Node2D
	if spawn == null:
		spawn = get_node_or_null("Spawns/Default") as Node2D
	if spawn != null:
		_player.global_position = spawn.global_position


func _input(event: InputEvent) -> void:
	# Use _input (not _unhandled_input) so background ColorRects/Labels, which
	# capture mouse events by default, can't swallow the click before us.
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		var p := get_global_mouse_position()
		var hs := _hotspot_at(p)
		if hs != null:
			var verb := UI.current_verb()
			_player.walk_to(hs.global_position, func() -> void: _interact(hs, verb))
		else:
			_player.walk_to(p)
		get_viewport().set_input_as_handled()


func _hotspot_at(point: Vector2) -> Node2D:
	if not has_node("Hotspots"):
		return null
	var best: Node2D = null
	var best_dist := CLICK_RADIUS
	for h in $Hotspots.get_children():
		var d := point.distance_to((h as Node2D).global_position)
		if d <= best_dist:
			best = h
			best_dist = d
	return best


func _interact(hs: Node, verb: String) -> void:
	var action := String(hs.get_meta("action", ""))

	if verb == "Walk":
		return  # we already walked there; nothing else to do

	if verb == "Look":
		UI.show_message(String(hs.get_meta("look", "You see nothing special.")))
		return

	if verb == "Talk":
		if action == "duty":
			_do_duty(hs)
		else:
			UI.show_message("There's no response.")
		return

	if verb == "Take":
		if action == "pickup":
			_do_pickup(hs)
		else:
			UI.show_message("You can't take that.")
		return

	if verb == "Use":
		match action:
			"pickup": _do_pickup(hs)
			"exit": _do_exit(hs)
			"duty": _do_duty(hs)
			_: UI.show_message("Nothing happens.")


func _do_pickup(hs: Node) -> void:
	var id := String(hs.get_meta("item_id", ""))
	var label := String(hs.get_meta("label", id))
	if id != "" and not GameManager.has_item(id):
		GameManager.add_item(id)
		UI.show_message("You take the %s." % label)
	hs.queue_free()


func _do_exit(hs: Node) -> void:
	var requires := String(hs.get_meta("requires", ""))
	if requires != "" and not GameManager.has_item(requires):
		UI.show_message(String(hs.get_meta("requires_msg", "You can't go there yet.")))
		return
	SceneManager.goto(String(hs.get_meta("target", "")), String(hs.get_meta("spawn", "Default")))


func _do_duty(_hs: Node) -> void:
	if not GameManager.shift_started:
		GameManager.shift_started = true
		UI.show_message("You report to the duty desk. Your shift has begun, Officer.")
	else:
		GameManager.shift_started = false
		UI.show_message("You clock out. Shift complete — head home and get some rest.")
