extends Room
## The car's mobile map (PQ4 style): click a destination to drive there.

const DEST := [
	# id, label, position, target room, unlock flag
	["home", "Home - 1418 Alder St.", Vector2(262, 46), "driveway", ""],
	["hq", "MVPD Headquarters", Vector2(196, 92), "squad", "phone_answered"],
	["marina", "Pier 9 Marina", Vector2(84, 108), "marina", "phone_answered"],
	["coroner", "County Coroner", Vector2(236, 138), "coroner", "body_searched"],
	["bar", "The Rusty Anchor", Vector2(118, 150), "bar", "body_searched"],
	["ware", "Warehouse 7, Pier 12", Vector2(60, 180), "ware_ext", "warrant"],
]

var _layer: Node2D
var _t := 0.0


func _setup() -> void:
	bg = "map"
	has_player = false
	music = "theme"
	desc = "Mesa Verde: the harbor on the west, downtown in the middle, and the hills to the east. Click a destination to drive there."


func _build() -> void:
	UI.set_verb("walk")
	for d in DEST:
		if d[4] == "" or flag(d[4]):
			var h := add_exit(d[0], d[1], Rect2(d[2] - Vector2(9, 9), Vector2(18, 18)), d[2], d[3], "Default", d[1] + ".")
			if d[3] == GameManager.last_room:
				h["here"] = true
	add_exit("back", "Stay here", Rect2(254, 188, 66, 12), Vector2(290, 194), GameManager.last_room, "Default", "Stay where you are.")
	_layer = Node2D.new()
	_layer.z_index = 2
	add_child(_layer)
	_layer.draw.connect(_draw_markers)


func _process(delta: float) -> void:
	_t += delta
	_layer.queue_redraw()


func _draw_markers() -> void:
	for h in hotspots:
		if h.id == "back":
			continue
		var p: Vector2 = h.approach
		var pulse := 0.5 + 0.5 * sin(_t * 5.0)
		_layer.draw_circle(p, 5.0, Color(0, 0, 0, 0.6))
		_layer.draw_circle(p, 4.0, Color(0.9, 0.15 + 0.2 * pulse, 0.15) if h.get("here", false) else Color(0.15, 0.3, 0.85))
		_layer.draw_circle(p, 1.5, Color(1, 1, 1))
		var lx: float = clampf(p.x + 7, 2, 318 - PixelFont.measure(h.name))
		if p.x > 230:
			lx = p.x - 7 - PixelFont.measure(h.name)
		PixelFont.draw(_layer, Vector2(lx, p.y - 4), h.name, Color(1, 1, 0.9), Color(0, 0, 0, 0.9))
	_layer.draw_rect(Rect2(254, 188, 66, 12), Color(0.5, 0.15, 0.15))
	PixelFont.draw_centered(_layer, 287, 190, "Stay here", Color(1, 1, 0.9))
	var tod := "NIGHT" if flag("warrant") else ("MORNING" if not flag("body_searched") else "AFTERNOON")
	PixelFont.draw(_layer, Vector2(4, 190), "Time: " + tod + "     Score: %d of %d" % [GameManager.score, GameManager.max_score()], Color(0.85, 0.85, 0.7))


func exit_check(id: String) -> bool:
	if id == "back":
		return true
	if flag("drank_beer"):
		dead = true
		Sound.play("car")
		await say("You pull out of the lot with one beer and no breakfast in you, take the Harbor Boulevard curve too fast, and put the Caprice into the side of a harbor patrol unit.")
		die("Your blood alcohol comes back at 0.09. Detective Navarro is relieved of duty pending an Internal Affairs investigation.\n\nDrinking on duty is never part of the procedure.", "Off the Job")
		return false
	if id == "ware" and not flag("vest_taken"):
		await say("You've got a warrant and a bad feeling. Your vest is still in the trunk, where it always is.")
	return true
