class_name Room
extends Node2D
## Base class for every location. A room script overrides:
##   _setup()                      -> set bg, walk_poly, blockers, persp, spawns, desc
##   _build()                      -> add_hotspot / add_exit / add_npc / add_prop
##   enter()                       -> (coroutine) runs once the room has faded in
##   interact(id, verb, item)      -> (coroutine) return true if handled
##   use_self(item)                -> inventory "Hand" on an item
##   exit_check(id)                -> (coroutine) return false to block an exit
##   filter_walk(point)            -> restrict where the player may walk
##
## Verbs: "walk", "look", "hand", "talk", "item" (item = GameManager.current_item).

# --- configured by subclasses ------------------------------------------------------
var bg := ""
var walk_poly := PackedVector2Array()
var blockers: Array = []
var persp := Vector4(0, 200, 1, 1)   # far_y, near_y, far_scale, near_scale
var spawns := {"Default": [Vector2(160, 180), Actor.ROW_DOWN]}
var desc := "Nothing remarkable."
var has_player := true
var music := ""

# --- runtime -----------------------------------------------------------------------
var walkmap: Walkmap
var player: Actor
var world: Node2D
var under: Node2D
var hotspots: Array = []
var npcs := {}
var props := {}
var dead := false
var _click_id := 0


func _ready() -> void:
	_setup()
	walkmap = Walkmap.new(walk_poly, blockers)
	if bg != "":
		var s := Sprite2D.new()
		s.texture = load("res://assets/art/bg/%s.png" % bg)
		s.centered = false
		add_child(s)
	under = Node2D.new()
	add_child(under)
	world = Node2D.new()
	world.y_sort_enabled = true
	add_child(world)
	if has_player:
		player = Actor.new(GameManager.outfit)
		player.room = self
		world.add_child(player)
		var sp: Array = spawns.get(GameManager.pending_spawn, spawns["Default"])
		if GameManager.pending_pos != null:
			player.place(walkmap.clamp_point(GameManager.pending_pos))
			GameManager.pending_pos = null
		else:
			player.place(sp[0])
		player.face(sp[1])
	_build()
	if music != "":
		Sound.music(music)
	else:
		Sound.stop_music()
	_start.call_deferred()


func _start() -> void:
	await get_tree().create_timer(0.3).timeout
	if is_inside_tree():
		await enter()


# --- virtuals ---------------------------------------------------------------------------
func _setup() -> void:
	pass


func _build() -> void:
	pass


func enter() -> void:
	pass


func interact(_id: String, _verb: String, _item: String) -> bool:
	return false


func exit_check(_id: String) -> bool:
	return true


func filter_walk(p: Vector2) -> Vector2:
	return p


# --- building -------------------------------------------------------------------------
func add_hotspot(id: String, name: String, rect: Rect2, approach = null, look: String = "") -> Dictionary:
	var h := {"id": id, "name": name, "rect": rect, "approach": approach, "look": look, "enabled": true}
	hotspots.append(h)
	return h


func add_exit(id: String, name: String, rect: Rect2, approach: Vector2, target: String, spawn: String = "Default", look: String = "") -> Dictionary:
	var h := add_hotspot(id, name, rect, approach, look)
	h["exit"] = target
	h["spawn"] = spawn
	return h


func add_npc(id: String, name: String, sheet: String, pos: Vector2, facing: int = Actor.ROW_DOWN, approach = null, look: String = "") -> Actor:
	var a := Actor.new(sheet, facing)
	a.room = self
	a.place(pos)
	world.add_child(a)
	npcs[id] = a
	var h := add_hotspot(id, name, Rect2(), approach, look)
	h["actor"] = a
	h["npc"] = true
	return a


func remove_npc(id: String) -> void:
	if npcs.has(id):
		npcs[id].queue_free()
		npcs.erase(id)
	set_enabled(id, false)


## Full-screen transparent overlay from assets/art/props. baseline >= 0 makes
## it a depth-sorted occluder (actors with feet above the line draw behind it).
func add_prop(file: String, baseline: float = -1.0) -> Sprite2D:
	var s := Sprite2D.new()
	s.texture = load("res://assets/art/props/%s.png" % file)
	s.centered = false
	if baseline >= 0.0:
		s.position = Vector2(0, baseline)
		s.offset = Vector2(0, -baseline)
		world.add_child(s)
	else:
		under.add_child(s)
	props[file] = s
	return s


func set_enabled(id: String, on: bool) -> void:
	for h in hotspots:
		if h.id == id:
			h.enabled = on


func hotspot(id: String) -> Dictionary:
	for h in hotspots:
		if h.id == id:
			return h
	return {}


func scale_at(y: float) -> float:
	if persp.y <= persp.x:
		return persp.w
	return lerpf(persp.z, persp.w, clampf((y - persp.x) / (persp.y - persp.x), 0.0, 1.0))


func can_save() -> bool:
	return not dead and UI.busy == 0


func player_position() -> Vector2:
	return player.position if player else Vector2(160, 180)


# --- input ---------------------------------------------------------------------------------
func _hotspot_at(p: Vector2) -> Dictionary:
	var best := {}
	var best_area := INF
	for h in hotspots:
		if not h.enabled:
			continue
		var r: Rect2 = h.actor.bounds() if h.has("actor") else h.rect
		if r.has_point(p):
			var area := r.get_area()
			if area < best_area:
				best_area = area
				best = h
	return best


func _unhandled_input(event: InputEvent) -> void:
	if dead:
		return
	if event is InputEventMouseMotion:
		var h := _hotspot_at(event.position)
		UI.hover_text = h.name if not h.is_empty() else ""
	elif event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		if UI.is_blocking():
			return
		get_viewport().set_input_as_handled()
		_click(event.position)


func _click(p: Vector2) -> void:
	_click_id += 1
	var my := _click_id
	var verb := UI.verb
	var item := GameManager.current_item if verb == "item" else ""
	var h := _hotspot_at(p)
	if verb == "walk" or (verb == "hand" and h.has("exit")):
		if h.has("exit"):
			await _go_exit(h, my)
		elif has_player:
			player.walk_to(filter_walk(p))
		return
	if h.is_empty():
		if verb == "look":
			await run_busy(func() -> void: await say(desc))
		elif verb == "item":
			await run_busy(func() -> void: await say("Nothing happens."))
		return
	if verb != "look" and has_player and h.approach != null:
		var ok := await player.walk_to_async(filter_walk(h.approach))
		if my != _click_id or not is_inside_tree():
			return
		if not ok and player.position.distance_to(h.approach) > 30.0:
			return
	if has_player and verb != "look":
		var target: Vector2 = h.actor.position if h.has("actor") else h.rect.get_center()
		player.face_point(target)
	await _run(h, verb, item)


func _go_exit(h: Dictionary, my: int) -> void:
	if has_player:
		var ok := await player.walk_to_async(h.approach)
		if my != _click_id or not is_inside_tree():
			return
		if not ok and player.position.distance_to(h.approach) > 30.0:
			return
	UI.busy += 1
	var allowed: bool = await exit_check(h.id)
	UI.busy = maxi(0, UI.busy - 1)
	if allowed and is_inside_tree() and not dead:
		if h.exit == "map":
			Sound.play("car")
		else:
			Sound.play("door")
		SceneManager.goto_room(h.exit, h.spawn)


func _run(h: Dictionary, verb: String, item: String) -> void:
	UI.busy += 1
	var handled: bool = await interact(h.id, verb, item)
	if not handled and is_inside_tree() and not dead:
		await _default(h, verb, item)
	UI.busy = maxi(0, UI.busy - 1)


func _default(h: Dictionary, verb: String, item: String) -> void:
	var npc: bool = h.get("npc", false)
	match verb:
		"look":
			await say(h.look if h.look != "" else "You see nothing special about the %s." % h.name.to_lower())
		"hand":
			await say("Keep your hands to yourself, Detective." if npc else "You can't do anything with that.")
		"talk":
			await say("%s doesn't have anything to say to you." % h.name if npc else "Talking to the furniture. The job is getting to you.")
		"item":
			if item == "badge" and npc:
				await say("You flash your badge. %s doesn't seem impressed." % h.name)
			else:
				await say("Using the %s on %s doesn't accomplish anything." % [GameManager.item_name(item), h.name.to_lower() if not npc else h.name])
		_:
			if h.has("exit"):
				return


## Inventory "Hand": using an item on yourself.
func use_self(id: String) -> void:
	await run_busy(func() -> void: await _use_self(id))


func _use_self(id: String) -> void:
	if await use_self_room(id):
		return
	match id:
		"notebook":
			await say(GameManager.case_notes(), "Case Notes")
		"gloves":
			if GameManager.flag("gloves_on"):
				await say("You're already wearing gloves.")
			else:
				GameManager.set_flag("gloves_on")
				await say("You snap on a pair of latex gloves.")
		"vest":
			if GameManager.flag("vest_worn"):
				await say("The vest stays on. It's heavy and hot, and that's the point.")
			else:
				GameManager.set_flag("vest_worn")
				GameManager.outfit = "gabe_vest"
				if player:
					player.set_sheet("gabe_vest")
				await say("You strap the ballistic vest on over your shirt. It's heavy and hot, and it could save your life.")
		"radio":
			Sound.play("radio")
			await say("\"2-Henry-9, Dispatch.\"\n\"Go ahead, 2-Henry-9.\"\n\"...Never mind, Dispatch. Radio check.\"")
		"camera":
			await say("Nothing here is worth a frame of film.")
		"flashlight":
			await say("You click the flashlight on and off. It works fine.")
		"gun":
			await say("You check your Beretta: loaded, safety on. You put it back in the holster.")
		"badge":
			await say("Shield #4471. You give it a quick polish on your sleeve.")
		"cuffs":
			await say("Cuffing yourself would make a great story for the squad room. Not today.")
		_:
			await say_icon(GameManager.item_desc(id), id, GameManager.item_name(id))


## Room-specific use_self hook. Return true if handled.
func use_self_room(_id: String) -> bool:
	return false


# --- scripting helpers -----------------------------------------------------------------
func run_busy(fn: Callable) -> void:
	UI.busy += 1
	await fn.call()
	UI.busy = maxi(0, UI.busy - 1)


func say(text: String, title: String = "") -> void:
	if is_inside_tree():
		await UI.say(text, title)


func say_icon(text: String, item_id: String, title: String = "") -> void:
	await UI.say_icon(text, UI.item_icon(item_id), title)


func choose(text: String, options: Array, title: String = "") -> int:
	return await UI.choose(text, options, title)


func give(id: String, text: String = "") -> void:
	GameManager.add_item(id)
	await say_icon(text if text != "" else "You take the %s." % GameManager.item_name(id), id)


func award(id: String) -> void:
	GameManager.award(id)


func flag(k: String) -> bool:
	return GameManager.flag(k)


func set_flag(k: String, v = true) -> void:
	GameManager.set_flag(k, v)


func has(id: String) -> bool:
	return GameManager.has_item(id)


func wait(t: float) -> void:
	await get_tree().create_timer(t).timeout


func walk(p: Vector2) -> bool:
	return await player.walk_to_async(p)


func dress(outfit: String) -> void:
	GameManager.outfit = outfit
	if player:
		player.set_sheet(outfit)


func die(text: String, title: String = "Career Over") -> void:
	dead = true
	UI.death(text, title)
