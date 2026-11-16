class_name PixelFont
extends RefCounted
## Proportional SCI-style bitmap font, rendered from font_data.gd (generated
## by tools/gen_ui.js). Text is drawn glyph-by-glyph with draw_texture_rect_region
## so it stays pixel-crisp on the 320x200 canvas.

const FontData := preload("res://scripts/core/font_data.gd")
const LINE_H := 10
const CELL := Vector2i(8, 9)
const COLS := 16

static var _tex: ImageTexture
static var _src := {}    # code -> Rect2
static var _adv := {}    # code -> int (advance)


static func _ensure() -> void:
	if _tex != null:
		return
	var codes: Array = FontData.GLYPHS.keys()
	var rows := int(ceil(codes.size() / float(COLS)))
	var img := Image.create(COLS * CELL.x, rows * CELL.y, false, Image.FORMAT_RGBA8)
	img.fill(Color(0, 0, 0, 0))
	for i in codes.size():
		var code: int = codes[i]
		var glyph: Array = FontData.GLYPHS[code]
		var ox := (i % COLS) * CELL.x
		var oy := (i / COLS) * CELL.y
		var w: int = String(glyph[0]).length()
		for r in glyph.size():
			var row: String = glyph[r]
			for c in row.length():
				if row[c] == "#":
					img.set_pixel(ox + c, oy + r, Color.WHITE)
		_src[code] = Rect2(ox, oy, w, CELL.y)
		_adv[code] = w + 1
	_tex = ImageTexture.create_from_image(img)


static func _code(ch: String) -> int:
	var c := ch.unicode_at(0)
	if c == 8217 or c == 8216:  # curly apostrophes
		return 39
	if c == 8220 or c == 8221:
		return 34
	if c == 8212 or c == 8211:  # dashes
		return 45
	return c if _src.has(c) else 63


static func measure(text: String) -> int:
	_ensure()
	var w := 0
	for ch in text:
		w += _adv[_code(ch)]
	return maxi(0, w - 1)


## Draw one line of text. `pos` is the top-left of the cap height.
static func draw(ci: CanvasItem, pos: Vector2, text: String, color: Color = Color.BLACK, shadow: Color = Color(0, 0, 0, 0)) -> void:
	_ensure()
	if shadow.a > 0.0:
		draw(ci, pos + Vector2(1, 1), text, shadow)
	var x := pos.x
	for ch in text:
		var code := _code(ch)
		var r: Rect2 = _src[code]
		ci.draw_texture_rect_region(_tex, Rect2(Vector2(x, pos.y), r.size), r, color)
		x += _adv[code]


static func draw_centered(ci: CanvasItem, center_x: float, y: float, text: String, color: Color = Color.BLACK, shadow: Color = Color(0, 0, 0, 0)) -> void:
	draw(ci, Vector2(round(center_x - measure(text) / 2.0), y), text, color, shadow)


## Word-wrap to a pixel width. Honors explicit "\n".
static func wrap(text: String, max_w: int) -> PackedStringArray:
	var out := PackedStringArray()
	for para in text.split("\n"):
		var line := ""
		for word in para.split(" "):
			var trial := word if line == "" else line + " " + word
			if measure(trial) <= max_w or line == "":
				line = trial
			else:
				out.append(line)
				line = word
		out.append(line)
	return out
