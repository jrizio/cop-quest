extends Node
## Dev test: exercises the fail states. godot --headless --path . res://tests/fail_states.tscn
var deaths := []
func _ready() -> void:
	_run.call_deferred()
func _process(_d: float) -> void:
	if UI._stack.is_empty():
		return
	var top = UI._stack.back()
	if not (top is SierraDialog) or not top._armed or top.has_meta("done"):
		return
	top.set_meta("done", true)
	if top.buttons.size() == 3 and String(top.buttons[0]) == "Restore":
		deaths.append(top.title)
		return
	if top.buttons.is_empty():
		top.chosen.emit(-1)
	else:
		top.chosen.emit(0)
func reset(items: Array, flags: Array) -> void:
	UI.clear_windows()
	UI.busy = 0
	GameManager.reset()
	for i in items: GameManager.add_item(i)
	for f in flags: GameManager.set_flag(f)
	deaths.clear()
func scenario(name: String, items: Array, flags: Array, room: String, fn: Callable, expect_death: bool) -> void:
	reset(items, flags)
	SceneManager.goto_room(room)
	await get_tree().create_timer(0.9).timeout
	await fn.call()
	await get_tree().create_timer(0.5).timeout
	var died := not deaths.is_empty()
	print(("PASS " if died == expect_death else "FAIL "), name, "  died=", died, " ", deaths)
func wait_showdown() -> void:
	while true:
		await get_tree().process_frame
		var r = SceneManager.current_room()
		if r and r.has_method("_too_slow") and (r._showdown or r.dead):
			return
func _run() -> void:
	get_tree().current_scene = null
	await scenario("DUI", ["keys"], ["drank_beer", "phone_answered"], "map", func() -> void:
		await SceneManager.current_room().exit_check("hq"), true)
	await scenario("no vest, too slow", ["gun", "cuffs"], ["backup", "warrant"], "ware_int", func() -> void:
		await wait_showdown()
		await get_tree().create_timer(6.0).timeout, true)
	await scenario("vest, backup, too slow (survives)", ["gun", "cuffs", "vest"], ["backup", "vest_worn", "warrant"], "ware_int", func() -> void:
		await wait_showdown()
		await get_tree().create_timer(6.0).timeout
		print("   maddox_down=", GameManager.flag("maddox_down")), false)
	await scenario("no backup, shoots", ["gun", "cuffs", "vest"], ["vest_worn", "warrant"], "ware_int", func() -> void:
		await wait_showdown()
		var r = SceneManager.current_room()
		await r._run(r.hotspot("maddox"), "item", "gun"), true)
	await scenario("no gun", ["vest"], ["vest_worn", "backup", "warrant"], "ware_int", func() -> void:
		await wait_showdown(), true)
	reset(["badge", "gun"], ["phone_answered", "log_signed"])
	GameManager.award("sign_log")
	GameManager.room = "marina"
	var ok := GameManager.save_game(7, Vector2(60, 180))
	GameManager.reset()
	GameManager.load_game(7)
	await get_tree().create_timer(1.0).timeout
	var r = SceneManager.current_room()
	print(("PASS " if ok and GameManager.has_item("gun") and GameManager.flag("log_signed") and GameManager.score == 3 and r.has_method("_sign_log") and r.player.position.distance_to(Vector2(60, 180)) < 2 else "FAIL "), "save/restore  label=", GameManager.slot_label(7))
	DirAccess.remove_absolute(ProjectSettings.globalize_path("user://save_7.json"))
	print("DEATHS DONE")
	get_tree().quit()
