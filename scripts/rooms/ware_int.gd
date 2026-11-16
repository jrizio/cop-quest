extends Room
## Act IV climax: inside Warehouse 7. Maddox, Voss and Container 7731.

const DRAW_TIME := 4.5

var _showdown := false
var _time_left := 0.0
var _resolved := false
var _overlay: Node2D


func _setup() -> void:
	bg = "ware_int"
	walk_poly = PackedVector2Array([Vector2(0, 126), Vector2(194, 126), Vector2(194, 146), Vector2(320, 146), Vector2(320, 199), Vector2(0, 199)])
	persp = Vector4(126, 199, 0.74, 1.0)
	spawns = {"Default": [Vector2(36, 152), Actor.ROW_RIGHT]}
	desc = "Warehouse 7. Steel racks to the rafters, and shipping container PRFU-7731 standing open at the far end."


func _build() -> void:
	add_npc("maddox", "Kurt Maddox", "maddox", Vector2(206, 156), Actor.ROW_LEFT, Vector2(176, 166), "Kurt Maddox: six-foot-three, blond buzz cut, and an olive-drab work jacket with a bulge under the left arm.")
	add_npc("voss", "Sgt. Voss", "voss", Vector2(262, 150), Actor.ROW_LEFT, Vector2(236, 162), "Sgt. Walt Voss, in uniform, holding a claw hammer and a crate lid.")
	if flag("backup"):
		add_npc("pruitt", "Det. Pruitt", "pruitt", Vector2(22, 168), Actor.ROW_RIGHT, Vector2(44, 170), "Lou Pruitt, right where he said he'd be.")
	add_hotspot("container", "Container 7731", Rect2(180, 40, 138, 104), Vector2(186, 160), "Shipping container PRFU-7731. Crates stenciled PARTS, stacked to the roof. Some of them have little yellow tags.")
	add_hotspot("racks", "Pallet racks", Rect2(30, 20, 166, 104), null, "Pallet racks full of boxes, all legitimately boring.")
	add_exit("door", "Side door", Rect2(4, 66, 28, 76), Vector2(30, 152), "ware_ext", "FromInside", "The side door you came in through.")
	_overlay = Node2D.new()
	_overlay.z_index = 5
	add_child(_overlay)
	_overlay.draw.connect(_draw_overlay)


func can_save() -> bool:
	return super.can_save() and _resolved


func enter() -> void:
	UI.busy += 1
	if flag("vest_worn"):
		award("wear_vest")
	await say("Inside, the warehouse smells like diesel and salt water. Kurt Maddox and Sgt. Walt Voss are nailing the lid onto a crate beside an open shipping container.\n\nThey haven't seen you yet.")
	var i := await choose("What do you do?", ["\"POLICE! Search warrant! Let me see your hands!\"", "Draw your gun and open fire.", "\"Evening, gentlemen. Working late?\""], "Warehouse 7")
	if i == 1:
		UI.busy = 0
		if not has("gun"):
			die("You reach for your Beretta. It's still in the gun safe at home, next to the moving boxes.\n\nMaddox doesn't have that problem.\n\nAlways carry your sidearm on duty.", "End of Watch")
		else:
			Sound.play("gun")
			die("You open fire on two men who haven't drawn a weapon. Maddox goes down. Voss lives to testify at your trial.\n\nYou never identified yourself. The District Attorney charges you with manslaughter.\n\nA police officer announces himself first.")
		return
	if i == 2:
		UI.busy = 0
		Sound.play("gun")
		die("Maddox doesn't answer. He just draws and fires.\n\nYou walked up on an armed murder suspect like you were asking directions. Cops die that way every year.", "End of Watch")
		return
	award("identify")
	npcs["maddox"].face(Actor.ROW_LEFT)
	npcs["voss"].face(Actor.ROW_LEFT)
	await say("Voss drops the hammer and throws his hands up. \"Gabe! Don't shoot! It's not what it looks like!\"", "Sgt. Voss")
	await say("Maddox doesn't drop anything. \"Like hell it isn't.\" His right hand slides under his jacket.", "Kurt Maddox")
	if not has("gun"):
		UI.busy = 0
		Sound.play("gun")
		die("You reach for your Beretta, and remember it's locked in the gun safe at home.\n\nMaddox doesn't miss.\n\nAlways carry your sidearm on duty.", "End of Watch")
		return
	# The draw: the player has a few seconds to use the gun on Maddox.
	hotspot("maddox").approach = null
	GameManager.current_item = "gun"
	UI.set_verb("item")
	_time_left = DRAW_TIME
	_showdown = true
	UI.busy = 0


func _process(delta: float) -> void:
	if _overlay:
		_overlay.queue_redraw()
	if not _showdown or dead:
		return
	if UI.is_blocking():
		return
	_time_left -= delta
	if _time_left <= 0.0:
		_showdown = false
		_too_slow()


func _draw_overlay() -> void:
	if _showdown:
		var blink := int(_time_left * 6) % 2 == 0
		_overlay.draw_rect(Rect2(60, 4, 200, 14), Color(0.5, 0, 0, 0.75))
		PixelFont.draw_centered(_overlay, 160, 7, "MADDOX IS DRAWING!  Use your gun on him!" if blink else "MADDOX IS DRAWING!", Color(1, 1, 0.6))
		_overlay.draw_rect(Rect2(60, 18, 200 * (_time_left / DRAW_TIME), 2), Color(1, 0.3, 0.2))


func interact(id: String, verb: String, item: String) -> bool:
	if _showdown:
		if id == "maddox" and verb == "item" and item == "gun":
			_showdown = false
			await _fire()
			return true
		return true   # nothing else matters right now
	match id:
		"maddox":
			if not flag("maddox_down"):
				return false
			if verb == "item" and item == "cuffs":
				await _cuff()
				return true
			if verb == "talk":
				if not flag("maddox_cuffed"):
					await say("Cuff him first. Talk later.")
				elif not flag("miranda"):
					set_flag("miranda")
					await say("\"Kurt Maddox, you're under arrest for the murder of Thomas Ruiz. You have the right to remain silent. Anything you say can and will be used against you in a court of law. You have the right to an attorney...\"", "Gabe")
					await say("Maddox spits on the concrete. \"Tommy should've kept his mouth shut.\"", "Kurt Maddox")
					await say("\"Thanks, Kurt. That one's going in the report.\"", "Gabe")
					award("miranda")
					await _check_done()
				else:
					await say("Maddox stares at the floor. He's out of things to say.")
				return true
			if verb == "item" and item == "gun":
				await say("He's down and disarmed. Holster your weapon, Detective. The shooting is over.")
				return true
		"voss":
			if verb == "talk":
				await say("\"I want my union rep,\" Voss mumbles into the concrete. \"And my lawyer. And... God, Gabe. I'm sorry.\"", "Sgt. Voss")
				return true
			if verb == "item" and item == "cuffs":
				await say("Pruitt already has Voss cuffed. Cuff Maddox.")
				return true
		"container":
			if verb == "hand" or verb == "look":
				if not flag("maddox_cuffed") and verb == "hand":
					await say("Secure your suspect first.")
					return true
				if flag("container_checked"):
					await say("Glocks, Berettas, revolvers, shotguns. Two hundred 'destroyed' evidence guns, on their way to Manila.")
					return true
				if verb == "look":
					return false
				set_flag("container_checked")
				await say("You pry open a crate stenciled MACHINE PARTS with Voss's claw hammer.")
				await say("Glocks, Berettas, revolvers, sawed-off shotguns, packed in straw. Every one of them still has a yellow MVPD evidence tag on the trigger guard. DELACROIX. 94-1187. DESTROYED.")
				award("container")
				await _check_done()
				return true
	return false


func exit_check(id: String) -> bool:
	if id == "door" and not flag("case_closed"):
		await say("You're not leaving with two suspects on the floor.")
		return false
	return true


func _fire() -> void:
	UI.busy += 1
	Sound.play("gun")
	_resolved = true
	await say("You draw and fire once. The shot is deafening under the steel roof.\n\nMaddox spins, his pistol skittering away across the concrete, and goes down clutching his shoulder.")
	award("shoot_maddox")
	_maddox_falls()
	if not flag("backup"):
		Sound.play("gun")
		die("You're covering Maddox when Voss lunges for the fallen pistol. With no partner at the door, nobody is covering Voss.\n\nNever go in alone. Always radio for backup.", "End of Watch")
		return
	await say("Voss looks at the pistol on the floor. Then he looks at the door, where Lou Pruitt is leveling a shotgun at him.", "Sgt. Voss")
	await say("\"Don't even think about it, Walt. Face down. Hands behind your head.\"", "Det. Pruitt")
	await _voss_surrenders()
	UI.busy = maxi(0, UI.busy - 1)


func _too_slow() -> void:
	UI.busy += 1
	_resolved = true
	Sound.play("gun")
	if not flag("vest_worn"):
		die("Maddox fires twice. Both rounds hit you square in the chest.\n\nYour ballistic vest is " + ("in your trunk." if not has("vest") else "in your inventory, which isn't where it does any good.") + "\n\nWear your vest. Every time.", "End of Watch")
		return
	await say("Maddox fires. The round slams into your vest like a sledgehammer and puts you on the floor.")
	if not flag("backup"):
		die("By the time you can breathe again, Maddox and Voss are gone, along with the Bronco and every piece of evidence in the building.\n\nNever go in alone. Always radio for backup.", "Case Closed - Unsolved")
		return
	Sound.play("gun")
	await say("BOOM. Lou Pruitt's shotgun answers from the doorway. Maddox drops his pistol and goes down, howling and clutching his leg.")
	_maddox_falls()
	await say("\"You okay, kid?\" Pruitt doesn't take his eyes off Voss. \"Walt. Face down. NOW.\"", "Det. Pruitt")
	await _voss_surrenders()
	await say("You get up slowly. There's a flattened slug in your vest, right over your heart. Next time, draw faster.")
	UI.busy = maxi(0, UI.busy - 1)


func _maddox_falls() -> void:
	set_flag("maddox_down")
	var m: Actor = npcs["maddox"]
	m.rotation = -PI / 2.0
	m.position = Vector2(222, 166)
	var h := hotspot("maddox")
	h.erase("actor")
	h.rect = Rect2(150, 154, 76, 18)
	h.approach = Vector2(160, 178)
	GameManager.current_item = "cuffs" if has("cuffs") else ""
	UI.set_verb("item" if has("cuffs") else "walk")


func _voss_surrenders() -> void:
	var v: Actor = npcs["voss"]
	v.face(Actor.ROW_DOWN)
	await say("Voss sinks to his knees. Pruitt cuffs him, and reads him his rights in a voice like a funeral.")
	var p: Actor = npcs.get("pruitt")
	if p:
		await p.walk_to_async(Vector2(236, 166))
	set_flag("voss_cuffed")


func _cuff() -> void:
	if flag("maddox_cuffed"):
		await say("He's already cuffed.")
		return
	if not has("cuffs"):
		await say("You reach for your handcuffs. They're still in the gun safe at home. Pruitt tosses you his spare pair without a word, which somehow makes it worse.")
	Sound.play("cuffs")
	set_flag("maddox_cuffed")
	await say("You roll Maddox onto his stomach and cuff him, then press his own canvas jacket against the shoulder wound until the paramedics arrive.")
	award("cuff_maddox")
	await _check_done()


func _check_done() -> void:
	if flag("maddox_cuffed") and flag("miranda") and flag("container_checked") and not flag("case_closed"):
		set_flag("case_closed")
		await say("Sirens wail across Pier 12, a lot of them. Lt. Kessler arrives with half of Internal Affairs behind her and stops in front of the container for a long time.")
		await say("\"Good work, Navarro. By the book.\" She checks her watch. \"Now go home. Don't you have somewhere to be at seven?\"", "Lt. Kessler")
		SceneManager.goto_room("ending")
