extends Node2D
## Title screen. Click or press any key to start the shift in the bedroom.

func _unhandled_input(event: InputEvent) -> void:
	var start := false
	if event is InputEventMouseButton and event.pressed:
		start = true
	elif event is InputEventKey and event.pressed and not event.echo:
		start = true
	if start:
		SceneManager.goto("res://scenes/rooms/bedroom.tscn", "Default")
