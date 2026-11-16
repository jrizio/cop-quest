extends Node
## Dev test: plays the whole game start to finish by driving room actions
## directly and auto-answering dialogs. Run:
##   godot --headless --path . res://tests/playthrough.tscn
const PREFER := ["Sign the log", "POLICE!", "I'll be there", "Not on duty", "Call Elena"]
const AVOID := ["beer", "Just one", "open fire", "Working late", "Skip it", "can't promise", "Hang up", "Quit", "Restart", "Play Again"]
var seen := {}
var verbose := false

func _ready() -> void:
	verbose = OS.get_cmdline_user_args().has("v")
	_run.call_deferred()

func _process(_d: float) -> void:
	if UI._stack.is_empty():
		return
	var top = UI._stack.back()
	if not (top is SierraDialog) or not top._armed or top.has_meta("done"):
		return
	top.set_meta("done", true)
	if verbose:
		print("   [", top.title, "] ", top.text.replace("\n", " ").left(110))
	if top.buttons.is_empty():
		top.chosen.emit(-1)
		return
	var key: String = top.text
	var n: int = seen.get(key, 0)
	seen[key] = n + 1
	var pick := -1
	for i in top.buttons.size():
		for p in PREFER:
			if String(top.buttons[i]).contains(p) and n == 0:
				pick = i
	if pick < 0:
		var ok := []
		for i in top.buttons.size():
			var bad := false
			for a in AVOID:
				if String(top.buttons[i]).contains(a):
					bad = true
			if not bad:
				ok.append(i)
		pick = ok[mini(n, ok.size() - 1)] if not ok.is_empty() else top.buttons.size() - 1
	if top.text.begins_with("Final score"):
		print("FINAL: ", top.text.replace("\n", " | "))
		pick = 1  # Quit
	if verbose:
		print("   -> ", top.buttons[pick])
	top.chosen.emit(pick)

func settle() -> void:
	await get_tree().create_timer(0.2).timeout
	while UI.busy > 0 or not UI._stack.is_empty():
		await get_tree().process_frame

func go(room: String) -> void:
	SceneManager.goto_room(room)
	await get_tree().create_timer(1.0).timeout
	await settle()
	print("== ", room, "  score=", GameManager.score)

func act(id: String, verb: String, item: String = "") -> void:
	var r = SceneManager.current_room()
	var h: Dictionary = r.hotspot(id)
	if h.is_empty():
		push_error("PLAYTEST: no hotspot " + id + " in " + r.name)
		return
	await r._run(h, verb, item)
	await settle()
	if verbose:
		print(" act ", id, " ", verb, " ", item, " -> ", GameManager.score)

func use(id: String) -> void:
	await SceneManager.current_room().use_self(id)
	await settle()

func _run() -> void:
	get_tree().current_scene = null
	GameManager.reset()
	await go("bedroom")
	await act("phone", "hand")
	await act("clothes", "hand")
	await act("note", "look")
	await act("keys", "hand")
	await act("badge", "hand")
	await act("lockbox", "hand")
	await go("driveway")
	for i in 3:
		await act("trunk", "hand")
	await go("marina")
	await act("cho", "item", "badge")
	await act("cho", "talk")
	await act("body", "look")
	await act("body", "item", "camera")
	await use("gloves")
	await act("body", "hand")
	await act("ground", "item", "flashlight")
	await act("ground", "hand")
	await go("coroner")
	await act("oduya", "talk")
	await act("oduya", "talk")
	await go("basement")
	await act("rosa", "item", "casing")
	await act("rosa", "item", "slug")
	await act("voss", "talk")
	await act("voss", "talk")
	await go("squad")
	await act("computer", "hand")
	await act("phone", "hand")
	await act("pruitt", "talk")
	await go("bar")
	await act("sal", "item", "badge")
	await act("sal", "talk")
	await act("wendell", "talk")
	await go("squad")
	await act("kessler", "talk")
	await go("driveway")
	await use("vest")
	await go("ware_ext")
	await use("radio")
	SceneManager.goto_room("ware_int")
	var t := 0.0
	while true:
		await get_tree().process_frame
		var r = SceneManager.current_room()
		if r and r.name == "ware_int" and r._showdown:
			break
	print("== ware_int showdown, score=", GameManager.score)
	await act("maddox", "item", "gun")
	await act("maddox", "item", "cuffs")
	await act("maddox", "talk")
	await act("container", "hand")
	await get_tree().create_timer(3.0).timeout
	var missing := []
	for k in GameManager.POINTS:
		if not GameManager.awarded.has(k):
			missing.append(k)
	print("SCORE ", GameManager.score, " / ", GameManager.max_score(), "  missing: ", missing, "  dead=", SceneManager.current_room().dead if SceneManager.current_room() else "n/a")
	print("PLAYTEST DONE")
	get_tree().quit()
