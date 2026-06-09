// Cop Quest — procedural pixel-art generator (no external dependencies).
//
// Builds raw RGBA pixel buffers and encodes them as PNGs using Node's built-in
// zlib. This is our editable, version-controlled "placeholder" art: a detailed
// SCI/VGA-style bedroom plus small item icons. Tweak the draw routines and
// re-run:  node tools/gen_art.js
//
// Output -> assets/art/*.png  (Godot imports them automatically on next open)

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

// ----------------------------------------------------------------------------
// Tiny canvas helper (flat RGBA Uint8Array)
// ----------------------------------------------------------------------------
class Canvas {
	constructor(w, h) {
		this.w = w;
		this.h = h;
		this.px = new Uint8Array(w * h * 4); // transparent by default
	}
	set(x, y, c) {
		x |= 0; y |= 0;
		if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
		const i = (y * this.w + x) * 4;
		const a = c[3] === undefined ? 255 : c[3];
		if (a === 255) {
			this.px[i] = c[0]; this.px[i + 1] = c[1]; this.px[i + 2] = c[2]; this.px[i + 3] = 255;
		} else if (a > 0) {
			// simple alpha-over for soft edges
			const ba = this.px[i + 3] / 255, fa = a / 255, oa = fa + ba * (1 - fa);
			if (oa <= 0) return;
			this.px[i] = (c[0] * fa + this.px[i] * ba * (1 - fa)) / oa;
			this.px[i + 1] = (c[1] * fa + this.px[i + 1] * ba * (1 - fa)) / oa;
			this.px[i + 2] = (c[2] * fa + this.px[i + 2] * ba * (1 - fa)) / oa;
			this.px[i + 3] = oa * 255;
		}
	}
	fill(x, y, w, h, c) {
		for (let yy = y; yy < y + h; yy++)
			for (let xx = x; xx < x + w; xx++) this.set(xx, yy, c);
	}
	hline(x, y, w, c) { for (let xx = x; xx < x + w; xx++) this.set(xx, y, c); }
	vline(x, y, h, c) { for (let yy = y; yy < y + h; yy++) this.set(x, yy, c); }
	// Filled rect with a 1px highlight (top/left) and shadow (bottom/right).
	box(x, y, w, h, face, hi, lo) {
		this.fill(x, y, w, h, face);
		if (hi) { this.hline(x, y, w, hi); this.vline(x, y, h, hi); }
		if (lo) { this.hline(x, y + h - 1, w, lo); this.vline(x + w - 1, y, h, lo); }
	}
	disc(cx, cy, r, c) {
		for (let yy = -r; yy <= r; yy++)
			for (let xx = -r; xx <= r; xx++)
				if (xx * xx + yy * yy <= r * r) this.set(cx + xx, cy + yy, c);
	}
	ring(cx, cy, r, c) {
		for (let yy = -r; yy <= r; yy++)
			for (let xx = -r; xx <= r; xx++) {
				const d = xx * xx + yy * yy;
				if (d <= r * r && d >= (r - 1.6) * (r - 1.6)) this.set(cx + xx, cy + yy, c);
			}
	}
	polygon(pts, c) {
		let minY = Infinity, maxY = -Infinity;
		for (const p of pts) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
		for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
			const xs = [];
			for (let i = 0; i < pts.length; i++) {
				const a = pts[i], b = pts[(i + 1) % pts.length];
				if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y))
					xs.push(a[0] + (y - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
			}
			xs.sort((p, q) => p - q);
			for (let k = 0; k + 1 < xs.length; k += 2)
				for (let x = Math.round(xs[k]); x <= Math.round(xs[k + 1]); x++) this.set(x, y, c);
		}
	}
}

// ----------------------------------------------------------------------------
// PNG encoder (RGBA, no filtering)
// ----------------------------------------------------------------------------
const CRC = (() => {
	const t = new Uint32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
		t[n] = c >>> 0;
	}
	return t;
})();
function crc32(buf) {
	let c = 0xFFFFFFFF;
	for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
	return (c ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
	const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
	const tb = Buffer.from(type, "ascii");
	const body = Buffer.concat([tb, data]);
	const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0);
	return Buffer.concat([len, body, crc]);
}
function encodePNG(cv) {
	const { w, h, px } = cv;
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
	ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
	const stride = w * 4;
	const raw = Buffer.alloc(h * (stride + 1));
	for (let y = 0; y < h; y++) {
		raw[y * (stride + 1)] = 0; // filter: none
		Buffer.from(px.buffer, y * stride, stride).copy(raw, y * (stride + 1) + 1);
	}
	const idat = zlib.deflateSync(raw, { level: 9 });
	const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
	return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

// ----------------------------------------------------------------------------
// Palette (cohesive muted VGA-ish)
// ----------------------------------------------------------------------------
const C = {
	wall: [178, 160, 132], wallStripe: [168, 150, 122], wallDark: [150, 134, 108],
	baseboard: [120, 100, 78], baseHi: [140, 120, 96],
	floor: [150, 112, 72], plank: [126, 92, 56], floorHi: [170, 130, 86],
	bedFrame: [104, 68, 42], bedFrameHi: [134, 92, 60], bedFrameLo: [76, 48, 28],
	blanket: [66, 96, 142], blanketHi: [94, 124, 172], blanketLo: [48, 72, 112],
	pillow: [232, 226, 214], pillowLo: [198, 192, 180],
	dresser: [128, 86, 52], dresserHi: [158, 112, 72], dresserLo: [92, 60, 36],
	drawer: [142, 98, 60], knob: [54, 38, 24],
	door: [96, 62, 40], doorPanel: [114, 76, 48], doorLo: [70, 44, 28], doorKnob: [214, 182, 86],
	winFrame: [196, 196, 200], winFrameLo: [150, 150, 156], sky: [150, 192, 226], skyLo: [184, 208, 232],
	curtain: [168, 66, 66], curtainHi: [196, 92, 92],
	rug: [150, 58, 66], rugRim: [206, 182, 96], rugInner: [120, 44, 52],
	picFrame: [58, 42, 28], pic: [120, 150, 124], picSky: [168, 196, 214],
	lampBase: [70, 70, 84], lampPole: [120, 120, 132], shade: [232, 212, 150], shadeLo: [206, 184, 120],
	stand: [120, 82, 52], standHi: [150, 108, 72], standLo: [90, 58, 36],
	gold: [222, 186, 78], goldHi: [246, 216, 120], goldLo: [156, 124, 44],
	silver: [206, 210, 220], silverLo: [150, 156, 168], dark: [40, 32, 24],
};

// ----------------------------------------------------------------------------
// Bedroom background (320x200), 3/4 view: wall on top, floor on bottom.
// ----------------------------------------------------------------------------
function bedroom() {
	const cv = new Canvas(320, 200);
	const FLOOR_Y = 118;

	// Wall with faint vertical stripes
	cv.fill(0, 0, 320, FLOOR_Y, C.wall);
	for (let x = 0; x < 320; x += 8) cv.vline(x, 0, FLOOR_Y, C.wallStripe);
	// Baseboard
	cv.fill(0, FLOOR_Y - 6, 320, 6, C.baseboard);
	cv.hline(0, FLOOR_Y - 6, 320, C.baseHi);

	// Floor with horizontal planks
	cv.fill(0, FLOOR_Y, 320, 200 - FLOOR_Y, C.floor);
	for (let y = FLOOR_Y; y < 200; y += 10) { cv.hline(0, y, 320, C.plank); cv.hline(0, y + 1, 320, C.floorHi); }
	// stagger plank seams
	for (let y = FLOOR_Y + 5; y < 200; y += 10) for (let x = (y * 7) % 40; x < 320; x += 80) cv.vline(x, y, 5, C.plank);

	// Window (center wall) with sky + curtains
	cv.box(116, 16, 70, 56, C.winFrame, null, C.winFrameLo);
	cv.fill(122, 22, 58, 44, C.sky);
	cv.fill(122, 46, 58, 20, C.skyLo);
	cv.vline(151, 22, 44, C.winFrameLo); cv.hline(122, 44, 58, C.winFrameLo); // mullions
	cv.fill(110, 14, 10, 64, C.curtain); cv.vline(112, 14, 64, C.curtainHi);
	cv.fill(182, 14, 10, 64, C.curtain); cv.vline(184, 14, 64, C.curtainHi);

	// Framed picture (left wall)
	cv.box(40, 20, 40, 30, C.picFrame, null, C.dark);
	cv.fill(44, 24, 32, 22, C.pic); cv.fill(44, 24, 32, 11, C.picSky);
	cv.polygon([[44, 46], [58, 30], [70, 40], [76, 34], [76, 46]], [96, 120, 96]); // little hills

	// Bed (left), headboard up against wall
	cv.box(10, 96, 92, 78, C.bedFrame, C.bedFrameHi, C.bedFrameLo);
	cv.box(10, 84, 92, 16, C.bedFrame, C.bedFrameHi, C.bedFrameLo); // headboard
	cv.fill(16, 100, 80, 70, C.blanket);
	cv.hline(16, 100, 80, C.blanketHi);
	for (let y = 104; y < 170; y += 6) cv.hline(16, y, 80, C.blanketLo); // quilting lines
	cv.box(20, 94, 56, 20, C.pillow, null, C.pillowLo); // pillow
	cv.fill(16, 100, 80, 8, C.pillowLo); // folded sheet edge

	// Nightstand + lamp (right of bed)
	cv.box(104, 92, 30, 26, C.stand, C.standHi, C.standLo);
	cv.hline(104, 104, 30, C.standLo);
	cv.fill(116, 84, 6, 10, C.lampPole); cv.fill(112, 78, 14, 8, C.shade); cv.hline(112, 78, 14, C.shadeLo);
	cv.fill(113, 92, 12, 4, C.lampBase);

	// Dresser (upper right) — keys will sit on top (~y48) as a separate sprite
	cv.box(220, 30, 80, 84, C.dresser, C.dresserHi, C.dresserLo);
	cv.fill(224, 30, 72, 8, C.dresserHi); // top surface
	for (let r = 0; r < 3; r++) {
		const dy = 42 + r * 22;
		cv.box(226, dy, 68, 18, C.drawer, C.dresserHi, C.dresserLo);
		cv.disc(244, dy + 9, 2, C.knob); cv.disc(276, dy + 9, 2, C.knob);
	}

	// Door (right edge)
	cv.box(296, 64, 24, 74, C.door, null, C.doorLo);
	cv.box(300, 70, 16, 28, C.doorPanel, null, C.doorLo);
	cv.box(300, 102, 16, 30, C.doorPanel, null, C.doorLo);
	cv.disc(302, 102, 2, C.doorKnob);

	// Rug (center floor) — oval-ish via stacked rects
	const rx = 150, ry = 150;
	for (let i = 0; i < 28; i++) {
		const t = i / 27, hw = Math.round(60 * Math.sin(Math.PI * t));
		cv.hline(rx - hw, ry - 14 + i, hw * 2, i < 3 || i > 24 ? C.rugRim : C.rug);
	}
	cv.fill(rx - 30, ry - 6, 60, 12, C.rugInner);
	cv.hline(rx - 44, ry, 88, C.rugRim);

	return cv;
}

// ----------------------------------------------------------------------------
// Item icons (small, transparent background)
// ----------------------------------------------------------------------------
function keys() {
	const cv = new Canvas(20, 12);
	cv.ring(5, 6, 4, C.goldLo); cv.ring(5, 6, 4, C.gold);
	cv.fill(9, 5, 9, 3, C.gold); cv.hline(9, 4, 9, C.goldHi); cv.hline(9, 8, 9, C.goldLo);
	cv.fill(15, 8, 2, 2, C.gold); cv.fill(12, 8, 2, 2, C.gold); // teeth
	return cv;
}
function badge() {
	const cv = new Canvas(16, 16);
	cv.disc(8, 8, 7, C.goldLo); cv.disc(8, 8, 6, C.gold); cv.disc(8, 6, 5, C.goldHi);
	cv.disc(8, 8, 6, C.gold);
	// 5-point star
	const pts = [], cx = 8, cy = 8;
	for (let i = 0; i < 10; i++) {
		const r = i % 2 === 0 ? 5 : 2.1, a = -Math.PI / 2 + i * Math.PI / 5;
		pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
	}
	cv.polygon(pts, C.silver);
	cv.disc(8, 8, 1, C.silverLo);
	cv.ring(8, 8, 7, C.dark);
	return cv;
}

// ----------------------------------------------------------------------------
// Officer sprite (front-facing, 16x28). Origin/feet at bottom-center.
// ----------------------------------------------------------------------------
function officer() {
	const cv = new Canvas(16, 28);
	const skin = [228, 190, 158], skinLo = [196, 158, 128];
	const cap = [28, 38, 78], capHi = [54, 66, 112];
	const shirt = [54, 84, 150], shirtHi = [78, 110, 178], shirtLo = [38, 60, 112];
	const pants = [40, 50, 92], pantsLo = [28, 36, 70];
	const black = [26, 26, 30];

	// Cap
	cv.fill(4, 1, 8, 3, cap); cv.hline(4, 1, 8, capHi);
	cv.fill(3, 4, 10, 1, black); // brim
	// Head / face
	cv.fill(5, 4, 6, 5, skin); cv.vline(5, 5, 4, skinLo); cv.vline(10, 5, 4, skinLo);
	cv.fill(6, 6, 1, 1, black); cv.fill(9, 6, 1, 1, black); // eyes
	// Neck
	cv.fill(7, 9, 2, 1, skinLo);
	// Torso (uniform shirt) + shoulders
	cv.box(3, 10, 10, 9, shirt, shirtHi, shirtLo);
	cv.vline(8, 10, 9, shirtLo); // shirt seam
	cv.fill(4, 12, 2, 2, C.gold); // badge
	cv.fill(10, 12, 2, 1, [220, 220, 230]); // collar tab
	// Arms
	cv.fill(2, 11, 2, 7, shirtLo); cv.fill(12, 11, 2, 7, shirtLo);
	cv.fill(2, 17, 2, 2, skin); cv.fill(12, 17, 2, 2, skin); // hands
	// Belt
	cv.fill(3, 19, 10, 2, black); cv.fill(7, 19, 2, 2, C.goldLo);
	// Legs
	cv.fill(4, 21, 3, 6, pants); cv.fill(9, 21, 3, 6, pants);
	cv.vline(4, 21, 6, pantsLo); cv.vline(11, 21, 6, pantsLo);
	// Shoes
	cv.fill(3, 26, 4, 2, black); cv.fill(9, 26, 4, 2, black);
	return cv;
}

// ----------------------------------------------------------------------------
// Write outputs + sanity check
// ----------------------------------------------------------------------------
const outDir = path.join(__dirname, "..", "assets", "art");
fs.mkdirSync(outDir, { recursive: true });

const outputs = [
	["bedroom_bg.png", bedroom()],
	["item_keys.png", keys()],
	["item_badge.png", badge()],
	["officer.png", officer()],
];

for (const [name, cv] of outputs) {
	const png = encodePNG(cv);
	const file = path.join(outDir, name);
	fs.writeFileSync(file, png);
	// sanity: re-read IHDR dimensions
	const b = fs.readFileSync(file);
	const w = b.readUInt32BE(16), h = b.readUInt32BE(20);
	const ok = w === cv.w && h === cv.h && b[0] === 0x89 && b.slice(1, 4).toString() === "PNG";
	console.log(`${ok ? "OK " : "BAD"} ${name}  ${w}x${h}  ${png.length} bytes`);
	if (!ok) process.exitCode = 1;
}

// Dev-only: composite the scene roughly as Godot will (officer + items placed)
// so we can eyeball it without launching the engine.  Run: PREVIEW=1 node ...
if (process.env.PREVIEW) {
	const blit = (dst, src, cx, cy) => { // cx,cy = center
		for (let y = 0; y < src.h; y++)
			for (let x = 0; x < src.w; x++) {
				const i = (y * src.w + x) * 4;
				if (src.px[i + 3] === 0) continue;
				dst.set(cx - (src.w >> 1) + x, cy - (src.h >> 1) + y,
					[src.px[i], src.px[i + 1], src.px[i + 2], src.px[i + 3]]);
			}
	};
	const scene = bedroom();
	blit(scene, keys(), 260, 34);
	blit(scene, badge(), 150, 150);
	const off = officer();
	blit(scene, off, 150, 170 - (off.h >> 1)); // feet at y=170
	fs.writeFileSync(path.join(__dirname, "_preview.png"), encodePNG(scene));
	console.log("wrote tools/_preview.png");
}
