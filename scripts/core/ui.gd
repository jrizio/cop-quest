extends CanvasLayer
## Persistent on-screen UI (autoload). Draws a Sierra-style message box along
## the bottom of the screen and a running inventory line at the top.
## Built entirely in code so it survives scene changes without a .tscn.

var _msg_panel: PanelContainer
var _msg_label: Label
var _inv_label: Label
var _timer: Timer


func _ready() -> void:
	layer = 100

	_inv_label = Label.new()
	_inv_label.position = Vector2(4, 2)
	_inv_label.add_theme_font_size_override("font_size", 8)
	add_child(_inv_label)

	_msg_panel = PanelContainer.new()
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

	_msg_label = Label.new()
	_msg_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_msg_label.add_theme_font_size_override("font_size", 8)
	_msg_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_msg_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_msg_panel.add_child(_msg_label)

	_timer = Timer.new()
	_timer.one_shot = true
	_timer.timeout.connect(func() -> void: _msg_panel.visible = false)
	add_child(_timer)

	GameManager.inventory_changed.connect(_on_inventory_changed)
	_on_inventory_changed(GameManager.inventory)


## Show a transient narration/message box (auto-hides after a few seconds).
func show_message(text: String, seconds: float = 3.0) -> void:
	_msg_label.text = text
	_msg_panel.visible = true
	_timer.start(seconds)


func _on_inventory_changed(items: Array) -> void:
	if items.is_empty():
		_inv_label.text = "Inventory: (empty)"
	else:
		_inv_label.text = "Inventory: " + ", ".join(PackedStringArray(items))
