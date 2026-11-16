extends CanvasLayer
## Sierra SCI1.1 interface (autoload "UI").
##   - hidden icon bar (move the mouse to the top edge),
##   - verb cursor (right-click cycles Walk > Look > Hand > Talk > Item),
##   - modal message / choice windows you can `await`,
##   - inventory window, control panel, save / restore, death screen,
##   - screen fades and the "busy" (cutscene) state.

const VERB_CYCLE := ["walk", "look", "hand", "talk", "item"]
const CURSOR_HOT := {"arrow": Vector2(1, 1), "exit": Vector2(14, 8)}

var verb := "walk"
var busy := 0                 # >0 while a scripted sequence runs
var hover_text := ""          # hotspot name under the cursor (set by rooms)
var in_game := false          # false on the title screen

var _root: Control
var _bar: IconBar
var _modal: Control
var _hover: Control
var _fade: ColorRect
var _cursor: TextureRect
var _stack: Array = []        # open dialogs / inventory (top = last)
var _cursor_tex := {}
var _item_tex := {}


func _ready() -> void:
	layer = 100
	process_mode = Node.PROCESS_MODE_ALWAYS
	_root = Control.new()
	_root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_root.size = Vector2(320, 200)
	add_child(_root)

	_hover = Control.new()
	_hover.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_hover.size = Vector2(320, 200)
	_hover.draw.connect(_draw_hover)
	_root.add_child(_hover)

	_bar = IconBar.new()
	_bar.visible = false
	_bar.pressed.connect(_on_bar)
	_root.add_child(_bar)

	_modal = Control.new()
	_modal.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_modal.size = Vector2(320, 200)
	_root.add_child(_modal)

	_fade = ColorRect.new()
	_fade.color = Color(0, 0, 0, 0)
	_fade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_fade.size = Vector2(320, 200)
	_root.add_child(_fade)

	_cursor = TextureRect.new()
	_cursor.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_root.add_child(_cursor)
	for c in ["walk", "look", "hand", "talk", "wait", "arrow", "exit", "help"]:
		_cursor_tex[c] = load("res://assets/art/ui/icon_%s.png" % c)
	Input.mouse_mode = Input.MOUSE_MODE_HIDDEN
	GameManager.inventory_changed.connect(_on_inventory_changed)


func item_icon(id: String) -> Texture2D:
	if not _item_tex.has(id):
		var p := "res://assets/art/items/%s.png" % id
		_item_tex[id] = load(p) if ResourceLoader.exists(p) else null
	return _item_tex[id]


# --- state ------------------------------------------------------------------------
func is_blocking() -> bool:
	return busy > 0 or not _stack.is_empty() or _fade.color.a > 0.5


func set_verb(v: String) -> void:
	if v == "item" and GameManager.current_item == "":
		return
	verb = v
	_bar.queue_redraw()


func cycle_verb() -> void:
	var i := VERB_CYCLE.find(verb)
	for _n in VERB_CYCLE.size():
		i = (i + 1) % VERB_CYCLE.size()
		if VERB_CYCLE[i] != "item" or GameManager.current_item != "":
			break
	set_verb(VERB_CYCLE[i])


func _on_inventory_changed() -> void:
	if verb == "item" and GameManager.current_item == "":
		verb = "walk"
	_bar.queue_redraw()


# --- per-frame: cursor + icon bar reveal ------------------------------------------
func _process(_delta: float) -> void:
	var m := _root.get_viewport().get_mouse_position()
	var key := verb
	var tex: Texture2D
	if not in_game or not _stack.is_empty() or (_bar.visible and m.y < IconBar.BH + 10):
		key = "arrow"
	elif busy > 0:
		key = "wait"
	if key == "item":
		tex = item_icon(GameManager.current_item)
	else:
		tex = _cursor_tex.get(key)
	_cursor.texture = tex
	var hot: Vector2 = CURSOR_HOT.get(key, Vector2(8, 8))
	_cursor.position = (m - hot).round()

	if in_game and _stack.is_empty() and busy == 0:
		if not _bar.visible and m.y < 5:
			_bar.visible = true
			_bar.queue_redraw()
		elif _bar.visible and m.y > IconBar.BH + 14:
			_bar.visible = false
	elif _bar.visible and not _stack.is_empty():
		_bar.visible = false
	_hover.queue_redraw()


func _draw_hover() -> void:
	if hover_text == "" or is_blocking() or not in_game or _bar.visible:
		return
	PixelFont.draw_centered(_hover, 160, 189, hover_text, Color(1, 1, 0.8), Color(0, 0, 0, 0.9))


func _input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		if not _stack.is_empty():
			var top = _stack.back()
			if top.has_method("handle_key"):
				top.handle_key(event)
			get_viewport().set_input_as_handled()
			return
		if not in_game or busy > 0:
			return
		match event.keycode:
			KEY_TAB, KEY_I: show_inventory()
			KEY_ESCAPE: control_panel()
			KEY_F5: save_dialog()
			KEY_F7: restore_dialog()
			KEY_F2: Sound.toggle_mute()
			KEY_F1: help()
			_: return
		get_viewport().set_input_as_handled()
	elif event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_RIGHT:
		if in_game and _stack.is_empty() and busy == 0:
			cycle_verb()
			get_viewport().set_input_as_handled()


func _on_bar(id: String) -> void:
	match id:
		"walk", "look", "hand", "talk": set_verb(id)
		"item":
			if GameManager.current_item != "":
				set_verb("item")
			else:
				show_inventory()
		"inv": show_inventory()
		"settings": control_panel()
		"help": help()


# --- awaitable windows ---------------------------------------------------------------
func _open(d: Control) -> void:
	_modal.add_child(d)
	_stack.append(d)
	_bar.visible = false


func _close(d: Control) -> void:
	_stack.erase(d)
	d.queue_free()


func run_dialog(d: SierraDialog) -> int:
	_open(d)
	var idx: int = await d.chosen
	_close(d)
	return idx


## Show a message window and wait for a click.
func say(text: String, title: String = "") -> void:
	await run_dialog(SierraDialog.new().setup(title, text))


## Show a message with an icon (items picked up, etc.).
func say_icon(text: String, icon: Texture2D, title: String = "") -> void:
	await run_dialog(SierraDialog.new().setup(title, text, [], false, icon))


## Ask a question; returns the chosen option index.
func choose(text: String, options: Array, title: String = "", esc_index: int = -1) -> int:
	var d := SierraDialog.new().setup(title, text, options, true, null, 290)
	d.esc_index = esc_index
	var r := await run_dialog(d)
	return r


# --- inventory ----------------------------------------------------------------------
func show_inventory() -> void:
	if not _stack.is_empty() or busy > 0:
		return
	var inv := InventoryWindow.new()
	_open(inv)
	inv.closed.connect(func() -> void: _close(inv))
	inv.look_item.connect(func(id: String) -> void:
		await say_icon(GameManager.item_desc(id), item_icon(id), GameManager.item_name(id)))
	inv.select_item.connect(func(id: String) -> void:
		GameManager.current_item = id
		_close(inv)
		set_verb("item"))
	inv.use_item.connect(func(id: String) -> void:
		_close(inv)
		var room = SceneManager.current_room()
		if room and room.has_method("use_self"):
			room.use_self(id))


# --- control panel / save / restore -------------------------------------------------------
func control_panel() -> void:
	if not _stack.is_empty() or busy > 0:
		return
	var label_sound := "Sound: OFF" if Sound.muted else "Sound: ON"
	var i := await choose("CONTROL PANEL", ["Save Game  (F5)", "Restore Game  (F7)", "Restart", label_sound, "About", "Quit", "Play"], GameManager.TITLE, 6)
	match i:
		0: await save_dialog()
		1: await restore_dialog()
		2:
			if await choose("Restart the game? Unsaved progress will be lost.", ["Restart", "Cancel"], "", 1) == 0:
				SceneManager.restart()
		3: Sound.toggle_mute()
		4: await say("COP QUEST: DEAD RECKONING\n\nA police procedural adventure in the Sierra tradition.\nMesa Verde, California, 1995.\n\nArt, music and code generated procedurally for this project. Built in Godot 4.", "About")
		5:
			if await choose("Quit the game?", ["Quit", "Cancel"], "", 1) == 0:
				get_tree().quit()


func _slot_options() -> Array:
	var opts := []
	for s in GameManager.SAVE_SLOTS:
		var l := GameManager.slot_label(s)
		opts.append("%d. %s" % [s + 1, l if l != "" else "(empty)"])
	opts.append("Cancel")
	return opts


func save_dialog() -> void:
	var room = SceneManager.current_room()
	if room == null or not room.can_save():
		await say("You can't save right now.")
		return
	var i := await choose("Save which slot?", _slot_options(), "Save Game", GameManager.SAVE_SLOTS)
	if i >= 0 and i < GameManager.SAVE_SLOTS:
		if GameManager.save_game(i, room.player_position()):
			await say("Game saved.")


## Returns true if a game was restored.
func restore_dialog() -> bool:
	var i := await choose("Restore which game?", _slot_options(), "Restore Game", GameManager.SAVE_SLOTS)
	if i >= 0 and i < GameManager.SAVE_SLOTS:
		if GameManager.slot_label(i) == "":
			await say("That slot is empty.")
			return false
		busy = 0
		return GameManager.load_game(i)
	return false


func help() -> void:
	if not _stack.is_empty():
		return
	await say("Move the mouse to the TOP of the screen for the icon bar.\n\nRIGHT-CLICK cycles the cursor: Walk, Look, Hand, Talk, and your selected Item. LEFT-CLICK uses it.\n\nTo use an item on something, open the Inventory, Select the item, then click it on the target. Use Hand in the inventory to use an item on yourself.\n\nYour notebook has your case notes.\n\nKeys: TAB inventory, ESC control panel, F5 save, F7 restore, F2 sound.", "How to Play")


## The Sierra death message. Restore / Restart / Quit.
func death(text: String, title: String = "Career Over") -> void:
	busy = 0
	in_game = true
	Sound.stop_music()
	Sound.play("death")
	while true:
		var i := await choose(text, ["Restore", "Restart", "Quit"], title)
		if i == 0:
			if await restore_dialog():
				return
		elif i == 1:
			SceneManager.restart()
			return
		elif i == 2:
			get_tree().quit()
			return


# --- fades ----------------------------------------------------------------------------
func fade_out(t: float = 0.25) -> void:
	var tw := create_tween()
	tw.tween_property(_fade, "color:a", 1.0, t)
	await tw.finished


func fade_in(t: float = 0.25) -> void:
	var tw := create_tween()
	tw.tween_property(_fade, "color:a", 0.0, t)
	await tw.finished


func clear_windows() -> void:
	for d in _stack.duplicate():
		_close(d)
	_bar.visible = false
	hover_text = ""
