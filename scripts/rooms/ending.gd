extends Room
## Epilogue: home, 7:02 P.M. Then the final score.


func _setup() -> void:
	bg = "bedroom"
	walk_poly = PackedVector2Array([Vector2(90, 199), Vector2(82, 186), Vector2(64, 160), Vector2(46, 157), Vector2(46, 150), Vector2(82, 137), Vector2(128, 131), Vector2(194, 133), Vector2(194, 147), Vector2(318, 168), Vector2(318, 199)])
	persp = Vector4(130, 199, 0.72, 1.05)
	spawns = {"Default": [Vector2(102, 142), Actor.ROW_DOWN]}
	desc = "Home."


func _build() -> void:
	dress("gabe")
	if flag("promised_elena"):
		add_npc("elena", "Elena", "elena", Vector2(170, 172), Actor.ROW_LEFT)


func can_save() -> bool:
	return false


func enter() -> void:
	UI.busy += 1
	if flag("promised_elena"):
		await player.walk_to_async(Vector2(140, 170))
		player.face(Actor.ROW_RIGHT)
		await say("7:02 P.M. You come up the stairs still smelling like cordite and harbor water. Elena is waiting in the bedroom, and somebody has unpacked exactly one box: the one with the good plates.")
		await say("\"Two minutes late, Detective.\" She looks you over: the scuffed shoes, the bruise coming up on your chest. Her face softens. \"Mama's downstairs. She made pozole. Are you okay?\"", "Elena")
		await say("\"I'm okay. A good man died this morning, El. Tonight the people who killed him are in jail.\"", "Gabe")
		await say("She takes your hand. \"Then come eat. You kept your promise.\"", "Elena")
	else:
		await player.walk_to_async(Vector2(140, 170))
		await say("9:40 P.M. The house is dark. A plate wrapped in foil is waiting in the fridge, with a note in Elena's handwriting:")
		await say("\"Mama says hello. She also says a lot of other things. We'll talk tomorrow. I'm glad you're safe. - E.\"", "A Note from Elena")
		await say("You eat cold pozole standing up, surrounded by boxes. Some nights the job wins.")
	await say("EPILOGUE\n\nKurt Maddox is charged with the murder of Thomas Ruiz. The 9mm Glock is recovered from the Bronco's spare-tire well.\n\nSgt. Walter Voss is arrested by Internal Affairs. An audit finds 412 'destroyed' evidence guns that never reached the foundry.\n\nLongshore Local 19 names its scholarship fund for Tommy Ruiz.", "Mesa Verde, 1995")
	await say("But nobody can say who Delacroix was really selling to in 1994, or how many shipments left Pier 12 before Container 7731...\n\nTO BE CONTINUED.", "Mesa Verde, 1995")
	var s := GameManager.score
	var m := GameManager.max_score()
	Sound.music("theme")
	var i := await choose("Final score: %d of %d\nRank: %s\n\nThank you for playing COP QUEST: DEAD RECKONING." % [s, m, GameManager.rank()], ["Play Again", "Quit"], "Case Closed")
	UI.busy = 0
	if i == 1:
		get_tree().quit()
	else:
		SceneManager.restart()
