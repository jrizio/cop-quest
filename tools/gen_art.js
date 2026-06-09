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
	// --- shading / lighting helpers (for the "lit" pixel-painting look) ---
	mulPx(x, y, f) { // multiply existing pixel brightness (scalar or [r,g,b])
		x |= 0; y |= 0; if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
		const i = (y * this.w + x) * 4; if (this.px[i + 3] === 0) return;
		const fr = f.length ? f[0] : f, fg = f.length ? f[1] : f, fb = f.length ? f[2] : f;
		this.px[i] = clamp8(this.px[i] * fr);
		this.px[i + 1] = clamp8(this.px[i + 1] * fg);
		this.px[i + 2] = clamp8(this.px[i + 2] * fb);
	}
	addPx(x, y, dr, dg, db) { // add light (warm glow, highlights)
		x |= 0; y |= 0; if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
		const i = (y * this.w + x) * 4; if (this.px[i + 3] === 0) return;
		this.px[i] = clamp8(this.px[i] + dr); this.px[i + 1] = clamp8(this.px[i + 1] + dg); this.px[i + 2] = clamp8(this.px[i + 2] + db);
	}
	tint(x, y, c, a) { // blend existing pixel toward color c by alpha a
		x |= 0; y |= 0; if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
		const i = (y * this.w + x) * 4; if (this.px[i + 3] === 0) return;
		this.px[i] = this.px[i] * (1 - a) + c[0] * a;
		this.px[i + 1] = this.px[i + 1] * (1 - a) + c[1] * a;
		this.px[i + 2] = this.px[i + 2] * (1 - a) + c[2] * a;
	}
	rectGrad(x, y, w, h, top, bot) { // vertical gradient fill
		for (let yy = 0; yy < h; yy++) this.hline(x, y + yy, w, mix(top, bot, h <= 1 ? 0 : yy / (h - 1)));
	}
	softShadow(cx, cy, rx, ry, strength) { // soft elliptical contact shadow
		for (let yy = -ry; yy <= ry; yy++)
			for (let xx = -rx; xx <= rx; xx++) {
				const d = (xx * xx) / (rx * rx) + (yy * yy) / (ry * ry);
				if (d <= 1) this.tint(cx + xx, cy + yy, [18, 12, 8], strength * (1 - d) * (1 - d));
			}
	}
	grainRect(x, y, w, h, amt) { // subtle per-pixel material noise
		for (let yy = y; yy < y + h; yy++)
			for (let xx = x; xx < x + w; xx++) {
				const i = (yy * this.w + xx) * 4; if (this.px[i + 3] === 0) continue;
				const n = (hash(xx, yy) - 0.5) * amt;
				this.px[i] = clamp8(this.px[i] + n); this.px[i + 1] = clamp8(this.px[i + 1] + n); this.px[i + 2] = clamp8(this.px[i + 2] + n);
			}
	}
}

// shared math helpers
const clamp8 = (v) => v < 0 ? 0 : (v > 255 ? 255 : v);
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mul = (c, f) => [c[0] * f, c[1] * f, c[2] * f];
function hash(x, y) { let h = (x * 374761393 + y * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }

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

// Wood panel with gradient, grain streaks, and edge light/shadow.
function wood(cv, x, y, w, h, base, dir) {
	cv.rectGrad(x, y, w, h, mul(base, 1.14), mul(base, 0.82));
	const n = dir === "v" ? w : h;
	for (let k = 0; k < n; k++) {
		if (hash(x + (dir === "v" ? k : 0), y + (dir === "v" ? 0 : k)) > 0.80) {
			if (dir === "v") cv.vline(x + k, y, h, mul(base, 0.72));
			else cv.hline(x, y + k, w, mul(base, 0.72));
		}
	}
	cv.grainRect(x, y, w, h, 9);
	cv.hline(x, y, w, mul(base, 1.32)); cv.vline(x, y, h, mul(base, 1.2));
	cv.hline(x, y + h - 1, w, mul(base, 0.6)); cv.vline(x + w - 1, y, h, mul(base, 0.62));
}

// ----------------------------------------------------------------------------
// Bedroom background (320x200), 3/4 view: lit "pixel-painting" style.
// Built from gradients + grain + soft shadows, then a global lighting pass
// (window daylight, warm lamp glow, vignette) so the scene reads as one space.
// ----------------------------------------------------------------------------
function bedroom() {
	const cv = new Canvas(320, 200);
	const FY = 116;

	// ---------- WALL ----------
	const wTop = [150, 132, 105], wBot = [190, 172, 143];
	for (let y = 0; y < FY; y++) {
		const r = mix(wTop, wBot, y / FY);
		for (let x = 0; x < 320; x++) {
			let c = ((x / 7 | 0) % 2 === 0) ? mul(r, 0.96) : r; // wallpaper stripes
			if (y % 6 === 0 && x % 24 === ((y / 6 | 0) % 24)) c = mul(c, 1.05); // faint motif
			cv.set(x, y, c);
		}
	}
	cv.grainRect(0, 0, 320, FY, 7);
	cv.rectGrad(0, 0, 320, 5, [120, 104, 82], [165, 148, 120]); // crown molding
	cv.hline(0, 5, 320, mul([120, 104, 82], 0.8));
	cv.fill(0, 70, 320, 2, [120, 102, 78]); cv.hline(0, 70, 320, [175, 156, 126]); // chair rail
	cv.rectGrad(0, FY - 9, 320, 9, [108, 90, 68], [78, 62, 44]); // baseboard
	cv.hline(0, FY - 9, 320, [150, 130, 104]);

	// ---------- FLOOR ----------
	const fFar = [150, 112, 72], fNear = [120, 84, 50];
	for (let y = FY; y < 200; y++) cv.hline(0, y, 320, mix(fFar, fNear, (y - FY) / (200 - FY)));
	{ // perspective planks: seam gap grows toward the viewer
		let y0 = FY, s = 5.5, band = 0;
		while (y0 < 200) {
			const yi = Math.round(y0), s2 = Math.round(s);
			cv.hline(0, yi, 320, [66, 44, 26]);
			for (let x = (band % 2 ? 26 : 64); x < 320; x += 78) cv.vline(x, yi, s2, [66, 44, 26]);
			y0 += s; s += 1.4; band++;
		}
	}
	cv.grainRect(0, FY, 320, 200 - FY, 9);

	// ---------- contact shadows (under furniture, before drawing it) ----------
	cv.softShadow(56, 176, 60, 12, 0.5);
	cv.softShadow(260, 116, 54, 10, 0.45);
	cv.softShadow(150, 158, 66, 16, 0.32);
	cv.softShadow(120, 122, 22, 7, 0.4);

	// ---------- WINDOW ----------
	cv.box(114, 14, 74, 60, [150, 150, 156], [196, 196, 202], [120, 120, 128]);
	cv.rectGrad(120, 20, 62, 48, [120, 170, 222], [196, 216, 236]); // sky
	for (let yy = 20; yy < 68; yy++) for (let xx = 120; xx < 182; xx++) { // sun glow
		const dx = xx - 158, dy = yy - 30, d = Math.sqrt(dx * dx + dy * dy);
		if (d < 26) cv.addPx(xx, yy, (26 - d) * 2.2, (26 - d) * 2.2, (26 - d) * 1.4);
	}
	cv.fill(150, 20, 2, 48, [150, 150, 156]); cv.fill(120, 42, 62, 2, [150, 150, 156]); // mullions
	cv.box(110, 68, 82, 6, [170, 160, 150], [200, 192, 182], [120, 112, 102]); // sill
	for (const cx0 of [104, 180]) for (let xx = 0; xx < 12; xx++) { // curtains with folds
		const fold = 0.78 + 0.22 * Math.sin(xx * 1.6);
		cv.rectGrad(cx0 + xx, 12, 1, 62, mul([176, 72, 72], fold * 1.05), mul([150, 56, 56], fold));
	}

	// ---------- PICTURE (left wall) ----------
	cv.box(36, 18, 42, 32, [60, 44, 30], [86, 66, 46], [34, 24, 16]);
	cv.rectGrad(41, 23, 32, 22, [150, 196, 214], [120, 156, 128]);
	cv.polygon([[41, 45], [54, 30], [64, 38], [72, 31], [78, 38], [78, 45]], [88, 116, 90]);

	// ---------- BED ----------
	wood(cv, 8, 82, 96, 18, [108, 72, 46], "h");   // headboard
	wood(cv, 8, 150, 96, 26, [96, 62, 40], "h");   // base/footboard
	cv.rectGrad(14, 98, 84, 56, [86, 118, 168], [54, 78, 124]); // duvet
	for (let i = 0; i < 6; i++) { const yy = 106 + i * 8; cv.hline(14, yy, 84, mul([54, 78, 124], 0.82)); cv.hline(14, yy + 1, 84, [100, 132, 182]); }
	cv.rectGrad(14, 98, 84, 12, [214, 210, 200], [176, 172, 162]); // turn-down sheet
	cv.box(18, 92, 38, 18, [236, 230, 218], [252, 248, 240], [200, 194, 182]); // pillow
	cv.box(58, 92, 38, 18, [232, 226, 214], [248, 244, 236], [196, 190, 178]); // pillow

	// ---------- NIGHTSTAND + LAMP ----------
	wood(cv, 106, 96, 28, 24, [120, 82, 52], "v");
	cv.hline(108, 104, 24, mul([120, 82, 52], 0.6)); cv.disc(120, 108, 1, [40, 30, 20]);
	cv.fill(118, 86, 4, 10, [110, 110, 124]); // pole
	cv.polygon([[110, 84], [130, 84], [127, 74], [113, 74]], [236, 214, 150]); // shade
	cv.hline(113, 74, 14, [250, 234, 180]); cv.fill(112, 95, 16, 3, [80, 80, 92]); // base

	// ---------- DRESSER (upper right) — keys sit on top surface ----------
	wood(cv, 218, 30, 84, 86, [128, 86, 52], "v");
	cv.rectGrad(218, 30, 84, 7, [168, 120, 78], [128, 86, 52]); cv.hline(218, 37, 84, mul([128, 86, 52], 0.6));
	for (let r = 0; r < 3; r++) {
		const dy = 44 + r * 23;
		cv.rectGrad(224, dy, 72, 19, mul([142, 98, 60], 1.12), mul([142, 98, 60], 0.84));
		cv.hline(224, dy, 72, mul([142, 98, 60], 1.3)); cv.hline(224, dy + 18, 72, mul([142, 98, 60], 0.6));
		cv.grainRect(224, dy, 72, 19, 8);
		for (const hx of [246, 274]) { cv.fill(hx, dy + 8, 12, 3, [150, 150, 160]); cv.hline(hx, dy + 8, 12, [210, 212, 222]); cv.hline(hx, dy + 10, 12, [90, 92, 102]); }
	}

	// ---------- DOOR (right edge) ----------
	cv.box(294, 60, 26, 78, [80, 64, 46], [110, 90, 66], [56, 44, 30]); // jamb
	wood(cv, 297, 62, 21, 74, [104, 70, 46], "v");
	cv.box(300, 68, 15, 28, mul([104, 70, 46], 0.9), mul([104, 70, 46], 1.15), mul([104, 70, 46], 0.7));
	cv.box(300, 100, 15, 30, mul([104, 70, 46], 0.9), mul([104, 70, 46], 1.15), mul([104, 70, 46], 0.7));
	cv.disc(303, 102, 2, [214, 182, 86]); cv.set(302, 101, [248, 224, 150]);

	// ---------- RUG (center floor) ----------
	const rx = 150, ry = 152;
	for (let i = 0; i < 30; i++) {
		const t = i / 29, hw = Math.round(62 * Math.sin(Math.PI * t));
		cv.hline(rx - hw, ry - 15 + i, hw * 2, (i < 3 || i > 26) ? [200, 176, 92] : [150, 58, 66]);
	}
	cv.hline(rx - 46, ry, 92, [200, 176, 92]); cv.hline(rx - 46, ry - 1, 92, mul([200, 176, 92], 0.7));
	cv.fill(rx - 26, ry - 5, 52, 10, [120, 44, 52]); cv.fill(rx - 6, ry - 3, 12, 6, [200, 176, 92]);
	cv.grainRect(rx - 62, ry - 15, 124, 30, 6);

	// ---------- LIGHTING PASS ----------
	const winX = 151, winY = 56, lampX = 120, lampY = 80;
	for (let y = 0; y < 200; y++) for (let x = 0; x < 320; x++) {
		const i = (y * 320 + x) * 4; if (cv.px[i + 3] === 0) continue;
		// warm light pool on floor under the window
		if (y > FY && x > 118 && x < 202) {
			const pool = Math.max(0, 1 - Math.abs(x - 158) / 62) * Math.max(0, 1 - (y - FY) / 72);
			cv.addPx(x, y, pool * 34, pool * 30, pool * 16);
		}
		// warm lamp glow
		const dl = Math.hypot(x - lampX, y - lampY);
		if (dl < 60) cv.addPx(x, y, (60 - dl) * 0.5, (60 - dl) * 0.36, (60 - dl) * 0.12);
		// broad cool daylight from the window + corner vignette
		const bright = 1 + Math.max(0, (150 - Math.hypot(x - winX, y - winY)) / 150) * 0.28;
		const vx = (x - 160) / 160, vy = (y - 100) / 100;
		cv.mulPx(x, y, bright * (1 - 0.26 * (vx * vx + vy * vy)));
	}
	cv.grainRect(0, 0, 320, 200, 5); // final film grain

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
