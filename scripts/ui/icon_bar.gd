class_name IconBar
extends Control
## The PQ4 icon bar: hidden until the mouse touches the top of the screen.
## Walk / Look / Hand / Talk / current Item / Inventory / Control panel / Help,
## with a score status line beneath it.

signal pressed(id: String)

const IDS := ["walk", "look", "hand", "talk", "item", "inv", "settings", "help"]
const BW := 40
const BH := 22

var _icons := {}
var _hover := -1


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_STOP
	position = Vector2.ZERO
	size = Vector2(320, BH + 10)
	for id in IDS:
		if id != "item":
			_icons[id] = load("res://assets/art/ui/icon_%s.png" % id)
	GameManager.score_changed.connect(queue_redraw)
	GameManager.inventory_changed.connect(queue_redraw)


func _draw() -> void:
	draw_rect(Rect2(0, 0, 320, BH), Color(0.30, 0.30, 0.36))
	for i in IDS.size():
		var id: String = IDS[i]
		var r := Rect2(i * BW + 1, 1, BW - 2, BH - 2)
		var active: bool = UI.verb == id or (id == "item" and UI.verb == "item")
		draw_rect(r, Color(0.52, 0.54, 0.62) if active else (Color(0.86, 0.86, 0.80) if i == _hover else SierraDialog.FACE))
		draw_rect(Rect2(r.position, Vector2(r.size.x, 1)), SierraDialog.LO if active else SierraDialog.HI)
		draw_rect(Rect2(r.position, Vector2(1, r.size.y)), SierraDialog.LO if active else SierraDialog.HI)
		draw_rect(Rect2(r.position + Vector2(0, r.size.y - 1), Vector2(r.size.x, 1)), SierraDialog.HI if active else SierraDialog.LO)
		draw_rect(Rect2(r.position + Vector2(r.size.x - 1, 0), Vector2(1, r.size.y)), SierraDialog.HI if active else SierraDialog.LO)
		var tex: Texture2D = null
		if id == "item":
			if GameManager.current_item != "":
				tex = UI.item_icon(GameManager.current_item)
			else:
				draw_rect(Rect2(r.get_center() - Vector2(8, 7), Vector2(16, 14)), Color(0.55, 0.55, 0.6))
		else:
			tex = _icons[id]
		if tex:
			# icons are white-ish; draw a dark outline-free shadow for contrast
			draw_texture(tex, r.get_center() - tex.get_size() / 2.0 + Vector2(1, 1), Color(0, 0, 0, 0.5))
			draw_texture(tex, r.get_center() - tex.get_size() / 2.0)
	# status line
	draw_rect(Rect2(0, BH, 320, 10), Color(0.08, 0.08, 0.14))
	PixelFont.draw(self, Vector2(4, BH + 2), "Score: %d of %d" % [GameManager.score, GameManager.max_score()], Color(0.95, 0.9, 0.6))
	var t := GameManager.TITLE
	PixelFont.draw(self, Vector2(316 - PixelFont.measure(t), BH + 2), t, Color(0.75, 0.8, 0.95))


func _gui_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion:
		var h := int(event.position.x / BW) if event.position.y < BH else -1
		if h != _hover:
			_hover = h
			queue_redraw()
	elif event is InputEventMouseButton and event.pressed:
		accept_event()
		if event.button_index == MOUSE_BUTTON_LEFT and event.position.y < BH:
			pressed.emit(IDS[clampi(int(event.position.x / BW), 0, IDS.size() - 1)])
