extends Room
## Act IV: outside Warehouse 7, Pier 12, after dark.


func _setup() -> void:
	bg = "ware_ext"
	walk_poly = PackedVector2Array([Vector2(0, 146), Vector2(230, 146), Vector2(230, 184), Vector2(320, 184), Vector2(320, 199), Vector2(0, 199)])
	persp = Vector4(146, 199, 0.72, 0.96)
	spawns = {"Default": [Vector2(40, 178), Actor.ROW_RIGHT], "FromInside": [Vector2(102, 156), Actor.ROW_DOWN]}
	desc = "Pier 12, after dark. Sodium lights, wet asphalt, and the clank of the container cranes. Pacific Rim Freight's Warehouse 7 looms over the lot."


func _build() -> void:
	if flag("backup"):
		add_npc("pruitt", "Det. Pruitt", "pruitt", Vector2(62, 182), Actor.ROW_RIGHT, Vector2(84, 182), "Lou Pruitt, shotgun held low, chewing gum like it owes him money.")
	add_exit("door", "Side door", Rect2(88, 90, 29, 52), Vector2(102, 152), "ware_int", "Default", "A steel side door. There's light under it, and you can hear voices.")
	add_hotspot("rollup", "Loading door", Rect2(148, 58, 104, 84), Vector2(198, 152), "A roll-up loading door, chained shut from the inside.")
	add_hotspot("bronco", "Black Bronco", Rect2(232, 110, 88, 70), Vector2(222, 188), "A black '93 Ford Bronco with a Pacific Rim Freight fleet tag: 3JKD771. Maddox's.")
	add_hotspot("sign", "Sign", Rect2(132, 28, 136, 22), null, "PACIFIC RIM FREIGHT - WAREHOUSE 7.")
	add_exit("car", "Your car", Rect2(0, 150, 14, 50), Vector2(10, 184), "map", "Default", "Your car, parked in the shadows.")


func enter() -> void:
	if not flag("ware_visited"):
		set_flag("ware_visited")
		await run_busy(func() -> void:
			await say("Warehouse 7, Pier 12. 6:20 P.M. Maddox's black Bronco is parked by the loading door. There's light under the side door, and two men are talking inside.")
			await say("You're alone out here. For now."))


func exit_check(id: String) -> bool:
	if id == "door":
		if flag("case_closed"):
			await say("It's over in there. Let the crime-scene unit do its job.")
			return false
		await say("You check your weapon, take a breath, and ease the side door open." if has("gun") else "You take a breath and ease the side door open.")
	return true


func interact(id: String, verb: String, item: String) -> bool:
	match id:
		"bronco":
			if verb == "hand":
				await say("The hood is still warm and the doors are locked. Through the window you can see an olive-drab canvas work jacket on the passenger seat.")
				return true
			if verb == "item" and item == "flashlight":
				await say("Your flashlight finds a dark smear on the driver's door handle. You'll want the lab to swab that, after.")
				return true
		"rollup":
			if verb == "hand":
				await say("It's chained shut from the inside. The side door is your way in.")
				return true
		"pruitt":
			if verb == "talk":
				await say("\"Ready when you are, kid. You go in first and announce, and I'll be right on your six.\"", "Det. Pruitt")
				return true
		"door":
			if verb == "item" and item == "warrant":
				await say("The warrant covers this building and everything in it. You're legally in the clear.")
				return true
	return false


func use_self_room(id: String) -> bool:
	if id == "radio":
		if flag("backup"):
			Sound.play("radio")
			await say("\"2-Henry-12 is on scene with you, 2-Henry-9.\" Pruitt waves at you from ten feet away.")
			return true
		Sound.play("radio")
		await say("\"2-Henry-9, Dispatch. I'm at Pacific Rim Freight, Warehouse 7, Pier 12, serving a felony warrant. Possible armed suspects. Requesting backup.\"", "Gabe")
		await say("\"Copy, 2-Henry-9. 2-Henry-12 is responding, two minutes out.\"", "Dispatch")
		set_flag("backup")
		award("radio_backup")
		await wait(1.0)
		var p := add_npc("pruitt", "Det. Pruitt", "pruitt", Vector2(-10, 184), Actor.ROW_RIGHT, Vector2(84, 182), "Lou Pruitt, shotgun held low.")
		await p.walk_to_async(Vector2(62, 182))
		await say("Headlights off, Lou Pruitt rolls into the lot and climbs out with the shotgun. \"You didn't go in without me. I'm touched.\"", "Det. Pruitt")
		return true
	return false
