// Extract the bed from the bedroom photo as a transparent cutout sprite, so it
// can be Y-sorted in front of / behind the player. Polygon is in DESIGN coords
// (320x200); the bedroom texture is 4x that (1280x800).
//
//   node tools/extract_bed.js   ->   assets/art/bed.png
//
// Re-run after changing the polygon below to retune the silhouette.

const fs = require("fs");
const { decodePNG, encodePNG } = require("./pixelate.js");

const S = 4; // design -> texture scale
const bg = decodePNG(fs.readFileSync("assets/art/bedroom_bg.png"));

// Bed silhouette, design coords, traced from the grid. Right + front edges are
// what matter for occlusion; left/top run to the wall.
const POLY = [
	[0, 73], [82, 77], [104, 94], [102, 124], [94, 150], [82, 172], [0, 177],
];

function inPoly(px, py, poly) {
	let c = false;
	for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
		const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
		if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) c = !c;
	}
	return c;
}

let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
for (const [x, y] of POLY) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
const W = Math.round((x1 - x0) * S), H = Math.round((y1 - y0) * S);
const out = new Uint8Array(W * H * 4);
for (let oy = 0; oy < H; oy++) for (let ox = 0; ox < W; ox++) {
	const dx = x0 + (ox + 0.5) / S, dy = y0 + (oy + 0.5) / S;
	const di = (oy * W + ox) * 4;
	if (inPoly(dx, dy, POLY)) {
		const bx = Math.round(x0 * S + ox), by = Math.round(y0 * S + oy);
		const si = (by * bg.w + bx) * 4;
		out[di] = bg.px[si]; out[di + 1] = bg.px[si + 1]; out[di + 2] = bg.px[si + 2]; out[di + 3] = 255;
	} else out[di + 3] = 0;
}
fs.writeFileSync("assets/art/bed.png", encodePNG(W, H, out));
console.log(`bed.png ${W}x${H}  | design top-left (${x0},${y0})  baseline-y ~${y1}`);
