extends Node2D
## Top-down placeholder police cruiser used in the driving scene.
## Movement itself is driven by driving.gd; this script only draws the car.
## Real isometric vehicle art arrives with the town build-out (M3).

func _draw() -> void:
	draw_rect(Rect2(-11, -7, 22, 14), Color(0.90, 0.90, 0.92))  # white body
	draw_rect(Rect2(-11, -7, 22, 4), Color(0.10, 0.12, 0.25))   # dark hood stripe
	draw_rect(Rect2(-11, 3, 22, 4), Color(0.10, 0.12, 0.25))    # dark trunk stripe
	draw_rect(Rect2(-3, -2, 6, 4), Color(0.20, 0.45, 1.0))      # blue light bar
