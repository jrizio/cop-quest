extends Node2D
## Title screen: night harbor skyline, title card, and a Sierra-style menu.

const MENU := ["Start a New Case", "Restore a Game", "How to Play", "Quit"]

var _hover := -1
var _t := 0.0
var _busy := false


func _ready() -> void:
	UI.in_game = false
	UI.busy = 0
	var s := Sprite2D.new()
	s.texture = load("res://assets/art/bg/title.png")
	s.centered = false
	add_child(s)
	var layer := Node2D.new()
	layer.z_index = 1
	add_child(layer)
	layer.draw.connect(_draw_text.bind(layer))
	set_process(true)
	Sound.music("theme")


func _process(delta: float) -> void:
	_t += delta
	var m := get_viewport().get_mouse_position()
	var h := -1
	for i in MENU.size():
		if _item_rect(i).has_point(m):
			h = i
	_hover = h
	get_child(1).queue_redraw()


func _item_rect(i: int) -> Rect2:
	return Rect2(110, 118 + i * 14, 100, 12)


func _draw_text(ci: CanvasItem) -> void:
	# Title (pixel font at 3x / 1x)
	ci.draw_set_transform(Vector2(160 - PixelFont.measure("COP QUEST") * 1.5, 26), 0.0, Vector2(3, 3))
	PixelFont.draw(ci, Vector2(1, 1), "COP QUEST", Color(0, 0, 0, 0.8))
	PixelFont.draw(ci, Vector2.ZERO, "COP QUEST", Color(0.95, 0.82, 0.35))
	ci.draw_set_transform(Vector2(160 - PixelFont.measure("DEAD RECKONING") * 1.0, 56), 0.0, Vector2(2, 2))
	PixelFont.draw(ci, Vector2(0.5, 0.5), "DEAD RECKONING", Color(0, 0, 0, 0.8))
	PixelFont.draw(ci, Vector2.ZERO, "DEAD RECKONING", Color(0.85, 0.2, 0.2))
	ci.draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
	PixelFont.draw_centered(ci, 160, 80, "A Police Procedural  -  Mesa Verde, California, 1995", Color(0.8, 0.82, 0.95), Color(0, 0, 0, 0.9))
	# menu panel
	ci.draw_rect(Rect2(104, 112, 112, 62), Color(0, 0, 0, 0.55))
	ci.draw_rect(Rect2(104, 112, 112, 62), Color(0.6, 0.55, 0.3), false, 1.0)
	for i in MENU.size():
		var r := _item_rect(i)
		if i == _hover:
			ci.draw_rect(r, Color(0.85, 0.2, 0.2, 0.75))
		PixelFont.draw_centered(ci, r.get_center().x, r.position.y + 2, MENU[i], Color(1, 1, 0.9) if i == _hover else Color(0.85, 0.85, 0.85))
	var blink := int(_t * 2) % 2 == 0
	if blink:
		PixelFont.draw_centered(ci, 160, 186, "Click an option, or press ENTER to begin", Color(0.6, 0.6, 0.7))


func _input(event: InputEvent) -> void:
	if _busy:
		return
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT and _hover >= 0:
		get_viewport().set_input_as_handled()
		_pick(_hover)
	elif event is InputEventKey and event.pressed and not event.echo and event.keycode in [KEY_ENTER, KEY_KP_ENTER, KEY_SPACE]:
		get_viewport().set_input_as_handled()
		_pick(0)


func _pick(i: int) -> void:
	_busy = true
	match i:
		0: await _new_game()
		1: await UI.restore_dialog()
		2: await UI.help()
		3: get_tree().quit()
	_busy = false


func _new_game() -> void:
	GameManager.reset()
	await UI.say("Mesa Verde, California.\nTuesday, March 14th, 1995.\n5:40 A.M.\n\nDetective Gabe Navarro, Homicide, has spent exactly one night in his new house.")
	await UI.say("The moving boxes are still taped shut. The bed frame is somewhere in a truck in Bakersfield. Elena left for the early shift at Mesa Verde General an hour ago.\n\nAnd the phone is about to ring.")
	Sound.stop_music()
	SceneManager.goto_room("bedroom")
