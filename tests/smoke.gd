extends Node
## Dev smoke test: loads every room in turn (with autoloads), optionally
## screenshots each one. Run: godot --path . res://tests/smoke.tscn [-- shots]
const ROOMS := ["bedroom", "driveway", "map", "marina", "squad", "basement", "coroner", "bar", "ware_ext", "ware_int", "ending"]
var shots := false

func _ready() -> void:
	shots = OS.get_cmdline_user_args().has("shots")
	for f in ["phone_answered", "body_searched", "warrant", "backup", "log_signed"]:
		GameManager.set_flag(f)
	for it in ["notebook", "keys", "badge", "gun", "cuffs", "gloves", "camera", "flashlight", "radio", "vest", "casing"]:
		GameManager.add_item(it)
	GameManager.outfit = "gabe"
	_run.call_deferred()

func _run() -> void:
	get_tree().current_scene = null
	for r in ROOMS:
		SceneManager.goto_room(r)
		await get_tree().create_timer(1.2).timeout
		UI.clear_windows()
		print("ROOM OK: ", r, " score=", GameManager.score)
		if shots:
			await RenderingServer.frame_post_draw
			get_viewport().get_texture().get_image().save_png("user://shot_%s.png" % r)
	print("SMOKE DONE")
	get_tree().quit()
