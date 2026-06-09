extends Node
## Handles transitions between scenes (rooms and the driving map).
## Records the requested spawn point so the destination scene knows where to
## place the player/cruiser, then uses Godot's built-in scene switch.

func goto(path: String, spawn: String = "Default") -> void:
	if path == "":
		push_warning("SceneManager.goto() called with an empty path")
		return
	GameManager.pending_spawn = spawn
	# call_deferred is safer when triggered from inside _process / signals.
	get_tree().call_deferred("change_scene_to_file", path)
