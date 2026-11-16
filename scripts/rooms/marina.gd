extends Room
## Act II: Pier 9 marina at dawn. The crime scene.

var _warned := false


func _setup() -> void:
	bg = "marina"
	walk_poly = PackedVector2Array([Vector2(0, 164), Vector2(124, 160), Vector2(150, 152), Vector2(178, 152), Vector2(318, 154), Vector2(318, 199), Vector2(0, 199)])
	persp = Vector4(150, 199, 0.66, 0.92)
	spawns = {"Default": [Vector2(40, 182), Actor.ROW_RIGHT]}
	desc = "The Pier 9 marina lot at sunrise. Gulls, diesel, and yellow tape. A maroon station wagon sits alone at the far end of the lot."


func _build() -> void:
	add_npc("cho", "Officer Cho", "cho", Vector2(146, 160), Actor.ROW_LEFT, Vector2(124, 168), "Officer Danny Cho, six months out of the academy. His uniform is pressed, his shoes are shined, and he looks like he hasn't blinked since four a.m.")
	add_hotspot("body", "Victim", Rect2(222, 94, 48, 24), Vector2(248, 160), "")
	add_hotspot("wagon", "Station wagon", Rect2(180, 94, 132, 50), Vector2(250, 160), "A maroon '86 Ford station wagon with Local 19 bumper stickers. The driver's window is rolled down.")
	add_hotspot("ground", "Asphalt", Rect2(156, 140, 26, 14), Vector2(172, 160), "")
	add_hotspot("patrol", "Patrol car", Rect2(8, 98, 116, 54), null, "Cho's black-and-white, with the light bar still turning. Someone should tell him the scene is secure.")
	add_hotspot("water", "Marina", Rect2(0, 36, 320, 64), null, "Sailboats rocking at their moorings, and the sun coming up orange over the breakwater. Pretty. Somebody died here anyway.")
	add_hotspot("tape", "Crime scene tape", Rect2(150, 118, 166, 14), null, "POLICE LINE - DO NOT CROSS. Cho strung it himself, and it's perfectly level.")
	add_exit("car", "Your car", Rect2(0, 162, 16, 38), Vector2(10, 184), "map", "Default", "Your car is parked at the edge of the lot.")
	add_prop("marina_casing")
	props["marina_casing"].visible = flag("casing_seen") and not flag("casing_found")


func enter() -> void:
	if not flag("marina_visited"):
		set_flag("marina_visited")
		await run_busy(func() -> void:
			await say("Pier 9 Marina, 6:12 A.M. A patrol car's light bar is still turning. Officer Danny Cho is guarding the tape.")
			if not has("badge"):
				await say("You pat your jacket out of habit. Something feels missing."))


func filter_walk(p: Vector2) -> Vector2:
	if not flag("log_signed") and p.x > 136:
		if not _warned:
			_warned = true
			_cho_warn.call_deferred()
		return Vector2(130, maxf(p.y, 168))
	return p


func _cho_warn() -> void:
	await wait(0.6)
	await run_busy(func() -> void: await say("\"Hold it, sir! This is a secured crime scene. Nobody crosses the tape without signing the log.\"", "Officer Cho"))
	_warned = false


func interact(id: String, verb: String, item: String) -> bool:
	match id:
		"cho":
			if verb == "talk":
				await _talk_cho()
				return true
			if verb == "item" and item == "badge":
				await _show_badge()
				return true
		"body":
			if verb == "look":
				await say("Thomas Ruiz, 41, slumped behind the wheel. There's a gunshot wound to the right temple. A .38 revolver rests in his right hand, in his lap.\n\nA longshoreman's hands. A wedding ring.")
				award("look_body")
				return true
			if verb == "hand":
				await _search_body()
				return true
			if verb == "item":
				return await _item_on_scene(item)
		"wagon":
			if verb == "hand":
				await say("You'd better start with the body itself. Through the open window.")
				return true
			if verb == "item":
				return await _item_on_scene(item)
		"ground":
			return await _ground(verb, item)
	return false


func use_self_room(id: String) -> bool:
	if id == "camera" and flag("log_signed"):
		await _photos()
		return true
	if id == "flashlight" and flag("log_signed") and player.position.distance_to(Vector2(172, 160)) < 40:
		await _ground("item", "flashlight")
		return true
	return false


func _talk_cho() -> void:
	if not flag("badge_shown"):
		await say("\"Sir, this is a secured crime scene. I'm going to need to see some identification.\"", "Officer Cho")
		if not has("badge"):
			await say("You reach for your badge... and picture it sitting on a box next to your telephone. At home.")
			await say("\"Come on, Cho. Navarro. Homicide. We've met.\"", "Gabe")
			await say("\"Sorry, Detective. Lieutenant says no badge, no entry. No exceptions.\"", "Officer Cho")
		else:
			await say("(Show him your badge.)")
		return
	if not flag("log_signed"):
		await _sign_log()
		return
	while true:
		var i := await choose("Ask Officer Cho:", ["\"What have we got?\"", "\"Any witnesses?\"", "\"Has anyone touched the body?\"", "\"Is the coroner on the way?\"", "\"That's all, thanks.\""], "Officer Cho")
		match i:
			0: await say("\"Thomas Ruiz, forty-one. Longshoreman, Local 19. Harbor security found him at 4:50 on their rounds. One gunshot, revolver in his hand. Looks like he ate his gun, sir.\"", "Officer Cho")
			1:
				await say("\"Just one. A dockhand on the night shift says he heard a pop around two, then saw a black Bronco tear out of the lot. No plate. He went back to work. Didn't want to get involved.\"", "Officer Cho")
				set_flag("cho_bronco")
				award("ask_witness")
			2: await say("\"No sir. Security checked for a pulse, then called us. I strung the tape and started the log. Nobody's been past it but you.\"", "Officer Cho")
			3: await say("\"The coroner's van is coming once you release the body. You'll find them over at County after that.\"", "Officer Cho")
			_: return


func _show_badge() -> void:
	if flag("badge_shown"):
		await say("Cho has already seen your badge. Twice.")
		return
	set_flag("badge_shown")
	await say("You show Officer Cho your shield.")
	await say("\"Detective Navarro. Sorry, sir. You know how it is.\"", "Officer Cho")
	award("show_badge")
	await _sign_log()


func _sign_log() -> void:
	var i := await choose("Cho holds out the crime-scene log on a clipboard.", ["Sign the log.", "\"Skip it, Cho. I'm in a hurry.\""], "Officer Cho")
	if i == 0:
		set_flag("log_signed")
		await say("You sign in: NAVARRO, G. #4471, 0614 hrs. Every person who crosses the tape goes in this log, and every one of them can be called to testify.")
		award("sign_log")
		await say("\"Thank you, sir.\" Cho lifts the tape for you.", "Officer Cho")
	else:
		await say("\"Sorry, Detective. Nobody crosses without signing. Lieutenant Kessler's orders.\"", "Officer Cho")


func _item_on_scene(item: String) -> bool:
	match item:
		"camera":
			await _photos()
			return true
		"gloves":
			await _use_self("gloves")
			return true
		"bags":
			await say("Bag what? Find the evidence first.")
			return true
		"flashlight":
			await say("You shine the flashlight around the car's interior. There's no blood on the passenger seat and no blood on the window. He never saw it coming.")
			return true
	return false


func _photos() -> void:
	if flag("photos"):
		await say("You've already photographed the scene. You don't need another roll.")
		return
	set_flag("photos")
	Sound.play("camera")
	await say("Click... whirr... click. You photograph the wagon, the body, the revolver, the lot and the tape line, all from every angle, before anything is moved.")
	if flag("body_searched"):
		await say("Too bad you'd already been through his pockets. A defense attorney will love that.")
	else:
		award("photos")


func _search_body() -> void:
	if flag("body_searched"):
		await say("You've already searched the body. The coroner's people will take Mr. Ruiz from here.")
		return
	if not flag("photos"):
		await say("Procedure, Navarro. Photograph the scene before you touch anything.")
		return
	if not flag("gloves_on"):
		if has("gloves"):
			await say("Not with your bare hands. Put on a pair of gloves first.")
		else:
			await say("You aren't putting bare hands on a crime scene, and your gloves are in the field kit in your trunk.")
		return
	set_flag("body_searched")
	award("gloves_on")
	await say("Gloved, careful, you go through Tommy Ruiz's pockets.")
	await give("union_card", "His wallet holds $212 in cash, a photo of two little girls, and a Longshore Local 19 union card. THOMAS RUIZ, STEWARD. It wasn't a robbery.")
	award("search_body")
	await give("matchbook", "In his shirt pocket: a matchbook from THE RUSTY ANCHOR on Harbor Blvd., with a phone number scrawled inside.")
	award("matchbook")
	await say("You note the revolver without moving it: a .38 Smith & Wesson, one round fired. The coroner's people will bag it and the body.\n\nHe's a right-handed man, shot in the right temple. It looks textbook. Almost too textbook.")


func _ground(verb: String, item: String) -> bool:
	if flag("casing_found"):
		if verb == "look":
			await say("Just asphalt, oil stains and the outline of where the casing was.")
			return true
		return false
	match verb:
		"look":
			if flag("casing_seen"):
				await say("A small brass shell casing lies on the asphalt near the wagon's front bumper.")
			else:
				await say("The asphalt in the wagon's shadow is still too dark to make anything out.")
			return true
		"hand":
			if not flag("casing_seen"):
				await say("You crouch and feel around in the dark. Nothing but grit. You need light down here.")
			elif not flag("gloves_on"):
				await say("Gloves first, Detective.")
			elif not has("bags"):
				await say("You need an evidence bag. They're in your field kit.")
			else:
				await _take_casing()
			return true
		"item":
			if item == "flashlight":
				if not flag("log_signed"):
					return false
				set_flag("casing_seen")
				props["marina_casing"].visible = true
				await say("You sweep the beam under the wagon's front bumper. Something brass glints back at you: a shell casing.")
				return true
			if item == "bags" and flag("casing_seen"):
				if not flag("gloves_on"):
					await say("Gloves first, Detective.")
				else:
					await _take_casing()
				return true
	return false


func _take_casing() -> void:
	set_flag("casing_found")
	props["marina_casing"].visible = false
	await give("casing", "You pick up the casing with a gloved fingertip and drop it into an evidence bag. You label it: date, time, location, NAVARRO #4471.")
	award("casing")
	await say("It's a 9mm. And Tommy Ruiz is holding a .38 revolver.\n\nRevolvers keep their brass in the cylinder. They don't throw casings onto the pavement. Somebody else fired a semi-automatic out here.")
	award("deduce")
	await say("\"This wasn't a suicide,\" you mutter.", "Gabe")
