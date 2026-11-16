// Cop Quest — UI art: icon-bar icons, cursors, inventory item icons, and the
// pixel font exported as GDScript data.
//
//   node tools/gen_ui.js
//
// Output -> assets/art/ui/*.png, assets/art/items/*.png, scripts/core/font_data.gd

const fs = require("fs");
const path = require("path");
const { Painter } = require("./paint.js");
const font = require("./font.js");

const ROOT = path.join(__dirname, "..");
const UI = path.join(ROOT, "assets/art/ui");
const ITEMS = path.join(ROOT, "assets/art/items");
fs.mkdirSync(UI, { recursive: true });
fs.mkdirSync(ITEMS, { recursive: true });

const icon = (fn, size = 16) => { const p = new Painter({ w: size, h: size, ss: 4, transparent: true }); fn(p); return p; };
const out = (p, dir, name) => p.save(path.join(dir, name + ".png"), { transparent: true, dither: 0, colors: 64 });

const K = [16, 16, 20], W = [250, 250, 250], GOLD = [230, 190, 60], STEEL = [150, 155, 165], DARK = [50, 52, 58];

// --- verb icons (also used as cursors) ---------------------------------------
const VERBS = {
	walk: (p) => { // little walking man
		p.ellipse(8, 2.5, 2, 2, W); p.line(8, 4.5, 7.5, 9.5, 2.2, W);
		p.line(7.5, 9.5, 5, 14.5, 1.8, W); p.line(7.5, 9.5, 10.5, 14.5, 1.8, W);
		p.line(8, 6, 4.5, 8.5, 1.5, W); p.line(8, 6, 11.5, 7.5, 1.5, W);
		p.line(8, 2.5, 8, 2.5, 0.1, K);
	},
	look: (p) => {
		p.ellipse(8, 8, 7.5, 4.5, W); p.ellipse(8, 8, 3, 3, [60, 110, 170]); p.ellipse(8, 8, 1.4, 1.4, K);
		p.ellipse(7, 7, 0.7, 0.7, W);
	},
	hand: (p) => {
		p.rect(4, 7, 9, 8, [235, 190, 150]);
		for (let i = 0; i < 4; i++) p.rect(4.2 + i * 2.2, 2 + (i === 0 ? 2 : i === 3 ? 1.5 : 0), 1.8, 7, [235, 190, 150]);
		p.line(4, 10, 1.5, 7, 2, [235, 190, 150]);
		p.rect(4, 14, 9, 2, [60, 80, 140]);
	},
	talk: (p) => {
		p.ellipse(8, 7, 7.5, 5.5, W); p.poly([[4, 10], [3, 15], [8, 11]], W);
		p.rect(4.5, 6.3, 7, 1.2, K); p.rect(4.5, 8.3, 5, 1.2, K);
	},
	inv: (p) => { // briefcase
		p.rect(1, 5, 14, 10, [120, 70, 40]); p.rect(1, 5, 14, 2, [150, 95, 55]);
		p.rect(5.5, 2, 5, 1.5, [90, 50, 30]); p.rect(5.5, 2, 1.2, 3.5, [90, 50, 30]); p.rect(9.3, 2, 1.2, 3.5, [90, 50, 30]);
		p.rect(7, 8.5, 2, 2, GOLD);
	},
	settings: (p) => { // slider control panel
		for (let i = 0; i < 3; i++) { p.rect(3 + i * 4.5, 1.5, 1.3, 13, [200, 200, 200]); p.rect(1.5 + i * 4.5, 3 + i * 3.5, 4.3, 3, [220, 60, 50]); }
	},
	help: (p) => { p.ellipse(8, 8, 7, 7, [60, 110, 190]); font.stamp(p, "?", 6, 4.5, W); },
	wait: (p) => { // stopwatch
		p.ellipse(8, 9, 6.5, 6.5, W); p.ellipse(8, 9, 5.2, 5.2, [230, 230, 220]);
		p.rect(7, 0.5, 2, 2.5, W); p.line(8, 9, 8, 5, 1, K); p.line(8, 9, 10.5, 10.5, 1, K);
	},
	arrow: (p) => {
		p.poly([[1, 1], [1, 13], [4.2, 10], [6.5, 15], [8.5, 14], [6.3, 9.3], [10.5, 9.3]], K);
		p.poly([[2, 3], [2, 11], [4.6, 8.6], [7, 13.5], [7.4, 13.2], [5.2, 8.3], [8.3, 8.3]], W);
	},
	exit: (p) => { // exit arrow (walk-to-exit hint cursor)
		p.poly([[2, 6], [9, 6], [9, 2], [15, 8], [9, 14], [9, 10], [2, 10]], [250, 230, 90]);
	},
};
for (const [n, fn] of Object.entries(VERBS)) out(icon(fn), UI, "icon_" + n);

// --- inventory items ------------------------------------------------------------
const bagged = (p) => { p.rect(1, 2, 14, 13, [215, 225, 232], 0.85); p.rect(1, 2, 14, 2.5, [200, 60, 50], 0.9); font.stamp(p, "EV", 4.5, 9, [200, 60, 50], 1, 0.6); };
const ITEMS_DRAW = {
	keys: (p) => { ring(p, 5, 6, 3.4, 2, STEEL); p.line(7, 8, 13, 13, 2.4, [210, 180, 80]); p.rect(11, 11, 1.5, 3, [210, 180, 80]); p.line(6, 8, 7, 14, 2.2, STEEL); p.rect(3.5, 4.5, 3, 3, [40, 40, 40]); p.ellipse(13, 4, 1.4, 1.4, STEEL); p.line(8.5, 5, 12.5, 4, 0.8, STEEL); },
	badge: (p) => { p.rect(1, 3, 14, 11, [70, 40, 30]); p.poly([[8, 4], [12, 6], [11.5, 11], [8, 13], [4.5, 11], [4, 6]], GOLD); p.ellipse(8, 8.5, 1.8, 1.8, [180, 140, 40]); },
	gun: (p) => { p.poly([[1, 5], [14, 5], [14, 8], [8, 8], [7, 14], [3, 14], [4, 8], [1, 8]], DARK); p.rect(2, 5.5, 11, 1, [100, 104, 112]); p.rect(6, 8, 2, 3, [30, 30, 34]); p.rect(3.5, 9, 3, 4, [70, 50, 35]); },
	cuffs: (p) => { ring(p, 4.5, 8, 3.3, 2.2, STEEL); ring(p, 11.5, 8, 3.3, 2.2, STEEL); p.line(7.5, 8, 8.5, 8, 1.6, [200, 200, 210]); p.rect(7.6, 7.3, 1, 1.4, [200, 200, 210]); },
	gloves: (p) => { p.rect(4, 6, 8, 9, [235, 235, 210]); for (let i = 0; i < 4; i++) p.rect(4 + i * 2, 1.5 + (i % 3), 1.6, 6, [235, 235, 210]); p.line(4, 9, 1.5, 6.5, 1.8, [235, 235, 210]); p.rect(4, 13, 8, 2, [200, 200, 175]); },
	bags: (p) => { p.rect(2, 2, 12, 12, [220, 230, 235], 0.75); p.rect(4, 4, 12, 11, [235, 240, 245], 0.8); p.rect(4, 4, 12, 2.5, [200, 60, 50]); font.stamp(p, "EV", 6, 8, [200, 60, 50], 1, 0.8); },
	camera: (p) => { p.rect(1, 5, 14, 9, [40, 40, 44]); p.rect(3, 3, 4, 2, [40, 40, 44]); p.ellipse(9, 9.5, 3.4, 3.4, [140, 140, 150]); p.ellipse(9, 9.5, 2, 2, [40, 60, 90]); p.rect(12, 6, 2, 1.5, [230, 230, 230]); },
	flashlight: (p) => { p.line(2, 13, 10, 5, 3.2, [40, 40, 46]); p.poly([[9, 3], [13, 7], [15, 4], [12, 1]], [70, 70, 76]); p.line(12.5, 2.5, 14, 4, 1.4, [255, 250, 190]); },
	radio: (p) => { p.rect(4, 4, 8, 11, [30, 30, 34]); p.rect(9, 0.5, 1.5, 4, [30, 30, 34]); p.rect(5.5, 6, 5, 3, [120, 140, 110]); for (let i = 0; i < 3; i++) p.rect(5.5, 10.5 + i * 1.4, 5, 0.7, [90, 90, 90]); },
	vest: (p) => { p.poly([[3, 2], [6, 2], [8, 4], [10, 2], [13, 2], [14, 15], [2, 15]], [44, 50, 66]); p.rect(4, 8, 8, 3, [220, 220, 210]); p.rect(3, 13, 10, 1, [30, 30, 40]); },
	casing: (p) => { bagged(p); p.rect(6, 5, 4, 7, [215, 175, 70]); p.rect(6, 5, 4, 1, [180, 140, 50]); },
	slug: (p) => { bagged(p); p.ellipse(8, 8, 2.5, 3.5, [170, 150, 120]); p.rect(5.5, 8, 5, 3.5, [150, 130, 100]); },
	union_card: (p) => { p.rect(1, 3, 14, 10, [240, 238, 225]); p.rect(1, 3, 14, 3, [40, 80, 150]); p.rect(2.5, 7, 4, 5, [190, 150, 120]); p.rect(8, 7.5, 6, 1, [80, 80, 80]); p.rect(8, 9.5, 5, 1, [80, 80, 80]); },
	matchbook: (p) => { p.rect(3, 2, 10, 13, [160, 30, 30]); p.rect(3, 11, 10, 4, [230, 220, 200]); p.ellipse(8, 6.5, 3, 3, [230, 210, 120]); p.ellipse(8, 6.5, 1.6, 1.6, [160, 30, 30]); },
	warrant: (p) => { p.rect(2, 1, 12, 14, [245, 242, 230]); p.rect(2, 1, 12, 3, [60, 60, 90]); for (let i = 0; i < 4; i++) p.rect(4, 6 + i * 2, 8 - (i % 2) * 2, 0.8, [80, 80, 80]); p.ellipse(11, 13, 2, 2, [200, 50, 50]); },
	ballistics: (p) => { p.rect(2, 1, 12, 14, [245, 242, 230]); p.ellipse(6, 6, 2.4, 2.4, [120, 120, 130]); p.ellipse(10, 6, 2.4, 2.4, [120, 120, 130]); p.line(6, 6, 10, 6, 0.6, [200, 50, 50]); for (let i = 0; i < 3; i++) p.rect(4, 10 + i * 1.6, 8, 0.7, [80, 80, 80]); },
	autopsy: (p) => { p.rect(2, 1, 12, 14, [235, 240, 245]); p.rect(2, 1, 12, 2.5, [40, 110, 110]); person(p); for (let i = 0; i < 3; i++) p.rect(9, 6 + i * 2, 4, 0.7, [80, 80, 80]); },
	notebook: (p) => { p.rect(3, 1, 11, 14, [40, 50, 80]); p.rect(4, 2, 9, 12, [245, 240, 200]); for (let i = 0; i < 5; i++) p.rect(5, 4 + i * 2, 7, 0.6, [120, 140, 200]); p.rect(3, 1, 1.5, 14, [30, 30, 40]); },
	beer: (p) => { p.rect(5, 3, 6, 12, [200, 140, 40], 0.85); p.rect(5, 3, 6, 3, [250, 250, 240]); p.rect(11, 6, 2, 6, [200, 200, 200], 0.5); },
};
function ring(p, cx, cy, r, w, c) { for (let a = 0; a < 24; a++) { const a0 = a / 24 * Math.PI * 2, a1 = (a + 1) / 24 * Math.PI * 2; p.line(cx + Math.cos(a0) * r, cy + Math.sin(a0) * r, cx + Math.cos(a1) * r, cy + Math.sin(a1) * r, w, c); } }
function person(p) { p.ellipse(5.5, 5.5, 1.3, 1.3, [100, 100, 100]); p.rect(4.5, 7, 2, 5, [100, 100, 100]); }
for (const [n, fn] of Object.entries(ITEMS_DRAW)) out(icon(fn), ITEMS, n);

// --- font as GDScript ----------------------------------------------------------------
let gd = "## AUTO-GENERATED by tools/gen_ui.js from tools/font.js — do not edit.\n";
gd += "## Proportional SCI-style pixel font: rows of '#' ink, rows 0-6 sit on the\n## baseline, 7-8 are descenders.\nextends RefCounted\n\nconst ROWS := 9\n\nconst GLYPHS := {\n";
for (const [ch, rows] of Object.entries(font.G)) gd += `\t${ch.charCodeAt(0)}: [${rows.map(r => '"' + r + '"').join(", ")}],\n`;
gd += "}\n";
fs.writeFileSync(path.join(ROOT, "scripts/core/font_data.gd"), gd);
console.log("ui icons, item icons, font_data.gd written");
