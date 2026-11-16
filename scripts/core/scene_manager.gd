extends Node
## Room transitions (autoload "SceneManager"). Rooms are pure scripts in
## scripts/rooms/<id>.gd (extending Room); they build their own nodes, so a
## room change is: fade out, free the old scene, instance the new script.

const TITLE_SCENE := "res://scenes/main.tscn"

var _switching := false


func current_room() -> Node:
	var s := get_tree().current_scene
	return s if s is Room else null


func goto_room(id: String, spawn: String = "Default", keep_pos_reset: bool = true) -> void:
	if _switching:
		return
	_switching = true
	if keep_pos_reset:
		GameManager.pending_pos = null
	if GameManager.room != "" and GameManager.room != "map" and GameManager.room != id:
		GameManager.last_room = GameManager.room
	GameManager.pending_spawn = spawn
	UI.busy += 1
	await UI.fade_out()
	UI.clear_windows()
	var old := get_tree().current_scene
	var script: GDScript = load("res://scripts/rooms/%s.gd" % id)
	var room: Node = script.new()
	room.name = id
	GameManager.room = id
	if old:
		old.queue_free()
	get_tree().root.add_child(room)
	get_tree().current_scene = room
	UI.in_game = true
	UI.busy -= 1
	_switching = false
	await UI.fade_in()


func restart() -> void:
	UI.clear_windows()
	UI.busy = 0
	UI.in_game = false
	GameManager.reset()
	UI.verb = "walk"
	get_tree().change_scene_to_file(TITLE_SCENE)
