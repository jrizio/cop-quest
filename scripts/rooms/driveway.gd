extends Room
## Act I: the driveway. The unmarked car, its trunk (field kit + vest).


func _setup() -> void:
	bg = "driveway"
	walk_poly = PackedVector2Array([Vector2(0, 146), Vector2(165, 146), Vector2(168, 176), Vector2(305, 176), Vector2(318, 168), Vector2(318, 190), Vector2(0, 190)])
	persp = Vector4(146, 190, 0.62, 0.8)
	spawns = {"Default": [Vector2(226, 182), Actor.ROW_DOWN], "FromHouse": [Vector2(34, 152), Actor.ROW_DOWN]}
	desc = "1418 Alder Street. A three-bedroom ranch, a lawn that needs mowing, and a thirty-year mortgage. Your unmarked car is parked in the driveway."


func _build() -> void:
	add_exit("door", "Front door", Rect2(20, 86, 26, 54), Vector2(33, 150), "bedroom", "FromDriveway", "Your front door. The paint is fresh, and so are the scratches you put in it carrying the couch.")
	add_exit("car", "Your car", Rect2(180, 116, 86, 50), Vector2(226, 182), "map", "Default", "Your unmarked '92 Caprice. Dark blue, black walls, and a spotlight. Every kid in town knows it's a cop car.")
	add_hotspot("trunk", "Trunk", Rect2(266, 124, 38, 36), Vector2(288, 182), "The trunk. Your field kit and your vest live in there.")
	add_hotspot("garage", "Garage", Rect2(80, 82, 66, 58), Vector2(112, 150), "The garage is full of boxes too. You'll park in it sometime around 1998.")
	add_hotspot("house", "House", Rect2(0, 22, 170, 118), null, "Your new house. Stucco, a red tile roof, and a palm tree for good measure. Elena loves it.")
	add_hotspot("palm", "Palm tree", Rect2(286, 8, 22, 142), null, "A palm tree. It came with the house, along with a family of very loud parrots.")
	if flag("trunk_open"):
		add_prop("driveway_trunk")


func exit_check(id: String) -> bool:
	if id == "car":
		if not has("keys"):
			await say("The car is locked, and your keys are still inside the house.")
			return false
		if flag("trunk_open"):
			_close_trunk()
	return true


func interact(id: String, verb: String, _item: String) -> bool:
	if id == "trunk" and verb == "hand":
		if not has("keys"):
			await say("The trunk is locked. You need your keys.")
		elif not flag("trunk_open"):
			set_flag("trunk_open")
			if not props.has("driveway_trunk"):
				add_prop("driveway_trunk")
			props["driveway_trunk"].visible = true
			Sound.play("door")
			if not flag("kit_taken"):
				await say("You pop the trunk. Inside: your crime-scene field kit, and your ballistic vest.")
			else:
				await say("You open the trunk.")
		elif not flag("kit_taken"):
			set_flag("kit_taken")
			for it in ["gloves", "bags", "camera", "flashlight", "radio"]:
				GameManager.add_item(it)
			await say_icon("You grab the field kit: latex gloves, evidence bags, the camera, a flashlight, and your radio.", "camera")
			award("kit")
		elif not flag("vest_taken"):
			set_flag("vest_taken")
			await give("vest", "You take the ballistic vest. It's heavy, and you hope you won't need it.")
			award("vest")
		else:
			_close_trunk()
			await say("You close the trunk.")
		return true
	return false


func _close_trunk() -> void:
	set_flag("trunk_open", false)
	if props.has("driveway_trunk"):
		props["driveway_trunk"].visible = false
