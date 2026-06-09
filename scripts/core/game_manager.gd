extends Node
## Global game state (autoload singleton).
## Holds the things that must survive a scene change: inventory, story flags,
## the current shift state, and which spawn point the next scene should use.

signal inventory_changed(items: Array)

## Spawn marker name the next loaded scene should place the actor at.
## Set by SceneManager.goto() before the scene swap; read in each scene's _ready().
var pending_spawn: String = "Default"

## Items the officer is carrying, as string ids (e.g. "car_keys", "badge").
var inventory: Array = []

## Arbitrary boolean/story flags for future objectives and procedures.
var flags: Dictionary = {}

## Whether the officer is currently on duty (clocked in at the duty desk).
var shift_started: bool = false


func add_item(id: String) -> void:
	if id == "" or inventory.has(id):
		return
	inventory.append(id)
	inventory_changed.emit(inventory)


func has_item(id: String) -> bool:
	return inventory.has(id)


func set_flag(key: String, value: bool = true) -> void:
	flags[key] = value


func has_flag(key: String) -> bool:
	return flags.get(key, false)
