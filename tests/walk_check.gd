extends Node
## Dev test: every spawn and hotspot approach point must be walkable and
## reachable from the default spawn.
const ROOMS := ["bedroom", "driveway", "marina", "squad", "basement", "coroner", "bar", "ware_ext", "ware_int", "ending"]
func _ready() -> void:
	_run.call_deferred()
func _run() -> void:
	get_tree().current_scene = null
	for f in ["phone_answered", "log_signed", "backup", "warrant"]:
		GameManager.set_flag(f)
	var bad := 0
	for id in ROOMS:
		var r: Room = load("res://scripts/rooms/%s.gd" % id).new()
		get_tree().root.add_child(r)
		await get_tree().process_frame
		var wm: Walkmap = r.walkmap
		var start: Vector2 = r.spawns["Default"][0]
		for s in r.spawns:
			var p: Vector2 = r.spawns[s][0]
			if not wm.is_walkable(p):
				print("BAD spawn ", id, ".", s, " ", p); bad += 1
		for h in r.hotspots:
			if h.approach == null:
				continue
			var a: Vector2 = r.filter_walk(h.approach) if id != "marina" else h.approach
			if not wm.is_walkable(a):
				print("BAD approach ", id, ".", h.id, " ", a, " -> clamps to ", wm.clamp_point(a)); bad += 1
				continue
			var path := wm.find_path(start, a)
			var cur := start
			for q in path:
				if not wm.segment_clear(cur, q):
					print("NO PATH ", id, ".", h.id, " from ", start, " to ", a); bad += 1
					break
				cur = q
		r.queue_free()
		UI.clear_windows()
		UI.busy = 0
	print("WALK CHECK DONE, problems=", bad)
	get_tree().quit()
