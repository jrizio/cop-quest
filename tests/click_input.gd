extends Node
## Dev test: real mouse clicks through the viewport (walk + verb + dialogs).
func _ready() -> void:
	_run.call_deferred()
func _process(_d: float) -> void:
	if UI._stack.is_empty():
		return
	var top = UI._stack.back()
	if top is SierraDialog and top._armed and not top.has_meta("done"):
		top.set_meta("done", true)
		top.chosen.emit(-1 if top.buttons.is_empty() else 0)
func click(p: Vector2, right := false) -> void:
	var ev := InputEventMouseButton.new()
	ev.button_index = MOUSE_BUTTON_RIGHT if right else MOUSE_BUTTON_LEFT
	ev.pressed = true
	ev.position = p
	ev.global_position = p
	get_viewport().push_input(ev, true)
	var up := ev.duplicate()
	up.pressed = false
	get_viewport().push_input(up, true)
func idle() -> void:
	await get_tree().create_timer(0.3).timeout
	while UI.busy > 0 or not UI._stack.is_empty() or SceneManager.current_room().player.is_moving():
		await get_tree().process_frame
func _run() -> void:
	get_tree().current_scene = null
	SceneManager.goto_room("bedroom")
	await get_tree().create_timer(1.5).timeout
	await idle()
	for i in 2: click(Vector2(160, 100), true)   # right-click: walk -> look -> hand
	print("verb after 2 right-clicks: ", UI.verb)
	click(Vector2(17, 124))                       # hand on phone
	await get_tree().create_timer(0.5).timeout
	await idle()
	print("phone_answered=", GameManager.flag("phone_answered"), " player at ", SceneManager.current_room().player.position)
	click(Vector2(240, 120))                      # hand on clothes box
	await get_tree().create_timer(0.5).timeout
	await idle()
	print("outfit=", GameManager.outfit)
	UI.set_verb("walk")
	click(Vector2(100, 90))                        # walk to door -> exit
	await get_tree().create_timer(4.0).timeout
	print("room now: ", GameManager.room, "  score=", GameManager.score)
	print(("PASS" if GameManager.room == "driveway" and GameManager.outfit == "gabe" and GameManager.flag("phone_answered") else "FAIL"), " click test")
	get_tree().quit()
