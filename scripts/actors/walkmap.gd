class_name Walkmap
extends RefCounted
## Walkable floor for a room: a polygon (the visible floor) minus rectangular
## blockers (desks, tables). Provides containment, clamping, and shortest
## paths via a visibility graph over the polygon / blocker corners.

var poly := PackedVector2Array()
var blockers: Array = []    # Array[Rect2]
var _nodes := PackedVector2Array()


func _init(p_poly: PackedVector2Array, p_blockers: Array = []) -> void:
	poly = p_poly
	blockers = p_blockers
	_build_nodes()


func is_walkable(p: Vector2) -> bool:
	if poly.size() >= 3 and not Geometry2D.is_point_in_polygon(p, poly):
		return false
	for b in blockers:
		if (b as Rect2).has_point(p):
			return false
	return true


## Nearest walkable point to `p`.
func clamp_point(p: Vector2) -> Vector2:
	if is_walkable(p):
		return p
	var best := p
	var best_d := INF
	var cands: Array = []
	for i in poly.size():
		cands.append(Geometry2D.get_closest_point_to_segment(p, poly[i], poly[(i + 1) % poly.size()]))
	for b in blockers:
		var r: Rect2 = b
		cands.append(Vector2(clampf(p.x, r.position.x, r.end.x), r.end.y + 1.5))
		cands.append(Vector2(clampf(p.x, r.position.x, r.end.x), r.position.y - 1.5))
		cands.append(Vector2(r.position.x - 1.5, clampf(p.y, r.position.y, r.end.y)))
		cands.append(Vector2(r.end.x + 1.5, clampf(p.y, r.position.y, r.end.y)))
	for c in cands:
		# nudge inward until walkable
		var q: Vector2 = c
		for step in 6:
			if is_walkable(q):
				break
			q = q.move_toward(_centroid(), 1.0)
		if is_walkable(q):
			var d := p.distance_squared_to(q)
			if d < best_d:
				best_d = d
				best = q
	return best


func _centroid() -> Vector2:
	var c := Vector2.ZERO
	for v in poly:
		c += v
	return c / maxf(1.0, poly.size())


func _build_nodes() -> void:
	_nodes.clear()
	var dirs := [Vector2(2, 2), Vector2(-2, 2), Vector2(2, -2), Vector2(-2, -2), Vector2(0, 3), Vector2(0, -3), Vector2(3, 0), Vector2(-3, 0)]
	for v in poly:
		for d in dirs:
			if is_walkable(v + d):
				_nodes.append(v + d)
				break
	for b in blockers:
		var r: Rect2 = (b as Rect2).grow(3)
		for c in [r.position, Vector2(r.end.x, r.position.y), r.end, Vector2(r.position.x, r.end.y)]:
			if is_walkable(c):
				_nodes.append(c)


func segment_clear(a: Vector2, b: Vector2) -> bool:
	var n := int(a.distance_to(b) / 2.0) + 1
	for i in range(1, n):
		if not is_walkable(a.lerp(b, float(i) / n)):
			return false
	return true


## Shortest path from a to b (both walkable). Returns waypoints after `a`.
func find_path(a: Vector2, b: Vector2) -> PackedVector2Array:
	if segment_clear(a, b):
		return PackedVector2Array([b])
	var pts := PackedVector2Array([a])
	pts.append_array(_nodes)
	pts.append(b)
	var n := pts.size()
	var dist := []
	var prev := []
	var done := []
	for i in n:
		dist.append(INF)
		prev.append(-1)
		done.append(false)
	dist[0] = 0.0
	for _iter in n:
		var u := -1
		for i in n:
			if not done[i] and (u < 0 or dist[i] < dist[u]):
				u = i
		if u < 0 or dist[u] == INF:
			break
		if u == n - 1:
			break
		done[u] = true
		for v in n:
			if done[v] or v == u:
				continue
			var nd: float = dist[u] + pts[u].distance_to(pts[v])
			if nd < dist[v] and segment_clear(pts[u], pts[v]):
				dist[v] = nd
				prev[v] = u
	if prev[n - 1] < 0:
		return PackedVector2Array([b])   # unreachable: walk straight and slide
	var path := PackedVector2Array()
	var cur := n - 1
	while cur > 0:
		path.insert(0, pts[cur])
		cur = prev[cur]
	return path
