extends Room
## Act III: MVPD Homicide squad room. Kessler, Pruitt, the computer, the phone.


func _setup() -> void:
	bg = "squad"
	walk_poly = PackedVector2Array([Vector2(0, 152), Vector2(50, 121), Vector2(290, 121), Vector2(320, 142), Vector2(320, 199), Vector2(0, 199)])
	blockers = [Rect2(36, 140, 132, 42), Rect2(174, 126, 92, 24)]
	persp = Vector4(121, 199, 0.74, 1.02)
	spawns = {"Default": [Vector2(306, 180), Actor.ROW_LEFT], "FromStairs": [Vector2(24, 148), Actor.ROW_RIGHT]}
	desc = "Homicide, third floor. Green-gray metal desks, venetian blinds, and a coffee maker older than Officer Cho. The squad board has your name on it in grease pencil: RUIZ - NAVARRO."


func _build() -> void:
	add_prop("squad_desk_gabe", 160)
	add_prop("squad_desk_pruitt", 140)
	add_npc("pruitt", "Det. Pruitt", "pruitt", Vector2(226, 125), Actor.ROW_DOWN, Vector2(220, 162), "Det. Lou Pruitt, your partner. Thirty-one years on the job, eight months from his pension, and still the best interrogator in the building.")
	add_npc("kessler", "Lt. Kessler", "kessler", Vector2(284, 140), Actor.ROW_LEFT, Vector2(268, 164), "Lt. Ruth Kessler, commander of Homicide. She's sharp, she's fair, and she has no patience at all.")
	add_hotspot("computer", "Computer", Rect2(66, 108, 38, 34), Vector2(86, 192), "Your terminal: a beige monster wired into DMV, NCIC and the department records system. It takes three minutes to boot, and the screen is green.")
	add_hotspot("phone", "Desk phone", Rect2(116, 134, 18, 10), Vector2(126, 192), "Your desk phone. Line 3 still doesn't work.")
	add_hotspot("desk", "Your desk", Rect2(36, 138, 132, 44), Vector2(100, 192), "Your desk. NAVARRO, says the nameplate. The in-box is taller than the out-box. That never changes.")
	add_hotspot("windows", "Windows", Rect2(60, 32, 120, 48), null, "Downtown Mesa Verde through dusty blinds. You can see the harbor cranes from here.")
	add_hotspot("board", "Squad board", Rect2(188, 36, 42, 34), Vector2(208, 158), "Open cases. RUIZ, T. is at the top, in fresh grease pencil, with NAVARRO next to it.")
	add_hotspot("ltdoor", "Kessler's office", Rect2(238, 44, 44, 74), Vector2(258, 158), "LT. KESSLER. Her door is open, which means she's out here.")
	add_hotspot("coffee", "Coffee maker", Rect2(292, 46, 22, 92), Vector2(296, 156), "A Mr. Coffee that's been on since the Carter administration.")
	add_exit("stairs", "Stairwell to B1", Rect2(12, 48, 28, 92), Vector2(24, 148), "basement", "Default", "The stairwell. B1 is Property & Evidence and the Crime Lab.")
	add_exit("hall", "Hallway to the parking lot", Rect2(298, 146, 22, 54), Vector2(310, 182), "map", "Default", "The hallway to the elevator and the parking lot, where your car is.")


func enter() -> void:
	if not flag("squad_visited"):
		set_flag("squad_visited")
		await run_busy(func() -> void: await say("Lou Pruitt is at his desk, and Lt. Kessler is out of her office. That's never a good sign."))


func interact(id: String, verb: String, item: String) -> bool:
	match id:
		"kessler":
			if verb == "talk" or (verb == "item" and item in ["ballistics", "autopsy", "casing", "slug"]):
				await _kessler()
				return true
		"pruitt":
			if verb == "talk":
				await _pruitt()
				return true
		"computer":
			if verb == "hand":
				await _computer()
				return true
		"phone":
			if verb == "hand" or verb == "talk":
				await _phone()
				return true
		"coffee":
			if verb == "hand":
				await say("You pour a cup. It tastes exactly like it looks. You drink it anyway, because you're a cop.")
				return true
	return false


func _ready_for_warrant() -> bool:
	return flag("ballistics_done") and flag("bronco_run") and flag("sal_talked")


func _kessler() -> void:
	if flag("warrant"):
		await say("\"You have your warrant. Warehouse 7. Vest on, and radio Pruitt when you're on scene. Don't make me write a letter to Elena.\"", "Lt. Kessler")
		return
	if _ready_for_warrant():
		await say("\"Walk me through it.\"", "Lt. Kessler")
		await say("\"Tommy Ruiz didn't kill himself. The shot came from three feet away, from a 9mm, and the casing matches a Glock that was supposed to be destroyed in the Delacroix case. Walt Voss signed the destruction sheet.\"", "Gabe")
		await say("\"A black Bronco left the scene at two A.M. It's a Pacific Rim Freight fleet vehicle, driven by Kurt Maddox. Maddox threatened Ruiz at the Rusty Anchor last night over 'the box.'" + ("\n\nAnd a witness says Ruiz found crates of guns with MVPD evidence tags in Container 7731, Warehouse 7.\"" if flag("wendell_talked") else "\""), "Gabe")
		await say("Kessler is quiet for a long moment.")
		await say("\"A dirty cop in my building, and a man dead over it. All right. Judge Halvorsen owes me a favor.\"", "Lt. Kessler")
		await give("warrant", "An hour later, Kessler drops a signed search and arrest warrant on your desk: Pacific Rim Freight, Warehouse 7, and Kurt Maddox.")
		award("warrant")
		set_flag("warrant")
		await say("\"Internal Affairs will deal with Voss. Pruitt rides backup. Radio him when you're on scene and do NOT go in alone. Vest on. By the book, Navarro.\"", "Lt. Kessler")
		await say("By the time the paperwork clears, the sun has gone down behind the harbor cranes. It's 6:05 P.M.\n\nDinner is at seven.")
		return
	await say("\"What have you got, Navarro?\"", "Lt. Kessler")
	var gaps := PackedStringArray()
	if not flag("casing_found"):
		gaps.append("\"So far, you've got a dead man with a gun in his hand. Go back to Pier 9 and work the scene.\"")
	elif not flag("ballistics_done"):
		gaps.append("\"A 9mm casing at a revolver suicide. Good. Get it to Rosa in the lab. I want to know where that gun came from.\"")
	if flag("cho_bronco") and not flag("bronco_run"):
		gaps.append("\"A black Bronco at two A.M.? Run it. You have a computer.\"")
	elif not flag("cho_bronco") and flag("log_signed"):
		gaps.append("\"Did anybody see anything at the marina? Ask the uniform who held the scene.\"")
	if not flag("sal_talked"):
		gaps.append("\"Where was Ruiz before he died, and who did he see? Find someone who'll put a suspect with him.\"")
	if gaps.is_empty():
		gaps.append("\"Keep going. Bring me something I can take to a judge.\"")
	await say("\n\n".join(gaps), "Lt. Kessler")


func _pruitt() -> void:
	while true:
		var i := await choose("Talk to Lou Pruitt:", ["\"The Ruiz case...\"", "\"How long till you retire?\"", "\"Anything on Walt Voss?\"", "\"Never mind.\""], "Det. Pruitt")
		match i:
			0:
				if not flag("casing_found"):
					await say("\"A suicide that Kessler doesn't like? Look at the ground, kid. Guns leave things behind.\"", "Det. Pruitt")
				elif not flag("ballistics_done"):
					await say("\"Get that brass down to Rosa. If the gun's been fired before, she'll know.\"", "Det. Pruitt")
				elif not flag("sal_talked"):
					await say("\"Dockworkers drink near the docks, and bartenders hear everything. But they don't talk to anybody who isn't showing a badge.\"", "Det. Pruitt")
				elif not flag("warrant"):
					await say("\"Sounds like you've got enough for Kessler. Go make her day.\"", "Det. Pruitt")
				else:
					await say("\"Radio me when you get to Warehouse 7. I'll be five minutes behind you. Don't you dare go in without me.\"", "Det. Pruitt")
			1: await say("\"Eight months, eleven days. Not that I'm counting. Bonnie wants a boat. I want a nap.\"", "Det. Pruitt")
			2:
				if flag("ballistics_done"):
					await say("\"Voss? He's run Property since '89. Nice house in Bay Hills for a sergeant. A boat, too.\" Pruitt raises an eyebrow. \"I always wondered.\"", "Det. Pruitt")
				else:
					await say("\"Walt Voss? Runs the property cage downstairs. He's a good guy, brings donuts on Fridays. Why?\"", "Det. Pruitt")
			_: return


func _computer() -> void:
	Sound.play("beep")
	while true:
		var opts := ["RECORDS: RUIZ, THOMAS"]
		var keys := ["ruiz"]
		if flag("cho_bronco"):
			opts.append("DMV: BLACK FORD BRONCO, HARBOR DIST.")
			keys.append("bronco")
		if flag("bronco_run") or flag("sal_talked"):
			opts.append("RECORDS: MADDOX, KURT")
			keys.append("maddox")
		if flag("ballistics_done"):
			opts.append("PERSONNEL: VOSS, WALTER (SGT.)")
			keys.append("voss")
		opts.append("LOG OFF")
		keys.append("off")
		var i := await choose("MVPD RECORDS SYSTEM v2.1\nENTER QUERY:", opts, "TERMINAL 3-114")
		if i < 0 or keys[i] == "off":
			return
		Sound.play("beep")
		match keys[i]:
			"ruiz":
				await say("RUIZ, THOMAS A.  DOB 02/11/53\n1022 CANNERY ROW #4, MESA VERDE\nEMPLOYER: PACIFIC RIM FREIGHT (LONGSHORE LOCAL 19, STEWARD)\nCRIMINAL HISTORY: NONE\nVEHICLE: 1986 FORD LTD WAGON, MAROON", "QUERY RESULT")
			"bronco":
				await say("DMV - 14 MATCHES, BLACK FORD BRONCO, HARBOR DISTRICT...\nFILTERING BY COMMERCIAL REGISTRATION...\n\n1993 FORD BRONCO, BLACK, LIC 3JKD771\nREG: PACIFIC RIM FREIGHT CO., PIER 12\nFLEET ASSIGNMENT: MADDOX, KURT R. (FOREMAN)", "QUERY RESULT")
				set_flag("bronco_run")
				award("bronco_run")
				await say("Pacific Rim Freight, Tommy Ruiz's employer. And the Bronco is assigned to his foreman.")
			"maddox":
				await say("MADDOX, KURT RAYMOND  DOB 07/30/58\nFOREMAN, PACIFIC RIM FREIGHT, WAREHOUSE 7\nPRIORS: ASSAULT W/ DEADLY WEAPON (1984), ASSAULT (1989), WEAPONS POSS. (1990, DISMISSED - EVIDENCE MISHANDLED)\nCAUTION: KNOWN TO CARRY", "QUERY RESULT")
				award("maddox_record")
				await say("A 1990 weapons charge, dismissed because the evidence was mishandled. You wonder who handled it.")
			"voss":
				await say("VOSS, WALTER J.  SGT.  BADGE #2209\nASSIGNMENT: PROPERTY & EVIDENCE (SINCE 1989)\nIA COMPLAINTS: 2 (1991, 1993) - BOTH 'UNFOUNDED'\nSUPERVISOR SIGNOFFS: DESTRUCTION ORDERS 1990-1995 (412)", "QUERY RESULT")


func _phone() -> void:
	if flag("called_elena"):
		await say("You already talked to Elena. Don't push your luck. Just be home by seven.")
		return
	var i := await choose("Make a call?", ["Call Elena at Mesa Verde General.", "Hang up."], "Desk Phone")
	if i != 0:
		return
	set_flag("called_elena")
	await say("\"Emergency, Navarro.\"", "Elena")
	await say("\"It's me.\"", "Gabe")
	await say("\"Gabe! Did you find the gun safe key? I left you a note.\"", "Elena")
	await say("\"I found it. I caught a case, El. A body at the marina. It's a bad one.\"", "Gabe")
	await say("Silence on the line. Then: \"Seven o'clock, Gabe. My mother. You promised.\"", "Elena")
	var c := await choose("What do you tell her?", ["\"I'll be there. I promise.\"", "\"I can't promise anything.\""], "Elena")
	if c == 0:
		set_flag("promised_elena")
		await say("\"I'm going to hold you to that, Detective. Te quiero. Be careful.\"", "Elena")
		award("call_elena")
	else:
		await say("\"...I know. I know you can't.\" A long breath. \"Just be careful, okay?\"", "Elena")
