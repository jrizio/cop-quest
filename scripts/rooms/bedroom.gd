extends Room
## Act I: the half-unpacked bedroom, 5:40 a.m. The phone rings.

var _ringing := false


func _setup() -> void:
	bg = "bedroom"
	walk_poly = PackedVector2Array([Vector2(90, 199), Vector2(82, 186), Vector2(64, 160), Vector2(46, 157), Vector2(46, 150), Vector2(82, 137), Vector2(128, 131), Vector2(194, 133), Vector2(194, 147), Vector2(218, 147), Vector2(226, 144), Vector2(266, 146), Vector2(302, 151), Vector2(318, 168), Vector2(318, 199)])
	persp = Vector4(130, 199, 0.72, 1.05)
	spawns = {"Default": [Vector2(130, 178), Actor.ROW_DOWN], "FromDriveway": [Vector2(102, 140), Actor.ROW_DOWN]}
	desc = "Your new bedroom. Bare walls, a mattress on the floor, and a mountain of moving boxes. Elena says it'll feel like home in a month. You've been married long enough to believe her."


func _build() -> void:
	add_hotspot("mattress", "Mattress", Rect2(0, 156, 84, 40), Vector2(96, 178),
		"Your mattress, on the floor until the bed frame turns up. Elena's side is already cold. She left for the early shift at Mesa Verde General an hour ago.")
	add_hotspot("phone", "Telephone", Rect2(8, 118, 18, 13), Vector2(52, 155), "The telephone, perched on a box marked MISC. It was the first thing you plugged in. Cop's instinct.")
	add_hotspot("miscbox", "Box", Rect2(4, 124, 46, 28), Vector2(52, 155), "A moving box marked MISC. It's holding up the phone.")
	if not has("keys") and not flag("got_keys"):
		add_prop("bedroom_keys")
		add_hotspot("keys", "Key ring", Rect2(25, 124, 11, 8), Vector2(52, 155), "Your key ring is on the box next to the phone.")
	if not has("badge") and not flag("got_badge"):
		add_prop("bedroom_badge")
		add_hotspot("badge", "Badge", Rect2(35, 124, 8, 9), Vector2(52, 155), "Your detective's shield, right where you left it.")
	add_hotspot("lockbox", "Gun safe", Rect2(194, 132, 26, 14), Vector2(206, 151), "Your gun safe. Department policy and common sense agree: your sidearm stays locked up at home.")
	add_hotspot("clothes", "Clothes box", Rect2(220, 104, 56, 39), Vector2(246, 151), "A box marked GABE, flaps open. Elena packed your clothes with military precision.")
	add_hotspot("note", "Note", Rect2(238, 125, 12, 10), Vector2(246, 151), "A note in Elena's handwriting is taped to the box.")
	add_hotspot("stack", "Boxes", Rect2(264, 96, 42, 54), Vector2(284, 157), "KITCHEN and BOOKS. Elena labeled every box. You labeled one STUFF, and she still hasn't forgiven you.")
	add_hotspot("window", "Window", Rect2(135, 34, 160, 80), null, "Trees, mostly. That's why Elena wanted this house. The sky is just starting to go gray.")
	add_exit("door", "Hallway", Rect2(83, 43, 47, 86), Vector2(100, 136), "driveway", "FromHouse", "The door out to the hall and the front of the house.")


func enter() -> void:
	if not flag("phone_answered"):
		_ringing = true
		_ring_loop()
		await run_busy(func() -> void: await say("The phone is ringing."))


func _ring_loop() -> void:
	while _ringing and is_inside_tree():
		Sound.play("ring")
		await wait(3.0)


func exit_check(id: String) -> bool:
	if id == "door":
		if not flag("phone_answered"):
			await say("The phone is ringing. At 5:40 in the morning, that's never good news. Answer it.")
			return false
		if GameManager.outfit == "gabe_boxers":
			await say("You're not going out in your boxers, Detective. Get dressed.")
			return false
	return true


func interact(id: String, verb: String, item: String) -> bool:
	match id:
		"phone":
			if verb == "hand" or verb == "talk":
				if not flag("phone_answered"):
					await _phone_call()
				else:
					await say("There's nobody to call at this hour. You can reach Elena at the hospital from your desk later.")
				return true
		"keys":
			if verb == "hand":
				await _take_keys()
				return true
		"badge":
			if verb == "hand":
				set_flag("got_badge")
				props["bedroom_badge"].queue_free()
				set_enabled("badge", false)
				await give("badge", "You pick up your badge. Shield #4471.")
				award("badge")
				return true
		"miscbox":
			if verb == "hand":
				if hotspot("keys").get("enabled", false) or hotspot("badge").get("enabled", false):
					await say("Your keys and badge are sitting on top of it.")
				else:
					await say("Just odds and ends. The phone cord runs into it, so it stays put.")
				return true
		"lockbox":
			if verb == "hand" or (verb == "item" and item == "keys"):
				await _open_safe()
				return true
		"clothes":
			if verb == "hand":
				if GameManager.outfit != "gabe_boxers":
					await say("Nothing else in there but Elena's idea of what you should wear on weekends.")
				else:
					dress("gabe")
					GameManager.add_item("notebook")
					await say("You pull on a pressed shirt, gray slacks and your lucky tie. Your notebook goes into the shirt pocket.\n\nDetective Navarro is ready for work.")
					award("dressed")
				return true
		"note":
			if verb == "look" or verb == "hand":
				await say("\"Gabe -\nWelcome home! Dinner tonight at SEVEN. My mother is driving in from Fresno. Do NOT be late.\n\nLove, E.\n\nP.S. The gun safe key is on your key ring, not in the junk drawer. We don't have a junk drawer yet.\"", "A Note from Elena")
				award("note")
				return true
		"mattress":
			if verb == "hand":
				await say("Five more minutes... No. Somebody's dead, and you're up.")
				return true
	return false


func use_self_room(id: String) -> bool:
	if id == "keys" and player.position.distance_to(Vector2(206, 151)) < 40:
		await _open_safe()
		return true
	return false


func _take_keys() -> void:
	set_flag("got_keys")
	props["bedroom_keys"].queue_free()
	set_enabled("keys", false)
	await give("keys", "You take your key ring: car keys, house key, and the little key to the gun safe.")
	award("keys")


func _open_safe() -> void:
	if flag("safe_open"):
		await say("The gun safe is empty now.")
		return
	if not has("keys"):
		await say("It's locked. The key is on your key ring.")
		return
	if GameManager.outfit == "gabe_boxers":
		await say("And put the holster where, exactly? Get dressed first.")
		return
	set_flag("safe_open")
	Sound.play("door")
	await say("You unlock the gun safe.")
	GameManager.add_item("gun")
	GameManager.add_item("cuffs")
	await say_icon("Your Beretta 92 goes on your belt in its holster. Your handcuffs go on the back of your belt.", "gun")
	award("gun")
	award("cuffs")


func _phone_call() -> void:
	_ringing = false
	set_flag("phone_answered")
	await say("\"Navarro.\"", "Gabe")
	await say("\"It's Kessler. Sorry about the hour.\"", "Lt. Kessler")
	await say("\"Lieutenant. I've lived in this house for exactly one night.\"", "Gabe")
	await say("\"Then you'll be glad to get out of it. Harbor security found a man dead in his car in the Pier 9 marina lot. Thomas Ruiz, longshoreman. Gun in his hand. Patrol is calling it a suicide.\"", "Lt. Kessler")
	await say("\"And you're not.\"", "Gabe")
	await say("\"I'm not calling it anything. That's your job. Officer Cho is holding the scene. Get down there, and do it by the book.\"", "Lt. Kessler")
	award("answer_phone")
	await say("Click. Time to get dressed, get your badge and your gun, and get moving.")
