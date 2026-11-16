extends Room
## Act III: The Rusty Anchor. Sal the bartender and Wendell the dockworker.


func _setup() -> void:
	bg = "bar"
	walk_poly = PackedVector2Array([Vector2(0, 140), Vector2(226, 140), Vector2(226, 152), Vector2(320, 152), Vector2(320, 199), Vector2(0, 199)])
	persp = Vector4(140, 199, 0.82, 1.02)
	spawns = {"Default": [Vector2(24, 178), Actor.ROW_RIGHT]}
	desc = "The Rusty Anchor: dark wood, a sticky floor, and the smell of fifty years of spilled beer. It's 2 P.M. and a few longshoremen are drinking their lunch."


func _build() -> void:
	add_npc("sal", "Sal Brennan", "sal", Vector2(110, 101), Actor.ROW_DOWN, Vector2(110, 152), "Sal Brennan, owner and bartender. He's seen everything twice and talked about none of it.")
	add_prop("bar_counter", 104)
	add_npc("wendell", "Wendell Pike", "wendell", Vector2(252, 160), Actor.ROW_LEFT, Vector2(226, 166), "A big longshoreman in a red flannel shirt, nursing a coffee and watching the door like it owes him money.")
	add_hotspot("bottles", "Back bar", Rect2(12, 18, 190, 56), Vector2(80, 152), "Bottles in two rows, in front of a mirror that hasn't been cleaned since the Korean War.")
	add_hotspot("neon", "Neon sign", Rect2(226, 26, 72, 24), null, "COLD BEER. Half of it buzzes.")
	add_hotspot("booth", "Booth", Rect2(232, 90, 84, 50), Vector2(226, 166), "A red vinyl booth, patched with duct tape. Two cups on the table, one of them still warm.")
	add_hotspot("wheel", "Ship's wheel", Rect2(254, 58, 30, 30), null, "A ship's wheel and a life ring. Nautical decor, the law of every harbor bar.")
	add_hotspot("stools", "Bar stools", Rect2(20, 128, 196, 26), Vector2(110, 160), "Five stools with red seats. Tommy Ruiz sat on one of them last night.")
	add_exit("door", "Door", Rect2(0, 138, 14, 62), Vector2(10, 178), "map", "Default", "The door back out to Harbor Boulevard.")


func enter() -> void:
	if not flag("bar_visited"):
		set_flag("bar_visited")
		await run_busy(func() -> void: await say("The Rusty Anchor. Every head in the place turns when you come in, and then every head turns back. They know a cop when they see one."))


func interact(id: String, verb: String, item: String) -> bool:
	match id:
		"sal":
			if verb == "talk":
				await _sal()
				return true
			if verb == "item" and item == "badge":
				await _sal_badge()
				return true
			if verb == "item" and item in ["union_card", "matchbook"]:
				if flag("bar_badge"):
					await _sal_statement()
				else:
					await say("Sal glances at it and keeps polishing. \"Lot of people come through here, pal. You a cop or a customer?\"", "Sal Brennan")
				return true
		"wendell":
			if verb == "talk":
				await _wendell()
				return true
			if verb == "item" and item == "badge":
				await say("Wendell looks at the badge and then at the door. \"I don't know nothin', man.\"", "Wendell Pike")
				return true
	return false


func _sal() -> void:
	if not flag("bar_badge"):
		var i := await choose("\"What'll it be?\"", ["\"Do you know Tommy Ruiz?\"", "\"I'll have a beer.\"", "\"Nothing.\""], "Sal Brennan")
		if i == 0:
			await say("\"Lot of Tommys come through here. I don't remember faces. You drinking, or what?\"", "Sal Brennan")
		elif i == 1:
			await _beer()
		return
	while true:
		var opts := ["\"Tell me about Tommy Ruiz.\"", "\"Who's the guy in the booth?\"", "\"I'll have a beer.\"", "\"Thanks, Sal.\""]
		var i := await choose("Talk to Sal:", opts, "Sal Brennan")
		match i:
			0: await _sal_statement()
			1:
				if flag("sal_talked"):
					await say("\"Wendell Pike. He and Tommy came up together on the docks. He hasn't touched his coffee in an hour.\"", "Sal Brennan")
				else:
					await say("\"Regular. Leave him alone.\"", "Sal Brennan")
			2: await _beer()
			_: return


func _sal_badge() -> void:
	if flag("bar_badge"):
		await say("\"Yeah, yeah, I saw it. Homicide.\"", "Sal Brennan")
		return
	set_flag("bar_badge")
	award("bar_badge")
	await say("Sal looks at your shield a long time. Then he puts the glass down.")
	await say("\"Homicide. So Tommy's dead.\" It isn't a question.", "Sal Brennan")


func _sal_statement() -> void:
	if flag("sal_talked"):
		await say("\"I told you what I saw. Maddox grabbed his collar: 'You open your mouth about the box, you're done.' Ask Wendell about the box.\"", "Sal Brennan")
		return
	set_flag("sal_talked")
	await say("\"Tommy was in here last night until midnight. He got into it with Kurt Maddox. Maddox is the foreman over at Pacific Rim Freight. Mean drunk. Meaner sober.\"", "Sal Brennan")
	await say("\"Maddox grabbed Tommy by the collar and said, real quiet: 'You open your mouth about the box, you're done.' Tommy laughed in his face and walked out. Maddox left about five minutes later.\"", "Sal Brennan")
	await say("\"What box?\"", "Gabe")
	await say("Sal tips his head toward the back booth. \"Ask Wendell. He and Tommy were tight. Tell him I said it's okay.\"", "Sal Brennan")
	award("sal_statement")
	await say("Sal pulls a cold one and sets it on the bar. \"You look like you need this. On the house, for Tommy.\"", "Sal Brennan")
	var i := await choose("A free beer, sweating on the bar.", ["\"Not on duty, Sal. But thanks.\"", "\"Just one. For Tommy.\""], "Sal Brennan")
	if i == 0:
		await say("Sal shrugs and drinks it himself. \"For Tommy.\"", "Sal Brennan")
		award("refuse_drink")
	else:
		await _drink()


func _beer() -> void:
	if flag("drank_beer"):
		await say("You've already had one. One is already one too many on duty.")
		return
	await say("Sal slides a cold bottle down the bar.", "Sal Brennan")
	await _drink()


func _drink() -> void:
	set_flag("drank_beer")
	await say("You knock it back. It's cold and bitter, and on an empty stomach it goes straight to your head.")


func _wendell() -> void:
	if flag("wendell_talked"):
		await say("\"Just get the guy, Detective. For Tommy's girls.\"", "Wendell Pike")
		return
	if not flag("sal_talked"):
		await say("Wendell stares into his coffee. \"I don't know nothin', man. I just work the docks.\"", "Wendell Pike")
		return
	set_flag("wendell_talked")
	await say("\"Sal says you and Tommy were friends. I'm working his case, Wendell. I don't think he killed himself.\"", "Gabe")
	await say("Wendell's jaw works. Finally:", "Wendell Pike")
	await say("\"Last week Tommy cracked a container in Warehouse 7. PRFU-7731. Manifest said 'machine parts,' bound for Manila. But the crates rattled, man. He opened one.\"", "Wendell Pike")
	await say("\"Guns. Pistols, shotguns, all of 'em with yellow police tags on the trigger guards. Your tags. He was going to call the feds.\"", "Wendell Pike")
	await say("\"Maddox runs Warehouse 7. Nobody crosses Maddox. Nobody but Tommy.\"", "Wendell Pike")
	award("wendell")
