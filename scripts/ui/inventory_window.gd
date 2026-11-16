class_name InventoryWindow
extends Control
## PQ4-style inventory: a grid of items, plus Look / Hand / Select / OK
## controls along the bottom. Select makes an item the active cursor; Hand
## uses it on yourself (gloves, vest, notebook...); Look describes it.

signal look_item(id: String)
signal use_item(id: String)
signal select_item(id: String)
signal closed

const COLS := 6
const CELL := Vector2(24, 22)
const PAD := 6

var mode := "select"
var _box := Rect2()
var _cells: Array = []    # [Rect2, id]
var _mode_rects := {}     # mode -> Rect2
var _hover_id := ""
var _icons := {}


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_STOP
	size = Vector2(320, 200)
	for id in GameManager.inventory:
		_icons[id] = load("res://assets/art/items/%s.png" % id)
	for m in ["look", "hand", "select"]:
		_icons["_" + m] = load("res://assets/art/ui/icon_%s.png" % ("arrow" if m == "select" else m))
	_layout()


func _layout() -> void:
	var n: int = maxi(1, GameManager.inventory.size())
	var rows := int(ceil(n / float(COLS)))
	var w := COLS * CELL.x + PAD * 2
	var h := 12 + PAD + rows * CELL.y + 4 + 20 + PAD
	_box = Rect2(roundi(160 - w / 2.0), roundi(96 - h / 2.0), w, h)
	_cells.clear()
	for i in GameManager.inventory.size():
		var cx := _box.position.x + PAD + (i % COLS) * CELL.x
		var cy := _box.position.y + 12 + PAD + (i / COLS) * CELL.y
		_cells.append([Rect2(cx, cy, CELL.x - 2, CELL.y - 2), GameManager.inventory[i]])
	var by := _box.position.y + _box.size.y - PAD - 18
	var bx := _box.position.x + PAD
	for m in ["look", "hand", "select"]:
		_mode_rects[m] = Rect2(bx, by, 24, 18)
		bx += 27
	_mode_rects["ok"] = Rect2(_box.position.x + _box.size.x - PAD - 34, by, 34, 18)


func _draw() -> void:
	var b := _box
	draw_rect(Rect2(b.position + Vector2(3, 3), b.size), Color(0, 0, 0, 0.45))
	draw_rect(b.grow(1), SierraDialog.INK)
	draw_rect(b, SierraDialog.FACE)
	draw_rect(Rect2(b.position + Vector2(1, 1), Vector2(b.size.x - 2, 11)), SierraDialog.TITLE_BG)
	var head := "Inventory"
	if _hover_id != "":
		head = GameManager.item_name(_hover_id)
	PixelFont.draw_centered(self, b.position.x + b.size.x / 2.0, b.position.y + 2, head, Color(1, 1, 0.85))
	if _cells.is_empty():
		PixelFont.draw(self, b.position + Vector2(PAD, 12 + PAD + 6), "You aren't carrying anything.", SierraDialog.INK)
	for c in _cells:
		var r: Rect2 = c[0]
		var sel: bool = GameManager.current_item == c[1]
		draw_rect(r, Color(0.6, 0.6, 0.64) if not sel else Color(0.95, 0.85, 0.4))
		draw_rect(Rect2(r.position, Vector2(r.size.x, 1)), SierraDialog.LO)
		draw_rect(Rect2(r.position, Vector2(1, r.size.y)), SierraDialog.LO)
		var tex: Texture2D = _icons.get(c[1])
		if tex:
			draw_texture(tex, r.position + (r.size - tex.get_size()) / 2.0)
	for m in _mode_rects:
		var r: Rect2 = _mode_rects[m]
		var pressed: bool = m == mode
		draw_rect(r.grow(1), SierraDialog.LO)
		draw_rect(r, Color(0.6, 0.62, 0.7) if pressed else SierraDialog.FACE)
		draw_rect(Rect2(r.position, Vector2(r.size.x, 1)), SierraDialog.LO if pressed else SierraDialog.HI)
		draw_rect(Rect2(r.position, Vector2(1, r.size.y)), SierraDialog.LO if pressed else SierraDialog.HI)
		if m == "ok":
			PixelFont.draw_centered(self, r.position.x + r.size.x / 2.0, r.position.y + 5, "OK", SierraDialog.INK)
		else:
			var tex: Texture2D = _icons["_" + m]
			draw_texture(tex, r.position + (r.size - tex.get_size()) / 2.0)


func _gui_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion:
		var id := _item_at(event.position)
		if id != _hover_id:
			_hover_id = id
			queue_redraw()
	elif event is InputEventMouseButton and event.pressed:
		accept_event()
		if event.button_index == MOUSE_BUTTON_RIGHT:
			var order := ["select", "look", "hand"]
			mode = order[(order.find(mode) + 1) % order.size()]
			queue_redraw()
			return
		if event.button_index != MOUSE_BUTTON_LEFT:
			return
		for m in _mode_rects:
			if (_mode_rects[m] as Rect2).has_point(event.position):
				if m == "ok":
					closed.emit()
				else:
					mode = m
					queue_redraw()
				return
		var id := _item_at(event.position)
		if id == "":
			if not _box.has_point(event.position):
				closed.emit()
			return
		match mode:
			"look": look_item.emit(id)
			"hand": use_item.emit(id)
			_: select_item.emit(id)


func handle_key(event: InputEventKey) -> void:
	if event.keycode in [KEY_ESCAPE, KEY_ENTER, KEY_TAB, KEY_I]:
		closed.emit()


func cursor_mode() -> String:
	return mode


func _item_at(p: Vector2) -> String:
	for c in _cells:
		if (c[0] as Rect2).has_point(p):
			return c[1]
	return ""
