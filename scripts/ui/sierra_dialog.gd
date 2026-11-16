class_name SierraDialog
extends Control
## A modal SCI1.1-style window: beveled gray box, optional title bar, word-
## wrapped text, optional icon, and either "click anywhere to continue" or a
## row / column of buttons. Emits `chosen(index)` (-1 = dismissed).

signal chosen(index: int)

const FACE := Color(0.76, 0.76, 0.78)
const HI := Color(0.97, 0.97, 0.97)
const LO := Color(0.36, 0.36, 0.42)
const INK := Color(0.05, 0.05, 0.08)
const TITLE_BG := Color(0.13, 0.17, 0.36)
const BTN_HOVER := Color(0.88, 0.88, 0.70)
const PAD := 6

var title := ""
var text := ""
var buttons: Array = []
var columns := false
var icon: Texture2D = null
var max_w := 240
var esc_index := -1      # button chosen by Escape (-1 = none / dismiss)

var _lines := PackedStringArray()
var _box := Rect2()
var _btn_rects: Array = []
var _hover := -1
var _armed := false     # ignore the click that opened us


func setup(p_title: String, p_text: String, p_buttons: Array = [], p_columns := false, p_icon: Texture2D = null, p_max_w := 240) -> SierraDialog:
	title = p_title
	text = p_text
	buttons = p_buttons
	columns = p_columns
	icon = p_icon
	max_w = p_max_w
	return self


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_STOP
	position = Vector2.ZERO
	size = Vector2(320, 200)
	_layout()
	get_tree().create_timer(0.12).timeout.connect(func() -> void: _armed = true)


func _layout() -> void:
	var icon_w := (icon.get_width() + 6) if icon else 0
	var text_w := max_w - PAD * 2 - icon_w
	_lines = PixelFont.wrap(text, text_w) if text != "" else PackedStringArray()
	var content_w := 0
	for l in _lines:
		content_w = maxi(content_w, PixelFont.measure(l))
	content_w += icon_w
	content_w = maxi(content_w, PixelFont.measure(title) + 4)
	# buttons
	var bw_total := 0
	var widest := 0
	for b in buttons:
		var w := PixelFont.measure(String(b)) + 12
		widest = maxi(widest, w)
		bw_total += w + 4
	if columns:
		content_w = maxi(content_w, mini(widest, max_w - PAD * 2))
	else:
		content_w = maxi(content_w, bw_total - 4)
	var w := mini(max_w, content_w + PAD * 2)
	var title_h := 12 if title != "" else 0
	var text_h := _lines.size() * PixelFont.LINE_H
	if icon:
		text_h = maxi(text_h, icon.get_height())
	var btn_h := 0
	if buttons.size() > 0:
		btn_h = (buttons.size() * 13 + 2) if columns else 17
	var h := title_h + PAD + text_h + (PAD if text_h > 0 else 0) + btn_h + PAD - (2 if buttons.size() > 0 else 0)
	var x := roundi(160 - w / 2.0)
	var y := roundi(clampf(96 - h / 2.0, 4, 196 - h))
	_box = Rect2(x, y, w, h)
	_btn_rects.clear()
	var by := y + title_h + PAD + text_h + (PAD if text_h > 0 else 0)
	if columns:
		for i in buttons.size():
			_btn_rects.append(Rect2(x + PAD, by + i * 13, w - PAD * 2, 12))
	else:
		var bx := x + (w - (bw_total - 4)) / 2.0
		for b in buttons:
			var bw := PixelFont.measure(String(b)) + 12
			_btn_rects.append(Rect2(roundi(bx), by, bw, 13))
			bx += bw + 4


func _draw() -> void:
	var b := _box
	draw_rect(Rect2(b.position + Vector2(3, 3), b.size), Color(0, 0, 0, 0.45))
	draw_rect(b.grow(1), INK)
	draw_rect(b, FACE)
	draw_rect(Rect2(b.position, Vector2(b.size.x, 1)), HI)
	draw_rect(Rect2(b.position, Vector2(1, b.size.y)), HI)
	draw_rect(Rect2(b.position + Vector2(0, b.size.y - 1), Vector2(b.size.x, 1)), LO)
	draw_rect(Rect2(b.position + Vector2(b.size.x - 1, 0), Vector2(1, b.size.y)), LO)
	var y := b.position.y
	if title != "":
		draw_rect(Rect2(b.position + Vector2(1, 1), Vector2(b.size.x - 2, 11)), TITLE_BG)
		PixelFont.draw_centered(self, b.position.x + b.size.x / 2.0, y + 2, title, Color(1, 1, 0.85))
		y += 12
	y += PAD
	var tx := b.position.x + PAD
	if icon:
		draw_texture(icon, Vector2(tx, y))
		tx += icon.get_width() + 6
	for i in _lines.size():
		PixelFont.draw(self, Vector2(tx, y + i * PixelFont.LINE_H), _lines[i], INK)
	for i in _btn_rects.size():
		var r: Rect2 = _btn_rects[i]
		draw_rect(r.grow(1), LO)
		draw_rect(r, BTN_HOVER if i == _hover else FACE)
		draw_rect(Rect2(r.position, Vector2(r.size.x, 1)), HI)
		draw_rect(Rect2(r.position, Vector2(1, r.size.y)), HI)
		var lab := String(buttons[i])
		if columns:
			PixelFont.draw(self, r.position + Vector2(5, 3), lab, INK)
		else:
			PixelFont.draw_centered(self, r.position.x + r.size.x / 2.0, r.position.y + 3, lab, INK)


func _gui_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion:
		var h := _button_at(event.position)
		if h != _hover:
			_hover = h
			queue_redraw()
	elif event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		accept_event()
		if not _armed:
			return
		if buttons.is_empty():
			chosen.emit(-1)
		else:
			var i := _button_at(event.position)
			if i >= 0:
				chosen.emit(i)


func handle_key(event: InputEventKey) -> void:
	if not _armed:
		return
	var k := event.keycode
	if buttons.is_empty():
		if k in [KEY_ENTER, KEY_KP_ENTER, KEY_SPACE, KEY_ESCAPE]:
			chosen.emit(-1)
		return
	if k >= KEY_1 and k <= KEY_9 and k - KEY_1 < buttons.size():
		chosen.emit(k - KEY_1)
	elif k in [KEY_ENTER, KEY_KP_ENTER] and buttons.size() == 1:
		chosen.emit(0)
	elif k == KEY_ESCAPE and esc_index >= 0:
		chosen.emit(esc_index)


func _button_at(p: Vector2) -> int:
	for i in _btn_rects.size():
		if (_btn_rects[i] as Rect2).grow(1).has_point(p):
			return i
	return -1
