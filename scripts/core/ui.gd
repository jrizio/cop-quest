extends CanvasLayer
## Persistent on-screen UI (autoload):
##   - the Sierra-style message box along the bottom,
##   - the running inventory line at the top,
##   - the VERB system: right-click cycles the active verb (Walk / Look / Use /
##     Talk / Take), shown as a small label that follows the cursor.
## Rooms read current_verb() when a hotspot is left-clicked.

const VERBS := ["Walk", "Look", "Use", "Talk", "Take"]

var _verb_index: int = 0

var _msg_panel: PanelContainer
var _msg_label: Label
var _inv_label: Label
var _verb_label: Label
var _timer: Timer


func _ready() -> void:
	layer = 100

	_inv_label = _make_label(8)
	_inv_label.position = Vector2(4, 2)
	add_child(_inv_label)

	_msg_panel = PanelContainer.new()
	_msg_panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_msg_panel.anchor_left = 0.0
	_msg_panel.anchor_right = 1.0
	_msg_panel.anchor_top = 1.0
	_msg_panel.anchor_bottom = 1.0
	_msg_panel.offset_left = 6.0
	_msg_panel.offset_right = -6.0
	_msg_panel.offset_top = -46.0
	_msg_panel.offset_bottom = -6.0
	_msg_panel.visible = false
	add_child(_msg_panel)

	_msg_label = _make_label(8)
	_msg_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_msg_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_msg_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_msg_panel.add_child(_msg_label)

	_verb_label = _make_label(8)
	_verb_label.modulate = Color(1.0, 0.92, 0.4)
	add_child(_verb_label)

	_timer = Timer.new()
	_timer.one_shot = true
	_timer.timeout.connect(func() -> void: _msg_panel.visible = false)
	add_child(_timer)

	GameManager.inventory_changed.connect(_on_inventory_changed)
	_on_inventory_changed(GameManager.inventory)
	_update_verb_label()


func _make_label(size: int) -> Label:
	var l := Label.new()
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	l.add_theme_font_size_override("font_size", size)
	return l


func _process(_delta: float) -> void:
	# Verb label trails the cursor (in viewport coordinates).
	_verb_label.position = get_viewport().get_mouse_position() + Vector2(9, -3)


func _input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_RIGHT:
		_verb_index = (_verb_index + 1) % VERBS.size()
		_update_verb_label()
		get_viewport().set_input_as_handled()


func current_verb() -> String:
	return VERBS[_verb_index]


func _update_verb_label() -> void:
	_verb_label.text = VERBS[_verb_index]


## Show a transient narration/message box (auto-hides after a few seconds).
func show_message(text: String, seconds: float = 3.0) -> void:
	_msg_label.text = text
	_msg_panel.visible = true
	_timer.start(seconds)


func _on_inventory_changed(items: Array) -> void:
	if items.is_empty():
		_inv_label.text = "Inventory: (empty)   [right-click = change verb]"
	else:
		_inv_label.text = "Inventory: " + ", ".join(PackedStringArray(items))
