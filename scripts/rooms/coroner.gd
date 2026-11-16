extends Room
## Act III: the County Coroner. Dr. Oduya and the autopsy.


func _setup() -> void:
	bg = "coroner"
	walk_poly = PackedVector2Array([Vector2(0, 156), Vector2(40, 124), Vector2(280, 124), Vector2(320, 156), Vector2(320, 199), Vector2(0, 199)])
	blockers = [Rect2(112, 120, 126, 30)]
	persp = Vector4(124, 199, 0.72, 1.0)
	spawns = {"Default": [Vector2(40, 162), Actor.ROW_RIGHT]}
	desc = "The autopsy suite at the County Coroner. White tile, steel and fluorescent light. It's always forty degrees in here, and it always smells like pine cleaner over something worse."


func _build() -> void:
	add_prop("coroner_table", 140)
	add_npc("oduya", "Dr. Oduya", "oduya", Vector2(184, 128), Actor.ROW_DOWN, Vector2(172, 162), "Dr. Henry Oduya, Deputy Coroner. Twenty years of cutting, and he still hums Motown while he works.")
	add_hotspot("body", "Tommy Ruiz", Rect2(118, 102, 116, 30), Vector2(150, 162), "Tommy Ruiz, under a sheet. A toe tag hangs off the end of the table.")
	add_hotspot("drawers", "Cold drawers", Rect2(282, 12, 38, 104), Vector2(290, 158), "The cold drawers. Six of them, with six names on the cards. Busy week.")
	add_hotspot("sink", "Sink", Rect2(56, 58, 40, 62), Vector2(76, 160), "A deep steel sink and a hanging scale. You try not to think about what gets weighed.")
	add_hotspot("chart", "Chart", Rect2(240, 40, 26, 34), Vector2(252, 158), "A wall chart: STAGES OF RIGOR MORTIS. Someone has drawn a smiley face on it.")
	add_exit("door", "Exit", Rect2(8, 42, 28, 98), Vector2(30, 156), "map", "Default", "The door back out to the parking lot.")


func interact(id: String, verb: String, item: String) -> bool:
	match id:
		"oduya":
			if verb == "talk":
				await _talk()
				return true
			if verb == "item" and item == "badge":
				await say("\"I know who you are, Navarro. Put that away.\"", "Dr. Oduya")
				return true
			if verb == "item" and item == "casing":
				await say("\"Ballistics is the lab's business, not mine. Take that to Rosa Delgado at headquarters.\"", "Dr. Oduya")
				return true
		"body":
			if verb == "hand":
				await say("Dr. Oduya clears his throat. \"Hands off my patient, Detective.\"")
				return true
	return false


func _talk() -> void:
	if not flag("autopsy_done"):
		set_flag("autopsy_done")
		await say("\"Detective Navarro. You're here about Mr. Ruiz. I took him first. Something about him bothered me.\"", "Dr. Oduya")
		await say("\"Look at the entry wound. No soot. No stippling. No muzzle imprint. When you press a gun to your own head, the gas and powder go into the wound. This shot came from at least three feet away.\"", "Dr. Oduya")
		await say("\"Nobody shoots himself from three feet, Detective. Not with a revolver. Not with anything.\"", "Dr. Oduya")
		await say("\"There's bruising on his knuckles, too, a few hours old. He hit someone last night, and hard. Time of death is between one and three A.M.\"", "Dr. Oduya")
		GameManager.add_item("autopsy")
		award("autopsy")
		await give("slug", "\"And here's the bullet. Nine millimeter, not a .38. His revolver didn't fire this.\" He hands you the bagged slug and the preliminary report.")
		award("slug")
		await say("Manner of death: HOMICIDE. Now it's officially your case.")
		return
	while true:
		var i := await choose("Ask Dr. Oduya:", ["\"About the revolver...\"", "\"Anything under his fingernails?\"", "\"How's the family taking it?\"", "\"Thanks, Doc.\""], "Dr. Oduya")
		match i:
			0: await say("\"One chamber fired, and his right hand tested positive for gunshot residue. That's easy to fake, Detective: you wrap a dead man's hand around a gun and fire it out the window. The slug in his head came from a different gun.\"", "Dr. Oduya")
			1: await say("\"Fibers. Olive drab canvas, like a work jacket. Whoever he fought was wearing one.\"", "Dr. Oduya")
			2: await say("\"His wife came in to identify him at eight. Two little girls at home.\" He goes quiet. \"Find who did this, Gabe.\"", "Dr. Oduya")
			_: return
