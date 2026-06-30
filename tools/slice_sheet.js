// Cop Quest — walk-cycle sprite-sheet slicer (no external dependencies).
//
// Takes an AI-generated sheet (rows = directions: DOWN, UP, RIGHT, LEFT; any
// roughly-even spacing; text labels allowed) on a solid background and emits a
// clean uniform-grid sheet for Godot's Sprite2D hframes/vframes:
//   - background removed (flood fill from edges) with crisp alpha,
//   - frames auto-detected per row by content columns (labels filtered out
//     by their small height),
//   - every frame bottom-centered in its cell so feet stay planted.
//
//   node tools/slice_sheet.js assets/source/walk_sheet.png assets/art/officer_walk.png
//
// Prints the cell size — wire that into the player scene (scale/offset).

const fs = require("fs");
const { decodePNG, encodePNG, bgRemove, alphaThreshold } = require("./pixelate.js");

const inPath = process.argv[2] || "assets/source/walk_sheet.png";
const outPath = process.argv[3] || "assets/art/officer_walk.png";
const ROWS = 4, COLS = 8;
const MIN_FRAME_H = 100; // content shorter than this (e.g. text labels) is ignored

const img = decodePNG(fs.readFileSync(inPath));
bgRemove(img, 60);
alphaThreshold(img, 128);

const bandH = Math.floor(img.h / ROWS);
const alphaAt = (x, y) => img.px[(y * img.w + x) * 4 + 3];

// Find content segments per row band via column occupancy.
const frames = []; // [{row, x0, x1, y0, y1}]
for (let r = 0; r < ROWS; r++) {
	const yTop = r * bandH, yBot = yTop + bandH;
	const colHas = new Array(img.w).fill(false);
	for (let x = 0; x < img.w; x++)
		for (let y = yTop; y < yBot; y++)
			if (alphaAt(x, y)) { colHas[x] = true; break; }

	// segments of occupied columns (bridging gaps <= 6px)
	const segs = [];
	let start = -1, gap = 0;
	for (let x = 0; x <= img.w; x++) {
		const occ = x < img.w && colHas[x];
		if (occ) { if (start < 0) start = x; gap = 0; }
		else if (start >= 0 && ++gap > 6) { segs.push([start, x - gap]); start = -1; }
	}

	for (const [x0, x1] of segs) {
		// Content rows in this column range, grouped into vertical runs (bridging
		// gaps <= 4px). The character is the tallest run; any printed frame
		// number sits as a short run below a gap and is ignored.
		const rows = [];
		for (let y = yTop; y < yBot; y++) {
			let has = false;
			for (let x = x0; x <= x1; x++) if (alphaAt(x, y)) { has = true; break; }
			rows.push(has);
		}
		const runs = [];
		let start = -1, gap = 0;
		for (let i = 0; i <= rows.length; i++) {
			const occ = i < rows.length && rows[i];
			if (occ) { if (start < 0) start = i; gap = 0; }
			else if (start >= 0 && ++gap > 4) { runs.push([start, i - gap]); start = -1; }
		}
		let best = null, bestH = 0;
		for (const [a, b] of runs) { const h = b - a + 1; if (h > bestH) { bestH = h; best = [a, b]; } }
		if (best && bestH >= MIN_FRAME_H) frames.push({ row: r, x0, x1, y0: yTop + best[0], y1: yTop + best[1] });
	}
}

// --- repair dark hair eaten by background removal -------------------------
// The hair was drawn at nearly the background color, so the flood fill carved
// it out, leaving only outline wisps. Reclaim it geometrically: in each
// frame's head zone, morphologically close the alpha (dilate -> fill enclosed
// holes -> erode). Reclaimed pixels take their color from the source image —
// which IS the hair color; those pixels were only wrongly transparent.
const HAIR_R = 8;            // closing radius (seals outline gaps <= 2*R)
const HEAD_ZONE = 0.45;      // top fraction of the frame treated as "head"
const HEAD_PAD_UP = 30;      // px above current content top hair may extend

function repairHead(f) {
	const rx0 = Math.max(0, f.x0 - 4), rx1 = Math.min(img.w - 1, f.x1 + 4);
	const ry0 = Math.max(f.row * bandH, f.y0 - HEAD_PAD_UP);
	const ry1 = Math.min(f.row * bandH + bandH - 1, f.y0 + Math.round((f.y1 - f.y0) * HEAD_ZONE));
	const W = rx1 - rx0 + 1, H = ry1 - ry0 + 1;
	let mask = new Uint8Array(W * H);
	for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
		mask[y * W + x] = alphaAt(rx0 + x, ry0 + y) ? 1 : 0;
	const mask0 = mask.slice(); // survivors before morphology
	// A reclaimed pixel must sit on top of the head: some survivor below it in
	// the same column within SUPPORT px. Kills halos that balloon beside the head.
	const SUPPORT = 95;
	const supported = (x, y) => {
		for (let yy = y + 1; yy < Math.min(H, y + SUPPORT); yy++) if (mask0[yy * W + x]) return true;
		return false;
	};

	const pass = (src, val) => { // one 3x3 dilate (val=1) or erode (val=0) step
		const dst = new Uint8Array(src);
		for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
			let hit = false;
			for (let dy = -1; dy <= 1 && !hit; dy++) for (let dx = -1; dx <= 1 && !hit; dx++) {
				const nx = x + dx, ny = y + dy;
				if (nx < 0 || ny < 0 || nx >= W || ny >= H) { if (val === 0) hit = true; continue; }
				if (src[ny * W + nx] === val) hit = true;
			}
			if (hit) dst[y * W + x] = val;
		}
		return dst;
	};

	for (let i = 0; i < HAIR_R; i++) mask = pass(mask, 1);  // dilate
	// fill enclosed holes: flood transparent from region border; unreached = hole
	const reach = new Uint8Array(W * H);
	const stack = [];
	for (let x = 0; x < W; x++) for (const y of [0, H - 1]) if (!mask[y * W + x] && !reach[y * W + x]) { reach[y * W + x] = 1; stack.push(y * W + x); }
	for (let y = 0; y < H; y++) for (const x of [0, W - 1]) if (!mask[y * W + x] && !reach[y * W + x]) { reach[y * W + x] = 1; stack.push(y * W + x); }
	while (stack.length) {
		const p = stack.pop(), x = p % W, y = (p / W) | 0;
		for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
			const nx = x + dx, ny = y + dy;
			if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
			const q = ny * W + nx;
			if (!mask[q] && !reach[q]) { reach[q] = 1; stack.push(q); }
		}
	}
	for (let i = 0; i < W * H; i++) if (!mask[i] && !reach[i]) mask[i] = 1;
	for (let i = 0; i < HAIR_R; i++) mask = pass(mask, 0);  // erode

	let reclaimed = 0;
	for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
		if (mask[y * W + x] && !alphaAt(rx0 + x, ry0 + y) && supported(x, y)) {
			img.px[((ry0 + y) * img.w + (rx0 + x)) * 4 + 3] = 255;
			reclaimed++;
		}
	}

	// Second pass: gaps whose side openings were too wide for the closing
	// (e.g. a strip between the hair's top outline and the dome). In the upper
	// part of the head zone, fill short transparent runs bounded by opaque
	// pixels above AND below in the same column.
	const SANDWICH_MAX_RUN = 14;
	const yCap = ry0 + Math.round(H * 0.6);
	for (let x = rx0; x <= rx1; x++) {
		let y = ry0;
		while (y <= yCap) {
			if (!alphaAt(x, y) && y > ry0 && alphaAt(x, y - 1)) {
				let end = y;
				while (end <= yCap && !alphaAt(x, end)) end++;
				if (end <= yCap && alphaAt(x, end) && end - y <= SANDWICH_MAX_RUN) {
					for (let yy = y; yy < end; yy++) { img.px[(yy * img.w + x) * 4 + 3] = 255; reclaimed++; }
				}
				y = end;
			} else y++;
		}
	}
	// content may now start higher (hair above the old top)
	for (let y = ry0; y < f.y0; y++) {
		let has = false;
		for (let x = f.x0; x <= f.x1 && !has; x++) if (alphaAt(x, y)) has = true;
		if (has) { f.y0 = y; break; }
	}
	return reclaimed;
}

let totalReclaimed = 0;
for (const f of frames) totalReclaimed += repairHead(f);
console.log(`hair repair: reclaimed ${totalReclaimed} px across ${frames.length} frames`);

// validate counts per row
const byRow = [[], [], [], []];
for (const f of frames) byRow[f.row].push(f);
const names = ["DOWN", "UP", "RIGHT", "LEFT"];
let ok = true;
byRow.forEach((list, r) => {
	list.sort((a, b) => a.x0 - b.x0);
	console.log(`${names[r]}: ${list.length} frames  widths=[${list.map(f => f.x1 - f.x0 + 1).join(",")}]`);
	if (list.length !== COLS) ok = false;
});
if (!ok) { console.error(`FAILED: expected ${COLS} frames per row`); process.exit(1); }

// uniform cell, bottom-centered
const cellW = Math.max(...frames.map(f => f.x1 - f.x0 + 1)) + 4;
const cellH = Math.max(...frames.map(f => f.y1 - f.y0 + 1)) + 2;
const out = { w: cellW * COLS, h: cellH * ROWS, px: new Uint8Array(cellW * COLS * cellH * ROWS * 4) };
byRow.forEach((list, r) => list.forEach((f, c) => {
	const w = f.x1 - f.x0 + 1, h = f.y1 - f.y0 + 1;
	const dx0 = c * cellW + ((cellW - w) >> 1);
	const dy0 = r * cellH + (cellH - h); // bottom-aligned
	for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
		const si = ((f.y0 + y) * img.w + (f.x0 + x)) * 4;
		if (!img.px[si + 3]) continue;
		const di = ((dy0 + y) * out.w + (dx0 + x)) * 4;
		out.px[di] = img.px[si]; out.px[di + 1] = img.px[si + 1]; out.px[di + 2] = img.px[si + 2]; out.px[di + 3] = 255;
	}
}));

fs.writeFileSync(outPath, encodePNG(out.w, out.h, out.px));
console.log(`wrote ${outPath}: ${out.w}x${out.h}  cell=${cellW}x${cellH}  (Sprite2D: hframes=${COLS} vframes=${ROWS})`);
