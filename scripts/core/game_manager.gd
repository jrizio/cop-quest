extends Node
## Global game state (autoload): inventory, story flags, score, outfit, and
## save / restore. Everything that must survive a room change lives here.

signal inventory_changed
signal score_changed

const TITLE := "Cop Quest: Dead Reckoning"
const SAVE_SLOTS := 8

## Every scoring event, awarded at most once. MAX_SCORE is their sum.
const POINTS := {
	# Act I — home
	"answer_phone": 2, "note": 1, "dressed": 2, "badge": 2, "keys": 1, "gun": 3, "cuffs": 1,
	"kit": 3, "vest": 2,
	# Act II — Pier 9
	"show_badge": 2, "sign_log": 3, "photos": 5, "gloves_on": 3, "look_body": 1,
	"search_body": 3, "matchbook": 2, "casing": 5, "deduce": 5, "ask_witness": 2,
	# Act III — investigation
	"autopsy": 5, "slug": 3, "book_evidence": 3, "ballistics": 10, "slug_match": 2,
	"voss_questioned": 2, "bronco_run": 5, "maddox_record": 2, "call_elena": 5,
	"bar_badge": 2, "sal_statement": 5, "refuse_drink": 2, "wendell": 5, "warrant": 10,
	# Act IV — Warehouse 7
	"radio_backup": 5, "wear_vest": 5, "identify": 5, "shoot_maddox": 5,
	"cuff_maddox": 5, "miranda": 3, "container": 5,
}

const ITEMS := {
	"notebook": ["notebook", "Your pocket notebook. Use it (Hand) to read your case notes."],
	"keys": ["key ring", "Car keys, house key, and the little key to your gun safe."],
	"badge": ["badge", "Mesa Verde PD, Detective, shield #4471. Twelve years of your life in three ounces of brass."],
	"gun": ["Beretta 92", "Your department-issue 9mm. Fully loaded, safety on, in its holster."],
	"cuffs": ["handcuffs", "Smith & Wesson chain cuffs. The key is on your ring."],
	"gloves": ["latex gloves", "A box of latex gloves from the field kit. Use them (Hand) to put a pair on."],
	"bags": ["evidence bags", "Paper and plastic evidence bags with chain-of-custody labels."],
	"camera": ["camera", "The department's 35mm crime-scene camera, with a fresh roll of film."],
	"flashlight": ["flashlight", "A heavy four-cell Mag-Lite. Useful for seeing, and for other things."],
	"radio": ["radio", "Your handheld radio. Call sign 2-Henry-9."],
	"vest": ["ballistic vest", "Level II body armor. Hot, heavy, and the reason a lot of cops get to retire. Use it (Hand) to put it on."],
	"union_card": ["union card", "Longshore Local 19 membership card: THOMAS RUIZ, steward. Found in the victim's wallet."],
	"matchbook": ["matchbook", "A matchbook from THE RUSTY ANCHOR, Harbor Blvd. Two matches used. A phone number is scrawled inside: 555-0177."],
	"casing": ["9mm casing", "A 9mm Luger shell casing, bagged and tagged. Found on the asphalt by Ruiz's car."],
	"slug": ["9mm slug", "The bullet Dr. Oduya recovered from Tommy Ruiz. Bagged and tagged."],
	"autopsy": ["autopsy report", "Preliminary autopsy: gunshot wound fired from more than three feet away. Manner of death: HOMICIDE."],
	"ballistics": ["ballistics report", "The casing and slug came from a Glock 17 seized in the 1994 Delacroix case. It was logged DESTROYED in Nov. 1994 and signed by Sgt. W. Voss."],
	"warrant": ["search warrant", "A signed search and arrest warrant covering Pacific Rim Freight Warehouse 7 and Kurt Maddox."],
}

var inventory: Array = []
var flags: Dictionary = {}
var awarded: Dictionary = {}
var score: int = 0
var current_item: String = ""
var outfit: String = "gabe_boxers"
var room: String = ""
var last_room: String = "bedroom"
var pending_spawn: String = "Default"
var pending_pos = null   # Vector2 when restoring a save


func max_score() -> int:
	var t := 0
	for v in POINTS.values():
		t += v
	return t


func reset() -> void:
	inventory = []
	flags = {}
	awarded = {}
	score = 0
	current_item = ""
	outfit = "gabe_boxers"
	room = ""
	last_room = "bedroom"
	pending_spawn = "Default"
	pending_pos = null
	inventory_changed.emit()
	score_changed.emit()


# --- inventory ---------------------------------------------------------------
func add_item(id: String) -> void:
	if id == "" or inventory.has(id):
		return
	inventory.append(id)
	inventory_changed.emit()


func remove_item(id: String) -> void:
	inventory.erase(id)
	if current_item == id:
		current_item = ""
	inventory_changed.emit()


func has_item(id: String) -> bool:
	return inventory.has(id)


func item_name(id: String) -> String:
	return ITEMS.get(id, [id, ""])[0]


func item_desc(id: String) -> String:
	return ITEMS.get(id, ["", "It's an item."])[1]


# --- flags & score -------------------------------------------------------------
func set_flag(key: String, value = true) -> void:
	flags[key] = value


func flag(key: String) -> bool:
	return bool(flags.get(key, false))


## Award points once per id. Returns true if newly awarded.
func award(id: String) -> bool:
	if awarded.has(id) or not POINTS.has(id):
		return false
	awarded[id] = true
	score += POINTS[id]
	score_changed.emit()
	Sound.play("points")
	return true


func rank() -> String:
	var pct := float(score) / max_score()
	if pct >= 0.97:
		return "Detective of the Year"
	if pct >= 0.85:
		return "Detective Sergeant material"
	if pct >= 0.7:
		return "Solid Homicide Detective"
	if pct >= 0.5:
		return "Rookie Detective"
	if pct >= 0.3:
		return "Patrol Officer, Probationary"
	return "Meter Maid"


## Case notes = the hint system. Built from what you have and haven't done.
func case_notes() -> String:
	var n := PackedStringArray()
	if not flag("phone_answered"):
		return "Nothing yet. The phone is ringing, Navarro. Answer it."
	n.append("CASE: Thomas Ruiz, 41. Found dead in his car at Pier 9.")
	if not flag("log_signed"):
		n.append("- Get to Pier 9. Badge in hand, and sign the scene log.")
	else:
		if not flag("photos"):
			n.append("- Photograph the scene before touching anything.")
		if not flag("body_searched"):
			n.append("- Search the body. Gloves on first.")
		if not flag("casing_found"):
			n.append("- It's dark under the wagon. A light might help.")
		if not flag("cho_bronco"):
			n.append("- Ask Officer Cho about witnesses.")
	if flag("casing_found"):
		n.append("- 9mm casing at the scene. Ruiz held a revolver. Not a suicide.")
	if flag("body_searched") and not flag("autopsy_done"):
		n.append("- See Dr. Oduya at the County Coroner.")
	if flag("casing_found") and not flag("ballistics_done"):
		n.append("- Get the casing to the crime lab (HQ basement).")
	if flag("ballistics_done"):
		n.append("- The gun was a 'destroyed' evidence Glock. Signed off by Sgt. Voss.")
	if flag("cho_bronco") and not flag("bronco_run"):
		n.append("- Run the black Bronco on the squad room computer.")
	if flag("bronco_run"):
		n.append("- Bronco belongs to Pacific Rim Freight. Driver: Kurt Maddox.")
	if flag("body_searched") and not flag("sal_talked"):
		n.append("- Ruiz had a Rusty Anchor matchbook. Who saw him there?")
	if flag("sal_talked") and not flag("wendell_talked"):
		n.append("- Sal says Maddox threatened Ruiz about 'the box'. Ask around the bar.")
	if flag("wendell_talked"):
		n.append("- Container PRFU-7731, Warehouse 7.")
	if not flag("warrant") and flag("ballistics_done") and flag("bronco_run") and flag("sal_talked"):
		n.append("- Enough for a warrant. See Lt. Kessler.")
	if flag("warrant") and not flag("case_closed"):
		n.append("- Warehouse 7, tonight. Vest. Backup. Procedure.")
	if not flag("called_elena"):
		n.append("- Elena: dinner at seven. Maybe call her?")
	return "\n".join(n)


# --- save / restore -------------------------------------------------------------
func _slot_path(slot: int) -> String:
	return "user://save_%d.json" % slot


func save_game(slot: int, player_pos: Vector2) -> bool:
	var d := {
		"version": 1,
		"label": "%s - %d pts - %s" % [room_label(room), score, Time.get_datetime_string_from_system(false, true)],
		"inventory": inventory, "flags": flags, "awarded": awarded, "score": score,
		"current_item": current_item, "outfit": outfit, "room": room, "last_room": last_room,
		"px": player_pos.x, "py": player_pos.y,
	}
	var f := FileAccess.open(_slot_path(slot), FileAccess.WRITE)
	if f == null:
		return false
	f.store_string(JSON.stringify(d))
	return true


func slot_label(slot: int) -> String:
	if not FileAccess.file_exists(_slot_path(slot)):
		return ""
	var d = JSON.parse_string(FileAccess.get_file_as_string(_slot_path(slot)))
	return String(d.get("label", "Saved game")) if d is Dictionary else ""


func load_game(slot: int) -> bool:
	if not FileAccess.file_exists(_slot_path(slot)):
		return false
	var d = JSON.parse_string(FileAccess.get_file_as_string(_slot_path(slot)))
	if not d is Dictionary:
		return false
	inventory = d.get("inventory", [])
	flags = d.get("flags", {})
	awarded = d.get("awarded", {})
	score = int(d.get("score", 0))
	current_item = String(d.get("current_item", ""))
	outfit = String(d.get("outfit", "gabe"))
	last_room = String(d.get("last_room", "bedroom"))
	var r := String(d.get("room", "bedroom"))
	pending_pos = Vector2(float(d.get("px", 160)), float(d.get("py", 180)))
	inventory_changed.emit()
	score_changed.emit()
	SceneManager.goto_room(r, "Default", false)
	return true


func room_label(id: String) -> String:
	return {
		"bedroom": "Home", "driveway": "Driveway", "map": "City Map", "marina": "Pier 9",
		"squad": "Homicide", "basement": "Property & Lab", "coroner": "Coroner", "bar": "Rusty Anchor",
		"ware_ext": "Warehouse 7", "ware_int": "Warehouse 7", "ending": "Epilogue",
	}.get(id, id)
