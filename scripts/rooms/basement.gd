extends Room
## Act III: HQ basement. Property & Evidence (Sgt. Voss) and the Crime Lab (Rosa).


func _setup() -> void:
	bg = "basement"
	walk_poly = PackedVector2Array([Vector2(0, 150), Vector2(50, 116), Vector2(270, 116), Vector2(320, 150), Vector2(320, 199), Vector2(0, 199)])
	persp = Vector4(116, 199, 0.76, 1.02)
	spawns = {"Default": [Vector2(46, 152), Actor.ROW_RIGHT]}
	desc = "The basement of MVPD headquarters. Cinder block, buzzing tubes and the hum of the boiler. To the left, the Property cage. To the right, the Crime Lab."


func _build() -> void:
	add_npc("voss", "Sgt. Voss", "voss", Vector2(110, 111), Actor.ROW_DOWN, Vector2(110, 142), "Sgt. Walt Voss, Property & Evidence. Gray crew cut, reading glasses on a chain, and a smile that's a little too quick.")
	add_npc("rosa", "Rosa Delgado", "rosa", Vector2(212, 111), Actor.ROW_DOWN, Vector2(212, 142), "Rosa Delgado, firearms examiner. She can tell you which gun fired a bullet, and what you had for lunch.")
	for id in ["voss", "rosa"]:
		npcs[id].fixed_scale = 0.64
		npcs[id].place(npcs[id].position)
	add_prop("basement_wall", 113)
	add_hotspot("cage", "Property window", Rect2(66, 30, 86, 74), Vector2(110, 142), "PROPERTY & EVIDENCE. Everything the department seizes ends up behind that mesh, until it's returned, auctioned or destroyed.")
	add_hotspot("lab", "Crime Lab window", Rect2(168, 30, 86, 74), Vector2(212, 142), "CRIME LAB - BALLISTICS. A comparison microscope, a water tank for test-firing, and Rosa.")
	add_hotspot("notice", "Notice", Rect2(280, 38, 28, 40), Vector2(290, 156), "\"ALL EVIDENCE MUST BE BOOKED WITHIN 24 HOURS OF SEIZURE. NO EXCEPTIONS. - SGT. W. VOSS\"")
	add_hotspot("extinguisher", "Fire extinguisher", Rect2(286, 86, 12, 24), Vector2(290, 156), "A fire extinguisher. Inspected 1987.")
	add_exit("stairs", "Stairs up", Rect2(10, 40, 30, 96), Vector2(44, 152), "squad", "FromStairs", "The stairs back up to Homicide.")


func interact(id: String, verb: String, item: String) -> bool:
	match id:
		"voss", "cage":
			if verb == "talk":
				await _voss()
				return true
			if verb == "item":
				if item in ["casing", "slug"]:
					await say("You start to slide it under the mesh, then stop. Something tells you this belongs in Rosa's hands, not the property cage.")
					return true
				if item in ["union_card", "matchbook"]:
					await _book()
					return true
		"rosa", "lab":
			if verb == "talk":
				await _rosa_talk()
				return true
			if verb == "item":
				if item == "casing":
					await _ballistics()
					return true
				if item == "slug":
					await _slug()
					return true
	return false


func _voss() -> void:
	while true:
		var opts := ["\"I need to book some evidence.\""]
		if flag("ballistics_done"):
			opts.append("\"Walt, about the Delacroix guns...\"")
		opts.append("\"How's it going, Walt?\"")
		opts.append("\"Never mind.\"")
		var i := await choose("Talk to Sgt. Voss:", opts, "Sgt. Voss")
		var pick: String = opts[i] if i >= 0 else ""
		if pick.begins_with("\"I need"):
			await _book()
		elif pick.begins_with("\"Walt, about"):
			await say("\"I've got a 9mm casing from a murder scene this morning, Walt. It came from a Glock in the Delacroix seizure, and you signed that Glock off as destroyed in November.\"", "Gabe")
			await say("Voss's smile stays exactly where it is, and his eyes don't.")
			await say("\"Destroyed. Every gun in that seizure went to the foundry, two hundred of them. I signed the sheet myself. If the lab says different, the lab screwed up.\"", "Sgt. Voss")
			await say("\"Sure, Walt.\"", "Gabe")
			await say("\"I, uh... I've got a delivery coming. Excuse me.\" He takes off his reading glasses. His hand isn't quite steady.", "Sgt. Voss")
			award("voss_questioned")
			return
		elif pick.begins_with("\"How's"):
			await say("\"Can't complain, Gabe! Six more years and it's me, the boat and the Sea of Cortez. Heard you bought a house. Congratulations!\"", "Sgt. Voss")
		else:
			return


func _book() -> void:
	if flag("booked"):
		await say("\"Already got your stuff logged, Gabe. Ruiz, case 95-0314. Chain of custody is airtight.\"", "Sgt. Voss")
		return
	if not (has("union_card") or has("matchbook")):
		await say("\"Nothing to book? Then quit cluttering up my window.\"", "Sgt. Voss")
		return
	set_flag("booked")
	await say("You slide the victim's union card and the Rusty Anchor matchbook under the mesh. Voss logs them, tags them, and has you sign the property sheet.")
	await say("\"Chain of custody, Navarro. That's what I like to see.\"", "Sgt. Voss")
	GameManager.remove_item("union_card")
	GameManager.remove_item("matchbook")
	award("book_evidence")
	await say("You already copied the matchbook's phone number and the union card details into your notebook.")


func _rosa_talk() -> void:
	if flag("ballistics_done"):
		await say("\"Your Glock is a ghost, Navarro. It was destroyed on paper and it's killing people in real life. Go find out who's selling ghosts.\"", "Rosa Delgado")
		if has("slug"):
			await say("\"You have the slug from the autopsy, too? Hand it over and I'll confirm.\"", "Rosa Delgado")
	elif has("casing"):
		await say("\"Is that a casing in your bag, or are you just happy to see me? Hand it over.\"", "Rosa Delgado")
	else:
		await say("\"Bring me something I can put under a microscope, Navarro. Casings, slugs, a gun. Small talk doesn't count.\"", "Rosa Delgado")


func _ballistics() -> void:
	GameManager.remove_item("casing")
	await say("You hand Rosa the bagged 9mm casing. She signs the chain-of-custody label and disappears into the lab.")
	await say("Twenty minutes and two cups of bad coffee later...")
	await say("\"Got a hit. The firing pin and extractor marks match a Glock 17 we test-fired in 1994, in the Delacroix weapons seizure.\"", "Rosa Delgado")
	await say("\"And here's the fun part: according to Property, that Glock was destroyed last November. Melted down. The destruction order is signed by Sgt. W. Voss.\"", "Rosa Delgado")
	await say("Rosa doesn't look toward the property cage. Neither do you.")
	GameManager.add_item("ballistics")
	set_flag("ballistics_done")
	award("ballistics")
	await say_icon("Rosa hands you the ballistics report.", "ballistics")


func _slug() -> void:
	if not flag("ballistics_done"):
		await say("\"Let's start with the casing. Slugs from heads are messy.\"", "Rosa Delgado")
		return
	GameManager.remove_item("slug")
	await say("\"Same lands and grooves. Same gun, Navarro. The casing and the slug were both fired by your ghost Glock.\"", "Rosa Delgado")
	award("slug_match")
