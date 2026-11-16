// Cop Quest — room background painter.
//
// Paints every location of "Dead Reckoning" as a 320x200, 256-color
// "digitized" VGA picture (PQ4 look) plus transparent full-screen prop /
// occluder overlays.
//
//   node tools/gen_rooms.js            (all rooms)
//   node tools/gen_rooms.js marina     (one room)
//
// Output -> assets/art/bg/<room>.png, assets/art/props/<room>_<prop>.png
//
// The coordinates here are mirrored by the room scripts in scripts/rooms/*.gd
// (hotspots, walk areas, occluder baselines). Change both together.

const fs = require("fs");
const path = require("path");
const { Painter, tex, fbm, hash, mix, mul, clamp } = require("./paint.js");
const { decodePNG, areaResize } = require("./pixelate.js");
const font = require("./font.js");

const ROOT = path.join(__dirname, "..");
const BG = path.join(ROOT, "assets/art/bg");
const PROPS = path.join(ROOT, "assets/art/props");
fs.mkdirSync(BG, { recursive: true });
fs.mkdirSync(PROPS, { recursive: true });

const save = (p, name) => { p.save(path.join(BG, name + ".png")); console.log("bg/" + name); };
const saveProp = (p, name) => { p.save(path.join(PROPS, name + ".png"), { transparent: true, dither: 3 }); console.log("props/" + name); };
const overlay = () => new Painter({ transparent: true });

// ---------------------------------------------------------------------------
// Shared objects
// ---------------------------------------------------------------------------
function box3d(p, x, y, w, h, d, base = [176, 134, 84], label) {
	const dx = d * 0.55, dy = d * 0.45;
	p.ellipse(x + w / 2 + dx / 2, y + h, w / 2 + dx, 3, [0, 0, 0], 0.25);
	p.rect(x, y, w, h, tex.noise(base, 0.08, 0.6, x));
	p.poly([[x, y], [x + w, y], [x + w + dx, y - dy], [x + dx, y - dy]], tex.noise(mul(base, 1.15), 0.06, 0.6, y));
	p.poly([[x + w, y], [x + w + dx, y - dy], [x + w + dx, y + h - dy], [x + w, y + h]], tex.noise(mul(base, 0.72), 0.06, 0.6, w));
	// packing tape
	p.poly([[x + w * 0.45, y], [x + w * 0.55, y], [x + w * 0.55 + dx, y - dy], [x + w * 0.45 + dx, y - dy]], [200, 170, 120], 0.8);
	p.rect(x + w * 0.45, y, w * 0.1, h * 0.35, [200, 170, 120], 0.6);
	if (label) font.stamp(p, label, x + 2, y + h - 9, [40, 30, 30], 1, 0.75);
}

// Side-view automobile. facing 'left' => front of the car at x.
function car(p, o) {
	const { x, ground, len } = o, type = o.type || "sedan";
	const L = (u) => o.facing === "right" ? x + len - u : x + u;
	const Y = (v) => ground - v;
	const P = (arr) => arr.map(([u, v]) => [L(u), Y(v)]);
	const tall = type === "suv" ? 1.25 : 1;
	const belt = 26 * tall, roof = (type === "suv" ? 58 : 44), bottom = 7;
	const col = o.color;
	// shadow
	p.ellipse(x + len / 2, ground + 1, len / 2 + 6, 5, [0, 0, 0], 0.45);
	// lower body
	const body = P([[1, bottom + 3], [0, belt - 6], [4, belt], [len - 3, belt + (type === "sedan" ? 1 : 0)], [len, belt - 6], [len - 1, bottom + 3], [len - 6, bottom], [6, bottom]]);
	const bodyShade = (xx, yy) => {
		const t = clamp((ground - yy - bottom) / (belt - bottom), 0, 1);
		return mul(col, 0.55 + t * 0.6 + (t > 0.85 ? 0.25 : 0));
	};
	p.poly(body, bodyShade);
	if (type === "patrol") p.poly(P([[38, bottom + 2], [38, belt], [len - 36, belt], [len - 36, bottom + 2]]), (xx, yy) => mul([235, 235, 235], 0.7 + clamp((ground - yy) / belt, 0, 1) * 0.35));
	// cabin
	let cabin;
	if (type === "wagon") cabin = [[34, belt], [50, roof], [len - 8, roof], [len - 4, belt]];
	else if (type === "suv") cabin = [[30, belt], [40, roof], [len - 6, roof], [len - 4, belt]];
	else cabin = [[36, belt], [52, roof], [len - 42, roof], [len - 26, belt]];
	p.poly(P(cabin), (xx, yy) => mul(col, 0.8 + clamp((ground - yy - belt) / (roof - belt), 0, 1) * 0.3));
	// windows (glass reflects the sky)
	const g0 = cabin[0][0] + 4, g1 = cabin[3][0] - 4, gt = roof - 3, gb = belt + 2;
	const glass = (xx, yy) => mix(o.glassTop || [150, 170, 190], o.glassBot || [40, 50, 66], clamp((Y(gb) - yy) / -(gt - gb) + 1, 0, 1));
	const pillarU = (cabin[1][0] + cabin[2][0]) / 2;
	p.poly(P([[g0, gb], [cabin[1][0] + 3, gt], [pillarU - 2, gt], [pillarU - 2, gb]]), glass);
	p.poly(P([[pillarU + 2, gb], [pillarU + 2, gt], [cabin[2][0] - 2, gt], [g1, gb]]), glass);
	if (o.head) { // slumped driver (front window)
		const hx = L(pillarU - 12), hy = Y(belt + 8);
		p.ellipse(hx, hy, 4, 4.5, [150, 105, 80]);
		p.ellipse(hx + (o.facing === "right" ? 1 : -1), hy - 2.5, 4.2, 2.5, [30, 25, 20]);
		p.rect(hx - 6, hy + 3, 12, 6, [70, 80, 110]);
	}
	// door seams + handle + chrome strip
	for (const u of [pillarU - 24, pillarU, pillarU + 24]) if (u > 30 && u < len - 20) p.line(L(u), Y(belt), L(u), Y(bottom + 3), 0.6, [0, 0, 0], 0.45);
	p.line(L(4), Y(bottom + 10), L(len - 4), Y(bottom + 10), 1, [200, 205, 210], 0.55);
	p.rect(L(pillarU - 6) - 2, Y(belt - 4), 4, 1.2, [210, 210, 210]);
	// bumpers
	p.rect(Math.min(L(-2), L(10)), Y(bottom + 6), 12, 4, [190, 190, 195]);
	p.rect(Math.min(L(len + 2), L(len - 10)), Y(bottom + 6), 12, 4, [190, 190, 195]);
	// lights
	p.rect(Math.min(L(0), L(3)), Y(belt - 3), 3, 4, o.night ? [255, 250, 200] : [235, 230, 200]);
	p.rect(Math.min(L(len), L(len - 3)), Y(belt - 3), 3, 4, [190, 30, 30]);
	// wheels
	for (const u of [24, len - 26]) {
		const cx = L(u), cy = Y(10);
		p.ellipse(cx, cy - 1, 13, 11, mul(col, 0.25)); // wheel well
		p.ellipse(cx, cy, 10, 10, [22, 22, 24]);
		p.ellipse(cx, cy, 5.5, 5.5, [150, 150, 158]);
		p.ellipse(cx, cy, 2, 2, [60, 60, 64]);
	}
	if (type === "patrol") {
		const u0 = cabin[1][0] + 6, u1 = cabin[2][0] - 6;
		p.rect(Math.min(L(u0), L(u1)), Y(roof + 4), Math.abs(L(u1) - L(u0)), 4, [40, 40, 44]);
		const lx = Math.min(L(u0), L(u1)), lw = Math.abs(L(u1) - L(u0));
		p.rect(lx + 1, Y(roof + 4), lw / 2 - 1, 3, [220, 40, 40]);
		p.rect(lx + lw / 2, Y(roof + 4), lw / 2 - 1, 3, [50, 80, 230]);
		if (o.lightsOn) { p.light(lx + lw / 4, Y(roof + 2), 30, 16, [255, 40, 40], 0.9); p.light(lx + lw * 0.75, Y(roof + 2), 30, 16, [60, 90, 255], 0.9); }
		font.stamp(p, "POLICE", Math.min(L(48), L(len - 48)) + 2, Y(belt - 6), [30, 30, 60]);
	}
	if (type === "suv") { p.rect(Math.min(L(len - 1), L(len + 5)), Y(bottom + 20), 6, 14, [30, 30, 30]); } // spare tire
}

function person_silhouette(p, x, y, h, c, a = 1) {
	p.ellipse(x, y - h + h * 0.08, h * 0.08, h * 0.09, c, a);
	p.poly([[x - h * 0.13, y - h * 0.82], [x + h * 0.13, y - h * 0.82], [x + h * 0.1, y - h * 0.45], [x + h * 0.08, y], [x - h * 0.08, y], [x - h * 0.1, y - h * 0.45]], c, a);
}

function fluorescent(p, x, y, w, h) {
	p.rect(x, y, w, h, [235, 240, 235]);
	p.rect(x, y + h, w, 1, [150, 150, 150]);
}

function blinds(p, x, y, w, h, outside) {
	p.rect(x - 2, y - 2, w + 4, h + 4, [190, 185, 170]);
	p.rect(x, y, w, h, outside);
	for (let yy = y; yy < y + h; yy += 2.5) p.rect(x, yy, w, 1.3, (xx, y2) => mul([225, 222, 205], 0.85 + 0.15 * Math.sin(xx * 0.1)), 0.9);
	p.rect(x - 3, y + h + 1, w + 6, 2, [210, 205, 190]);
}

// ---------------------------------------------------------------------------
// Rooms
// ---------------------------------------------------------------------------
const ROOMS = {};

// --- Bedroom (from the photo) ------------------------------------------------
// Mattress (0,162)-(64,158)-(84,188)-(0,198). Phone box x4..38 y132..150.
// Lockbox x196..214 y136..145. Clothes box x228..262 y122..142.
// Box stack x266..302 y100..148. Door x83..130 y43..128.
ROOMS.bedroom = () => {
	const photo = decodePNG(fs.readFileSync(path.join(ROOT, "assets/art/bedroom_bg.png")));
	const small = photo.w === 320 ? photo : areaResize(photo, 640, 400);
	const p = new Painter();
	p.image(small, 0, 0, 320, 200);
	// moody early-morning grade (it's 5:40 a.m.)
	p.shadeRect(0, 0, 320, 200, (x, y) => 0.78 + 0.12 * (x / 320));
	p.light(215, 75, 120, 70, [70, 60, 40], 0.35);
	// mattress on the floor
	p.ellipse(42, 192, 50, 8, [0, 0, 0], 0.3);
	p.poly([[0, 196], [86, 186], [86, 191], [0, 202]], [150, 150, 165]);
	p.poly([[0, 162], [64, 158], [86, 186], [0, 196]], tex.noise([228, 226, 220], 0.08, 0.4));
	p.poly([[22, 170], [66, 162], [86, 186], [0, 196], [0, 176]], (x, y) => mul([80, 100, 150], 0.82 + fbm(x * 0.15, y * 0.3, 3, 3) * 0.4));
	p.ellipse(18, 166, 15, 5, tex.noise([240, 240, 236], 0.05));
	p.ellipse(44, 163, 12, 4, tex.noise([236, 236, 230], 0.05));
	// phone box
	box3d(p, 4, 132, 34, 18, 10, [176, 134, 84], "MISC");
	p.rect(9, 123, 15, 6, [205, 195, 170]); p.rect(10, 120, 13, 3, [190, 180, 155]); // phone base + handset
	p.rect(12, 124, 9, 2, [120, 115, 100]);
	// lockbox
	p.ellipse(205, 145, 11, 2, [0, 0, 0], 0.3);
	p.rect(196, 138, 18, 7, [62, 64, 70]); p.poly([[196, 138], [214, 138], [218, 135], [200, 135]], [92, 95, 100]);
	p.rect(203, 140, 4, 3, [190, 170, 60]);
	// clothes box (open flaps, a blue shirt inside)
	box3d(p, 228, 122, 34, 20, 10, [168, 126, 78], "GABE");
	p.poly([[228, 122], [233.5, 117.5], [226, 108], [221, 114]], [186, 144, 92]);
	p.poly([[262, 122], [267.5, 117.5], [274, 110], [268, 116]], [150, 112, 70]);
	p.poly([[233, 120], [258, 120], [262, 117], [237, 117]], [120, 150, 200]);
	p.rect(244, 112, 4, 10, [130, 160, 205]);
	p.rect(240, 127, 8, 6, [245, 245, 235]); p.rect(241, 129, 6, 1, [90, 90, 160]); p.rect(241, 131, 4, 1, [90, 90, 160]); // Elena's note
	// box stack
	box3d(p, 266, 128, 36, 20, 10, [170, 130, 82], "BOOKS");
	box3d(p, 268, 108, 32, 18, 9, [182, 140, 90], "KITCHEN");
	p.grain(4).vignette(0.3);
	save(p, "bedroom");
	// props: keys + badge on the phone box
	let k = overlay();
	k.ellipse(30, 128.5, 2, 1.2, [200, 200, 205]); k.rect(31, 128, 4, 1, [190, 170, 80]); k.rect(28, 129, 2, 1, [150, 150, 160]);
	saveProp(k, "bedroom_keys");
	let b = overlay();
	b.poly([[36, 127], [40, 127], [40, 130], [38, 131.5], [36, 130]], [225, 190, 70]); b.rect(37.5, 128, 1, 1, [255, 240, 160]);
	saveProp(b, "bedroom_badge");
};

// --- Driveway -----------------------------------------------------------------
// House x0..160; front door x22..44 y88..138; car x172..300 ground 168 (left facing);
// trunk at x 272..300; driver door x 214..238.
ROOMS.driveway = () => {
	const p = new Painter();
	p.rect(0, 0, 320, 110, tex.vgrad([92, 140, 205], [205, 215, 225], 0, 105));
	for (let i = 0; i < 4; i++) p.ellipse(60 + i * 80, 22 + (i % 2) * 10, 40, 7, (x, y) => [255, 255, 255, 0.3 + fbm(x * 0.08, y * 0.2, 3, i) * 0.4]);
	// hills + neighbor roofs
	p.poly([[0, 92], [60, 80], [140, 86], [220, 76], [320, 88], [320, 110], [0, 110]], tex.noise([120, 135, 120], 0.15, 0.1));
	for (let i = 0; i < 6; i++) { const x0 = 150 + i * 30; p.poly([[x0, 98], [x0 + 14, 90], [x0 + 28, 98]], [150, 90, 70]); p.rect(x0 + 2, 98, 24, 10, [220, 210, 190]); }
	// lawn + driveway + sidewalk + street
	p.rect(0, 108, 320, 92, tex.noise([86, 130, 60], 0.3, 0.9, 2));
	p.poly([[78, 140], [150, 140], [320, 168], [320, 186], [40, 186]], tex.noise([182, 180, 172], 0.08, 0.4));
	for (let i = 0; i < 5; i++) p.line(90 + i * 40, 141 + i * 6, 60 + i * 60, 186, 0.6, [120, 118, 110], 0.4);
	p.rect(0, 186, 320, 7, tex.noise([196, 194, 186], 0.06));
	p.rect(0, 193, 320, 7, tex.noise([70, 72, 76], 0.15, 1));
	// palm tree
	p.line(304, 150, 296, 22, 5, (x, y) => mul([130, 105, 80], 0.8 + 0.3 * Math.sin(y * 1.2)));
	for (let a = 0; a < 9; a++) { const ang = a / 9 * Math.PI * 2; p.line(296, 22, 296 + Math.cos(ang) * 30, 22 + Math.sin(ang) * 14 + 8, 3, [60, 110, 50]); }
	// house
	p.rect(0, 50, 160, 92, tex.stucco([228, 214, 188]));
	p.poly([[-8, 54], [70, 22], [170, 54]], tex.noise([170, 82, 60], 0.2, 0.9));
	p.shadePoly([[-8, 54], [70, 22], [170, 54]], (x, y) => ((y % 4) < 0.6 ? 0.7 : 1));
	p.rect(-8, 52, 178, 4, [120, 70, 50]);
	p.shadeRect(0, 56, 160, 8, 0.75);
	// garage door
	p.rect(80, 82, 66, 58, tex.noise([236, 232, 222], 0.05));
	for (let yy = 82; yy < 140; yy += 11.6) p.rect(80, yy, 66, 1, [180, 175, 165]);
	// front door + window
	p.rect(20, 86, 26, 54, [90, 60, 40]); p.rect(22, 88, 22, 50, tex.wood([120, 72, 44], true, 5));
	p.rect(28, 92, 10, 8, [170, 200, 220]); p.rect(40, 112, 2, 3, [220, 200, 120]);
	p.rect(18, 138, 30, 4, [170, 165, 160]);
	p.rect(52, 92, 22, 22, [160, 190, 215]); p.rect(62, 92, 1.5, 22, [240, 240, 240]); p.rect(52, 102, 22, 1.5, [240, 240, 240]);
	p.rect(48, 90, 4, 26, [70, 90, 70]); p.rect(74, 90, 4, 26, [70, 90, 70]);
	font.stamp(p, "1418", 4, 100, [60, 40, 30]);
	// shrubs
	for (let i = 0; i < 4; i++) p.ellipse(4 + i * 16 + (i > 0 ? 40 : 0), 140, 9, 6, tex.noise([50, 92, 44], 0.4, 0.8, i));
	// the car: unmarked dark blue sedan
	car(p, { x: 172, ground: 168, len: 130, color: [40, 52, 88], facing: "left", type: "sedan" });
	p.vignette(0.2).grain(4);
	save(p, "driveway");
	// trunk-open prop
	const t = overlay();
	t.poly([[268, 142], [302, 142], [306, 118], [276, 116]], [34, 44, 74]);
	t.poly([[271, 141], [299, 141], [302, 121], [278, 119]], [20, 20, 24]);
	saveProp(t, "driveway_trunk");
};

// --- City map -----------------------------------------------------------------
ROOMS.map = () => {
	const p = new Painter();
	// land / sea
	const coast = (y) => 70 + Math.sin(y * 0.05) * 12 + fbm(1, y * 0.05, 3) * 22 - (y > 130 ? (y - 130) * 0.5 : 0);
	p.rect(0, 0, 320, 200, (x, y) => x < coast(y) ? mul([40, 80, 130], 0.85 + fbm(x * 0.05, y * 0.05, 3, 4) * 0.3) : mul([214, 204, 172], 0.9 + fbm(x * 0.04, y * 0.04, 3) * 0.2));
	// beach line
	p.rect(0, 0, 320, 200, (x, y) => { const d = x - coast(y); return d >= 0 && d < 3 ? [230, 220, 180] : null; });
	// street grid
	p.rect(0, 0, 320, 200, (x, y) => { if (x < coast(y) + 4) return null; const gx = (x - (y * 0.05)) % 18, gy = (y + x * 0.0235) % 16; return gx < 0.9 || gy < 0.9 ? [250, 248, 238] : null; }, 0.85);
	// freeway
	p.line(140, 0, 300, 200, 3.2, [235, 170, 60]);
	p.line(80, 60, 320, 30, 2.6, [235, 170, 60]);
	// parks
	p.ellipse(250, 70, 22, 12, tex.noise([110, 160, 90], 0.2));
	p.ellipse(160, 130, 14, 9, tex.noise([110, 160, 90], 0.2));
	// harbor piers
	for (let i = 0; i < 6; i++) p.rect(30 + i * 9, 150 + i * 3, 5, 26, [190, 180, 160]);
	p.rect(20, 176, 80, 8, [180, 170, 150]);
	// frame + legend strip
	p.rect(0, 0, 320, 12, [30, 34, 52]);
	p.rect(0, 188, 320, 12, [30, 34, 52]);
	font.stamp(p, "MESA VERDE, CA   -   UNIT 2-HENRY-9 MOBILE MAP", 6, 3, [220, 210, 160]);
	p.vignette(0.25).grain(5);
	save(p, "map");
};

// --- Pier 9 marina (dawn crime scene) ----------------------------------------
// Patrol car x 8..124 ground 150 (right-facing). Wagon x 180..312 ground 142 (left).
// Tape posts at x150 and x316. Casing at (172,150).
ROOMS.marina = () => {
	const p = new Painter();
	p.rect(0, 0, 320, 80, (x, y) => { const t = y / 80; return mix(mix([46, 52, 100], [210, 120, 110], t * t), [250, 170, 110], Math.max(0, 1 - Math.hypot(x - 250, y - 80) / 90) * 0.7); });
	p.ellipse(250, 79, 10, 6, [255, 210, 150]);
	p.poly([[0, 74], [60, 66], [120, 70], [200, 64], [320, 72], [320, 82], [0, 82]], [70, 50, 80]);
	// water
	p.rect(0, 80, 320, 26, (x, y) => {
		const base = mix([90, 70, 100], [30, 50, 80], (y - 80) / 26), w = Math.sin(x * 0.4 + y * 2.1) * 0.5 + 0.5;
		const sun = Math.max(0, 1 - Math.abs(x - 250) / 18) * (w > 0.6 ? 1 : 0.2);
		return mix(mul(base, 0.85 + w * 0.25), [255, 190, 130], sun * 0.8);
	});
	// boats & masts
	for (let i = 0; i < 7; i++) {
		const bx = 20 + i * 44 + (i % 2) * 9, by = 96;
		p.line(bx + 10, by - 2, bx + 10, by - 50 - (i % 3) * 8, 0.8, [190, 180, 190]);
		p.line(bx + 10, by - 48, bx + 22, by - 6, 0.4, [150, 140, 150], 0.7);
		p.poly([[bx, by - 4], [bx + 26, by - 4], [bx + 22, by + 1], [bx + 3, by + 1]], [225, 220, 220]);
		p.rect(bx + 6, by - 8, 10, 4, [200, 195, 200]);
	}
	// seawall + rail
	p.rect(0, 102, 320, 6, tex.noise([150, 140, 140], 0.15));
	p.rect(0, 96, 320, 1.2, [120, 110, 120]); for (let x = 4; x < 320; x += 16) p.rect(x, 96, 1.4, 7, [120, 110, 120]);
	// lot (asphalt in perspective)
	p.rect(0, 108, 320, 92, (x, y) => mul([62, 60, 66], 0.85 + (y - 108) / 400 + (fbm(x * 0.3, y * 0.6, 3, 8) - 0.5) * 0.25));
	for (let i = -3; i < 9; i++) p.line(i * 44 + 30, 110, i * 60 + 10, 200, 1.2, [200, 195, 170], 0.45);
	// lamp post (still lit)
	p.rect(132, 30, 2.5, 82, [70, 70, 76]); p.rect(126, 28, 14, 3, [80, 80, 86]);
	p.light(133, 34, 26, 18, [255, 200, 120], 0.8);
	// cars
	car(p, { x: 8, ground: 150, len: 116, color: [30, 30, 34], facing: "right", type: "patrol", lightsOn: true });
	car(p, { x: 180, ground: 142, len: 132, color: [110, 40, 36], facing: "left", type: "wagon", head: true, glassTop: [200, 150, 140] });
	// crime tape
	for (const [px, py] of [[150, 152], [316, 146]]) { p.rect(px - 1, py - 26, 2.4, 26, [210, 170, 40]); p.ellipse(px, py, 4, 1.5, [0, 0, 0], 0.3); }
	const tape = (x0, y0, x1, y1) => { for (let i = 0; i < 40; i++) { const t0 = i / 40, t1 = (i + 1) / 40, s0 = Math.sin(t0 * Math.PI) * 5, s1 = Math.sin(t1 * Math.PI) * 5; p.line(x0 + (x1 - x0) * t0, y0 + (y1 - y0) * t0 + s0, x0 + (x1 - x0) * t1, y0 + (y1 - y0) * t1 + s1, 1.6, i % 4 === 0 ? [30, 30, 20] : [245, 215, 40]); } };
	tape(150, 128, 316, 122);
	p.light(250, 80, 120, 40, [255, 160, 80], 0.25);
	p.vignette(0.3).grain(5);
	save(p, "marina");
	const c = overlay();
	c.rect(171, 149, 2.4, 1.2, [220, 180, 80]); c.rect(171.5, 149, 1, 0.6, [255, 240, 170]);
	saveProp(c, "marina_casing");
};

// --- Homicide squad room ------------------------------------------------------
// Back wall x50..290 y20..118. Stairwell door (left wall) x14..38 y56..132.
// Kessler's door x240..280 y46..118. Gabe's desk front-left (occluder, base 172).
// Pruitt's desk x178..262 y126..150 (occluder, base 150). Computer x70..100 y112..140.
const squadDesk = (p, pts, top, base) => {
	p.poly(pts.front, tex.noise([110, 118, 112], 0.08));
	p.poly(pts.top, tex.noise([150, 158, 150], 0.05));
	p.line(pts.top[3][0], pts.top[3][1], pts.top[2][0], pts.top[2][1], 1, [200, 205, 195]);
};
ROOMS.squad = () => {
	const p = new Painter();
	const wall = [196, 196, 174];
	p.rect(0, 0, 320, 200, tex.noise(wall, 0.05));
	// ceiling
	p.poly([[0, 0], [320, 0], [290, 20], [50, 20]], tex.tiles([215, 215, 205], [170, 170, 160], 10));
	fluorescent(p, 110, 6, 40, 4); fluorescent(p, 190, 6, 40, 4);
	// side walls
	p.poly([[0, 0], [50, 20], [50, 118], [0, 152]], tex.noise(mul(wall, 0.82), 0.05));
	p.poly([[290, 20], [320, 0], [320, 142], [290, 118]], tex.noise(mul(wall, 0.78), 0.05));
	// floor
	p.poly([[0, 152], [50, 118], [290, 118], [320, 142], [320, 200], [0, 200]], tex.carpet([88, 98, 112], 1.6));
	p.rect(50, 116, 240, 2, [90, 90, 84]);
	// windows w/ blinds
	blinds(p, 62, 34, 52, 44, [170, 200, 230]); blinds(p, 126, 34, 52, 44, [170, 200, 230]);
	// bulletin board + city map
	p.rect(190, 38, 38, 32, tex.noise([160, 120, 80], 0.2, 1.5)); p.rect(188, 36, 42, 2, [100, 70, 40]);
	for (let i = 0; i < 7; i++) p.rect(193 + (i * 11) % 30, 41 + Math.floor(i / 3) * 9, 7, 8, [240 - i * 5, 238, 225]);
	p.rect(206, 49, 10, 8, [230, 230, 120]);
	// Kessler's office door
	p.rect(238, 44, 44, 74, [120, 110, 90]);
	p.rect(242, 48, 36, 70, tex.wood([150, 110, 70], true, 6));
	p.rect(248, 54, 24, 24, [205, 215, 210]); font.stamp(p, "LT.", 251, 58, [40, 40, 40]); font.stamp(p, "KESSLER", 249, 67, [40, 40, 40], 1, 0.9);
	p.rect(272, 84, 3, 3, [220, 200, 120]);
	// stairwell door on left wall
	p.poly([[14, 58], [38, 50], [38, 128], [14, 140]], [100, 105, 100]);
	p.poly([[17, 61], [35, 54], [35, 127], [17, 137]], tex.noise([140, 75, 60], 0.08));
	font.stamp(p, "B1", 21, 68, [240, 240, 230]);
	// filing cabinet + coffee maker (right wall)
	p.poly([[292, 72], [312, 62], [312, 140], [292, 120]], tex.noise([120, 125, 120], 0.06));
	for (let i = 0; i < 3; i++) p.line(293, 82 + i * 13, 311, 74 + i * 15, 0.8, [80, 80, 80]);
	p.rect(296, 50, 12, 16, [40, 40, 40]); p.rect(298, 58, 8, 6, [90, 50, 30], 0.9);
	// Pruitt's desk (mid right) + Gabe's desk (front left) drawn into the bg too
	const pd = { top: [[178, 126], [262, 126], [266, 134], [174, 134]], front: [[174, 134], [266, 134], [266, 150], [174, 150]] };
	squadDesk(p, pd);
	p.rect(186, 116, 16, 11, [210, 205, 180]); p.rect(188, 118, 12, 7, [40, 70, 40]); // Pruitt's terminal
	p.rect(230, 120, 22, 7, [235, 232, 220]); // paper piles
	const gd = { top: [[44, 140], [160, 140], [168, 156], [36, 156]], front: [[36, 156], [168, 156], [168, 182], [36, 182]] };
	squadDesk(p, gd);
	// Gabe's computer (CRT) + keyboard + phone + files
	p.rect(68, 110, 34, 30, [205, 198, 172]); p.rect(72, 113, 26, 20, [20, 40, 24]);
	for (let i = 0; i < 5; i++) p.rect(74, 115 + i * 3.5, 6 + (i * 7) % 16, 1.2, [90, 230, 110]);
	p.rect(76, 140, 18, 6, [210, 205, 185]); p.rect(70, 146, 32, 6, [190, 185, 165]);
	p.rect(118, 140, 14, 6, [40, 40, 44]); p.rect(119, 137, 12, 3, [55, 55, 60]);
	p.rect(140, 141, 18, 8, [230, 220, 170]); p.rect(141, 140, 18, 2, [200, 120, 80]);
	// nameplate
	p.rect(110, 158, 30, 9, [60, 50, 30]); font.stamp(p, "NAVARRO", 111, 159, [220, 200, 140], 1, 0.8);
	p.light(130, 6, 90, 40, [60, 60, 50], 0.4); p.light(210, 6, 90, 40, [60, 60, 50], 0.4);
	p.vignette(0.3).grain(4);
	save(p, "squad");
	// occluders
	const o1 = overlay(); squadDesk(o1, gd);
	o1.rect(68, 110, 34, 30, [205, 198, 172]); o1.rect(72, 113, 26, 20, [20, 40, 24]);
	for (let i = 0; i < 5; i++) o1.rect(74, 115 + i * 3.5, 6 + (i * 7) % 16, 1.2, [90, 230, 110]);
	o1.rect(76, 140, 18, 6, [210, 205, 185]); o1.rect(70, 146, 32, 6, [190, 185, 165]);
	o1.rect(118, 140, 14, 6, [40, 40, 44]); o1.rect(119, 137, 12, 3, [55, 55, 60]);
	o1.rect(140, 141, 18, 8, [230, 220, 170]); o1.rect(110, 158, 30, 9, [60, 50, 30]); font.stamp(o1, "NAVARRO", 111, 159, [220, 200, 140], 1, 0.8);
	saveProp(o1, "squad_desk_gabe");
	const o2 = overlay(); squadDesk(o2, pd);
	o2.rect(186, 116, 16, 11, [210, 205, 180]); o2.rect(188, 118, 12, 7, [40, 70, 40]); o2.rect(230, 120, 22, 7, [235, 232, 220]);
	saveProp(o2, "squad_desk_pruitt");
};

// --- Basement: Property & Evidence / Crime Lab --------------------------------
// Back wall x 50..270, y 14..112. Property window x 70..148 y 46..96 (cage mesh).
// Lab window x 172..250 y 46..96. Counter ledge y 96..104. Stairs door x 10..38.
ROOMS.basement = () => {
	const paintRoomBehind = (p) => {
		// spaces behind the windows: shelves of evidence / lab equipment
		p.rect(70, 46, 78, 50, tex.noise([70, 66, 60], 0.1));
		for (let s = 0; s < 3; s++) { p.rect(72, 56 + s * 14, 74, 1.5, [120, 110, 90]); for (let i = 0; i < 9; i++) p.rect(74 + i * 8, 48 + s * 14, 6, 7.5, [150 + (i * 17) % 60, 120 + (i * 11) % 40, 80]); }
		p.rect(172, 46, 78, 50, tex.noise([200, 210, 212], 0.05));
		p.rect(176, 76, 70, 3, [150, 150, 155]); p.rect(184, 66, 12, 10, [60, 60, 70]); p.rect(214, 62, 18, 14, [200, 200, 205]); p.rect(216, 64, 14, 8, [40, 80, 60]);
	};
	const wallLayer = (p, holes) => {
		const notHole = (x, y) => !(holes && ((x >= 70 && x < 148 && y >= 46 && y < 96) || (x >= 172 && x < 250 && y >= 46 && y < 96)));
		const block = tex.brick([196, 192, 176], [160, 156, 142], 14, 6);
		p._span(50, 14, 270, 112, notHole, block, 1);
		// window frames + signs
		for (const wx of [70, 172]) { p.rect(wx - 3, 43, 84, 3, [90, 92, 96]); p.rect(wx - 3, 43, 3, 56, [90, 92, 96]); p.rect(wx + 78, 43, 3, 56, [90, 92, 96]); }
		p.rect(64, 96, 92, 8, [120, 110, 92]); p.rect(166, 96, 92, 8, [120, 110, 92]); p.rect(64, 96, 92, 2, [160, 150, 128]); p.rect(166, 96, 92, 2, [160, 150, 128]);
		p.rect(70, 30, 78, 10, [30, 60, 40]); font.stamp(p, "PROPERTY", 86, 32, [230, 230, 210]);
		p.rect(172, 30, 78, 10, [40, 40, 70]); font.stamp(p, "CRIME LAB", 187, 32, [230, 230, 210]);
		// cage mesh (property) + glass (lab)
		const mw = holes ? 0.9 : 0.5, ma = holes ? 0.9 : 0.55;
		for (let i = 0; i < 22; i++) { p._span(70, 46, 148, 96, null, (x, y) => { const u = (x + y) % 7, v = (x - y + 700) % 7; return (u < mw || v < mw) ? [150, 150, 150] : null; }, ma); break; }
		p.rect(172, 46, 78, 50, [200, 230, 240], 0.12);
		p.line(180, 50, 200, 90, 1, [255, 255, 255], 0.3);
		p.rect(181, 86, 60, 10, [200, 230, 240], 0.15); // speak-through slot
	};
	const p = new Painter();
	p.rect(0, 0, 320, 200, [40, 40, 40]);
	p.poly([[0, 0], [320, 0], [270, 14], [50, 14]], tex.noise([150, 150, 145], 0.1));
	for (let i = 0; i < 3; i++) p.line(0, 3 + i * 3, 320, 3 + i * 3, 2, [120 - i * 10, 110, 100]);
	fluorescent(p, 120, 2, 40, 3); fluorescent(p, 200, 2, 40, 3);
	p.poly([[0, 0], [50, 14], [50, 112], [0, 150]], tex.brick([170, 166, 150], [140, 136, 122], 12, 6));
	p.poly([[270, 14], [320, 0], [320, 150], [270, 112]], tex.brick([165, 160, 146], [135, 130, 118], 12, 6));
	p.poly([[0, 150], [50, 112], [270, 112], [320, 150], [320, 200], [0, 200]], tex.tiles([150, 145, 130], [110, 105, 95], 12));
	p.shadePoly([[0, 150], [50, 112], [270, 112], [320, 150], [320, 200], [0, 200]], (x, y) => 0.75 + (y - 112) / 300);
	paintRoomBehind(p);
	wallLayer(p, true);
	// stairs door
	p.poly([[10, 50], [38, 40], [38, 116], [10, 136]], [80, 85, 80]);
	p.poly([[13, 53], [35, 45], [35, 115], [13, 131]], tex.noise([110, 120, 130], 0.08));
	font.stamp(p, "UP", 18, 70, [240, 240, 220]);
	// bulletin on right wall + fire extinguisher
	p.poly([[282, 50], [306, 40], [306, 70], [282, 76]], [235, 232, 215]);
	for (let i = 0; i < 4; i++) p.line(285, 56 + i * 5, 303, 48 + i * 5, 0.7, [60, 60, 80], 0.8);
	p.rect(290, 92, 6, 16, [200, 30, 30]); p.rect(291, 89, 4, 3, [40, 40, 40]);
	p.light(140, 4, 120, 70, [70, 70, 60], 0.5); p.light(220, 4, 120, 70, [70, 70, 60], 0.5);
	p.vignette(0.35).grain(5);
	save(p, "basement");
	const o = overlay();
	wallLayer(o, true);
	saveProp(o, "basement_wall");
};

// --- Coroner ------------------------------------------------------------------
// Back wall x 40..280 y 16..120. Table x 118..232 top y 116..128 (occluder base 140).
// Drawers right wall. Door left wall x 8..34 y 50..140.
ROOMS.coroner = () => {
	const p = new Painter();
	p.rect(0, 0, 320, 200, [200, 205, 200]);
	p.poly([[0, 0], [320, 0], [280, 16], [40, 16]], [170, 175, 170]);
	fluorescent(p, 140, 4, 40, 4);
	p.rect(40, 16, 240, 104, tex.tiles([210, 222, 218], [160, 170, 168], 9));
	p.poly([[0, 0], [40, 16], [40, 120], [0, 156]], tex.tiles([180, 192, 188], [140, 150, 146], 9));
	p.poly([[280, 16], [320, 0], [320, 156], [280, 120]], [150, 155, 158]);
	// drawers (right wall)
	for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) {
		const x0 = 283 + c * 17, y0 = 26 + r * 30 - c * 6;
		p.poly([[x0, y0], [x0 + 15, y0 - 6], [x0 + 15, y0 + 20], [x0, y0 + 26]], tex.noise([190, 195, 200], 0.06));
		p.rect(x0 + 5, y0 + 10, 5, 2, [120, 120, 125]); p.rect(x0 + 4, y0 + 4, 6, 3, [245, 245, 235]);
	}
	p.poly([[0, 156], [40, 120], [280, 120], [320, 156], [320, 200], [0, 200]], tex.tiles([130, 145, 140], [100, 110, 108], 14));
	p.shadePoly([[0, 156], [40, 120], [280, 120], [320, 156], [320, 200], [0, 200]], (x, y) => 0.75 + (y - 120) / 320);
	p.ellipse(175, 170, 8, 3, [60, 70, 70]); // floor drain
	// sink + scale (back wall left)
	p.rect(56, 70, 40, 14, [190, 195, 200]); p.rect(60, 72, 32, 8, [140, 150, 155]); p.rect(74, 60, 2, 10, [170, 175, 180]);
	p.rect(60, 84, 32, 36, [175, 180, 185]);
	p.rect(104, 46, 16, 6, [200, 200, 205]); p.line(112, 52, 112, 64, 0.8, [120, 120, 125]); p.ellipse(112, 66, 7, 3, [190, 190, 195]);
	// chart on wall
	p.rect(240, 40, 26, 34, [240, 238, 225]); for (let i = 0; i < 6; i++) p.rect(243, 44 + i * 5, 18 - (i * 5) % 9, 1.2, [60, 60, 70]);
	// door
	p.poly([[8, 52], [34, 42], [34, 126], [8, 140]], [130, 140, 140]);
	p.poly([[11, 55], [31, 46], [31, 124], [11, 136]], tex.noise([170, 180, 180], 0.05));
	p.rect(16, 64, 10, 10, [200, 220, 230]);
	// surgical lamp
	p.line(175, 0, 175, 30, 1.2, [120, 120, 125]); p.ellipse(175, 34, 16, 5, [210, 210, 215]); p.ellipse(175, 35, 12, 3, [255, 255, 240]);
	p.light(175, 110, 90, 50, [80, 80, 70], 0.55);
	const table = (q) => {
		q.rect(124, 128, 4, 22, [120, 125, 130]); q.rect(222, 128, 4, 22, [120, 125, 130]); q.rect(170, 128, 10, 18, [110, 115, 120]);
		q.poly([[118, 120], [232, 120], [236, 130], [114, 130]], tex.noise([185, 190, 195], 0.05));
		q.rect(114, 130, 122, 3, [140, 145, 150]);
		// sheet-covered body
		q.poly([[122, 120], [226, 120], [228, 112], [212, 106], [150, 108], [130, 110], [124, 114]], (x, y) => mul([236, 238, 240], 0.85 + fbm(x * 0.2, y * 0.4, 3, 6) * 0.25));
		q.ellipse(212, 109, 9, 5, (x, y) => mul([236, 238, 240], 0.95));
		q.rect(228, 116, 4, 5, [240, 240, 220]); q.line(228, 118, 225, 118, 0.6, [150, 140, 100]);
	};
	table(p);
	p.vignette(0.25).grain(4);
	save(p, "coroner");
	const o = overlay(); table(o); saveProp(o, "coroner_table");
};

// --- The Rusty Anchor bar -----------------------------------------------------
// Back bar shelves x 10..200 y 20..72. Counter top y 76..86, front y 86..130 for x 0..210.
// Booth x 230..316 y 90..150. Neon x 228..296 y 28..48. Exit = left edge.
ROOMS.bar = () => {
	const p = new Painter();
	p.rect(0, 0, 320, 200, tex.wood([70, 42, 28], true, 9));
	p.rect(0, 0, 320, 14, [30, 20, 16]);
	// back bar: mirror + bottles
	p.rect(10, 18, 190, 56, [40, 30, 26]);
	p.rect(16, 22, 178, 26, (x, y) => mix([70, 70, 80], [120, 110, 100], fbm(x * 0.05, y * 0.1, 2)));
	for (let s = 0; s < 2; s++) {
		p.rect(14, 48 + s * 12, 182, 1.5, [110, 80, 50]);
		for (let i = 0; i < 26; i++) {
			const bx = 18 + i * 7, h = 8 + (i * 7) % 4, c = [[40, 90, 40], [120, 70, 30], [200, 190, 160], [60, 40, 20], [150, 30, 30]][(i + s * 2) % 5];
			p.rect(bx, 48 + s * 12 - h, 4, h, c); p.rect(bx + 1, 48 + s * 12 - h - 3, 2, 3, c); p.rect(bx + 0.5, 48 + s * 12 - h + 1, 1, h - 2, [255, 255, 255], 0.25);
		}
	}
	// neon sign
	p.rect(226, 26, 72, 24, [20, 14, 14]);
	font.stamp(p, "COLD", 234, 30, [255, 70, 90]); font.stamp(p, "BEER", 262, 39, [90, 160, 255]);
	p.light(262, 38, 60, 30, [200, 60, 90], 0.7);
	// ship's wheel + life ring
	p.ellipse(268, 72, 12, 12, [100, 60, 30]); p.ellipse(268, 72, 8, 8, [70, 42, 28]); for (let a = 0; a < 8; a++) p.line(268, 72, 268 + Math.cos(a * 0.785) * 15, 72 + Math.sin(a * 0.785) * 15, 1.5, [120, 76, 40]);
	p.ellipse(214, 70, 9, 9, [235, 235, 230]); p.ellipse(214, 70, 5, 5, [70, 42, 28]); for (let a = 0; a < 4; a++) p.rect(214 + Math.cos(a * 1.57) * 7 - 1.5, 70 + Math.sin(a * 1.57) * 7 - 1.5, 3, 3, [200, 40, 40]);
	// floor
	p.rect(0, 128, 320, 72, (x, y) => mul(tex.wood([96, 62, 38], false, 7)(x, y), 0.65 + (y - 128) / 200));
	// booth
	p.rect(232, 96, 84, 44, tex.noise([140, 30, 30], 0.15, 0.8));
	p.rect(232, 92, 84, 6, [110, 24, 24]);
	p.rect(244, 118, 60, 6, [80, 50, 30]); p.rect(270, 124, 6, 22, [60, 40, 26]);
	p.rect(256, 112, 4, 6, [200, 150, 60], 0.9); p.rect(280, 113, 4, 5, [220, 200, 140], 0.9);
	// stools
	for (let i = 0; i < 5; i++) { const sx = 26 + i * 38; p.rect(sx + 5, 134, 2, 18, [140, 140, 145]); p.ellipse(sx + 6, 133, 8, 3, [150, 30, 30]); p.ellipse(sx + 6, 152, 6, 1.5, [0, 0, 0], 0.4); }
	const counter = (q) => {
		q.rect(0, 86, 212, 44, tex.wood([88, 52, 32], false, 8));
		q.rect(0, 76, 216, 10, (x, y) => mul([120, 76, 44], 0.9 + (y - 76) / 40));
		q.rect(0, 76, 216, 1.5, [190, 140, 90]);
		q.rect(0, 120, 212, 4, [150, 150, 150]); // brass rail
		q.rect(60, 70, 6, 6, [220, 200, 120], 0.85); q.rect(140, 72, 10, 4, [230, 230, 230]); // glass + rag
	};
	counter(p);
	// hanging lamps
	for (const lx of [50, 130]) { p.line(lx, 0, lx, 16, 0.6, [40, 40, 40]); p.poly([[lx - 6, 20], [lx + 6, 20], [lx + 3, 15], [lx - 3, 15]], [40, 80, 50]); p.light(lx, 40, 60, 50, [255, 190, 110], 0.55); }
	p.light(270, 150, 60, 40, [200, 120, 60], 0.35);
	p.vignette(0.45).grain(6);
	save(p, "bar");
	const o = overlay(); counter(o); saveProp(o, "bar_counter");
};

// --- Warehouse 7 exterior (night) ---------------------------------------------
// Wall y 20..140. Side door x 90..115 y 92..140. Roll-up door x 150..250 y 60..140.
// Bronco x 232..352 ground 178 (left facing, runs off screen).
ROOMS.ware_ext = () => {
	const p = new Painter();
	p.rect(0, 0, 320, 40, tex.vgrad([10, 12, 30], [60, 40, 50], 0, 40));
	// cranes
	p.line(270, 2, 270, 40, 2, [20, 20, 30]); p.line(250, 6, 318, 6, 2, [20, 20, 30]); p.line(270, 6, 300, 20, 1, [20, 20, 30]);
	p.rect(288, 4, 2, 2, [255, 40, 40]);
	// wall
	p.rect(0, 18, 320, 124, tex.corrugated([70, 82, 96], 3));
	p.rect(0, 16, 320, 4, [40, 44, 50]);
	p.shadeRect(0, 18, 320, 124, (x, y) => 0.55 + 0.25 * Math.max(0, 1 - Math.hypot(x - 102, y - 86) / 90));
	// sign
	p.rect(132, 28, 136, 22, [150, 40, 30]);
	font.stamp(p, "PACIFIC RIM FREIGHT", 140, 31, [240, 230, 210]);
	font.stamp(p, "WAREHOUSE  7", 164, 41, [240, 230, 210]);
	// roll-up door
	p.rect(148, 58, 104, 84, [50, 50, 54]);
	p.rect(150, 60, 100, 82, (x, y) => mul([120, 118, 110], 0.55 + ((y % 5) < 1 ? -0.15 : 0.05) + fbm(x * 0.05, y * 0.1, 2) * 0.2));
	// side door + lamp
	p.rect(88, 90, 29, 52, [40, 42, 46]); p.rect(90, 92, 25, 50, tex.noise([96, 100, 106], 0.1)); p.rect(110, 116, 3, 3, [200, 200, 200]);
	p.rect(97, 82, 12, 4, [30, 30, 30]); p.rect(99, 85, 8, 2, [255, 230, 150]);
	p.light(103, 100, 60, 60, [255, 190, 100], 0.9);
	// ground (wet asphalt + reflections)
	p.rect(0, 142, 320, 58, (x, y) => mul([34, 36, 44], 0.9 + (fbm(x * 0.2, y * 0.5, 3, 7) - 0.5) * 0.4));
	p.rect(98, 142, 10, 50, (x, y) => [255, 190, 110, 0.25 * (1 - (y - 142) / 50) * (0.5 + 0.5 * Math.sin(y * 1.7))]);
	// streetlamp
	p.rect(20, 40, 3, 104, [40, 40, 44]); p.rect(14, 38, 16, 3, [50, 50, 54]); p.light(22, 60, 50, 80, [255, 170, 80], 0.7);
	p.rect(16, 142, 12, 50, (x, y) => [255, 170, 80, 0.2 * (1 - (y - 142) / 50)]);
	// Maddox's black Bronco
	car(p, { x: 232, ground: 178, len: 120, color: [26, 28, 32], facing: "left", type: "suv", glassTop: [60, 60, 80], glassBot: [20, 20, 26] });
	p.vignette(0.45).grain(6);
	save(p, "ware_ext");
	const d = overlay();
	d.poly([[90, 92], [104, 96], [104, 144], [90, 142]], [96, 100, 106]); d.rect(91, 93, 2, 48, [20, 18, 16]);
	saveProp(d, "ware_ext_dooropen");
};

// --- Warehouse 7 interior ------------------------------------------------------
// Racks x 0..190 y 20..122. Container x 196..318 y 44..142 (doors open).
// Entry door left x 4..30 y 70..142.
ROOMS.ware_int = () => {
	const p = new Painter();
	p.rect(0, 0, 320, 200, [24, 24, 28]);
	p.rect(0, 0, 320, 122, (x, y) => mul([60, 62, 70], 0.7 + fbm(x * 0.05, y * 0.05, 3) * 0.4));
	for (let x = 10; x < 320; x += 40) p.line(x, 0, x + 6, 20, 2, [40, 40, 46]);
	// floor
	p.rect(0, 122, 320, 78, (x, y) => mul([92, 92, 90], 0.6 + (y - 122) / 220 + (fbm(x * 0.1, y * 0.3, 3, 2) - 0.5) * 0.3));
	p.ellipse(120, 170, 20, 4, [30, 30, 30], 0.5); p.ellipse(60, 150, 12, 3, [30, 30, 30], 0.4);
	// pallet racks
	for (let bay = 0; bay < 4; bay++) {
		const x0 = 34 + bay * 40;
		p.rect(x0, 22, 2.5, 100, [200, 110, 40]); p.rect(x0 + 38, 22, 2.5, 100, [200, 110, 40]);
		for (let s = 0; s < 3; s++) {
			const y0 = 50 + s * 34;
			p.rect(x0, y0, 40, 2.5, [40, 80, 160]);
			for (let b = 0; b < 3; b++) box3d(p, x0 + 3 + b * 12, y0 - 14 + (b % 2) * 2, 10, 12 - (b % 2) * 2, 4, [160 - b * 12, 122 - b * 6, 76]);
		}
	}
	// entry door
	p.rect(4, 68, 28, 74, [40, 40, 44]); p.rect(6, 70, 24, 72, tex.noise([90, 94, 100], 0.08)); p.rect(25, 104, 3, 3, [200, 200, 200]);
	font.stamp(p, "EXIT", 8, 60, [230, 50, 40]);
	// shipping container (open)
	p.rect(196, 44, 120, 98, tex.corrugated([150, 60, 36], 2.5));
	p.rect(206, 54, 100, 86, [18, 16, 14]);
	for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
		const cx = 212 + c * 31, cy = 108 - r * 24 + (c % 2) * 2;
		p.rect(cx, cy, 28, 22, tex.wood([150, 118, 70], false, 4));
		font.stamp(p, "PARTS", cx + 3, cy + 3, [40, 30, 20], 1, 0.8);
		p.rect(cx + 18, cy + 12, 7, 5, [235, 225, 120]); // MVPD evidence tag
	}
	p.poly([[196, 44], [180, 38], [180, 146], [196, 142]], tex.corrugated([170, 70, 40], 2));
	font.stamp(p, "PRFU 7731", 222, 46, [230, 220, 200]);
	// hanging lamps
	for (const lx of [100, 250]) { p.line(lx, 0, lx, 14, 0.6, [80, 80, 80]); p.poly([[lx - 8, 18], [lx + 8, 18], [lx + 3, 12], [lx - 3, 12]], [70, 70, 70]); p.light(lx, 100, 90, 100, [255, 220, 150], 0.8); }
	p.vignette(0.5).grain(6);
	save(p, "ware_int");
};

// --- Title --------------------------------------------------------------------
ROOMS.title = () => {
	const p = new Painter();
	p.rect(0, 0, 320, 200, tex.vgrad([8, 8, 24], [70, 30, 60], 0, 130));
	for (let i = 0; i < 90; i++) p.rect(hash(i, 1) * 320, hash(i, 2) * 90, 0.6, 0.6, [255, 255, 255], 0.4 + hash(i, 3) * 0.6);
	p.ellipse(262, 34, 12, 12, [240, 235, 210]); p.light(262, 34, 40, 40, [120, 110, 90], 0.5);
	// skyline
	for (let i = 0; i < 26; i++) {
		const bx = i * 13 - 4, bh = 30 + hash(i, 5) * 60, bw = 10 + hash(i, 6) * 8;
		p.rect(bx, 130 - bh, bw, bh, [16, 14, 26]);
		for (let wy = 130 - bh + 3; wy < 128; wy += 4) for (let wx = bx + 2; wx < bx + bw - 2; wx += 3) if (hash(wx * 3 | 0, wy * 5 | 0) > 0.72) p.rect(wx, wy, 1, 1.5, [250, 210, 120], 0.8);
	}
	// cranes
	for (const cx of [40, 84]) { p.line(cx, 70, cx, 130, 2, [12, 10, 20]); p.line(cx - 20, 72, cx + 34, 72, 2, [12, 10, 20]); p.line(cx, 72, cx + 26, 90, 0.8, [12, 10, 20]); }
	// water with reflections
	p.rect(0, 130, 320, 70, (x, y) => { const r = Math.sin(y * 1.9 + Math.sin(x * 0.2)) > 0.85 && hash(x | 0, y | 0) > 0.6 && Math.abs(x - 262) < 30 + (y - 130); return r ? [200, 150, 110] : mul([20, 18, 40], 0.8 + (y - 130) / 200); });
	p.vignette(0.5).grain(6);
	save(p, "title");
};

// ---------------------------------------------------------------------------
const only = process.argv[2];
for (const [name, fn] of Object.entries(ROOMS)) if (!only || only === name) fn();
