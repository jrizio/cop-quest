// Cop Quest — character sprite generator (v2: costume painter).
//
// Starts from the base walk-cycle sheet (assets/art/officer_walk.png: a man in
// a T-shirt and boxers, 8 frames x 4 rows of 123x210) and, at full resolution,
// segments every frame into body zones (hair, face, neck, torso, sleeves,
// forearms, hands, pelvis, legs, feet). It then *paints* each cast member's
// costume over those zones: tailored shirts with collars, buttons and cuffs,
// ties, belts, trousers with creases, shoes, uniforms with badges and
// patches, lab coats, blazers, waistcoats, aprons, flannel, ballistic vests.
// It also adds hairstyles, facial hair, glasses and each character's build
// (height and width), then downsamples to several VGA scale levels so rooms
// can draw people crisply at any depth.
//
//   node tools/gen_sprites.js            (all)    node tools/gen_sprites.js gabe
//
// Output -> assets/art/chars/<id>.png (64x96 frames) and <id>@86/@74/@64.png

const fs = require("fs");
const path = require("path");
const { decodePNG, encodePNG } = require("./pixelate.js");
const font = require("./font.js");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "assets/art/officer_walk.png");
const OUT = path.join(ROOT, "assets/art/chars");
const SW = 123, SH = 210, COLS = 8, ROWS = 4;
const WW = 140, WH = 210;             // working frame (padding for wider builds)
const OW = 64, OH = 96;               // level-1 output frame
const LEVELS = [[1.0, ""], [0.86, "@86"], [0.74, "@74"], [0.64, "@64"]];

const T = 0, HAIR = 1, SKIN = 2, SHIRT = 3, SHORTS = 4;
const REF = { [HAIR]: 40, [SKIN]: 150, [SHIRT]: 210, [SHORTS]: 120 };
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mul = (c, f) => [c[0] * f, c[1] * f, c[2] * f];
const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
const hash = (x, y, s = 0) => { let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };

// 3-stop color ramp: t ~0.45 shadow, 1.0 base, ~1.4 highlight
function shade(base, t) {
	const sh = mix(mul(base, 0.42), [18, 20, 44], 0.18), hi = mix(mul(base, 1.3), [255, 248, 232], 0.22);
	t = clamp(t, 0.35, 1.5);
	const c = t < 1 ? mix(sh, base, (t - 0.35) / 0.65) : mix(base, hi, (t - 1) / 0.5);
	return [clamp(c[0], 0, 255), clamp(c[1], 0, 255), clamp(c[2], 0, 255)];
}

function classify(r, g, b, a) {
	if (a < 128) return T;
	const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
	if (mx < 70) return HAIR;
	if (b > r + 10) return SHORTS;
	if (mn > 150 && mx - mn < 45) return SHIRT;
	if (r > g && g >= b) return SKIN;
	if (mn > 120 && mx - mn < 60) return SHIRT;
	return SKIN;
}

// ---------------------------------------------------------------------------
// Frame extraction with the character's build (sx = width, sy = height)
// ---------------------------------------------------------------------------
function getFrame(src, fx, fy, sx, sy) {
	const px = new Uint8Array(WW * WH * 4);
	const sample = (u, v) => {
		const x0 = Math.floor(u), y0 = Math.floor(v), fu = u - x0, fv = v - y0;
		let r = 0, g = 0, b = 0, a = 0;
		for (const [dx, dy, w] of [[0, 0, (1 - fu) * (1 - fv)], [1, 0, fu * (1 - fv)], [0, 1, (1 - fu) * fv], [1, 1, fu * fv]]) {
			const x = x0 + dx, y = y0 + dy;
			if (x < 0 || y < 0 || x >= SW || y >= SH) continue;
			const i = ((fy * SH + y) * src.w + fx * SW + x) * 4, pa = src.px[i + 3] / 255 * w;
			r += src.px[i] * pa; g += src.px[i + 1] * pa; b += src.px[i + 2] * pa; a += pa;
		}
		return a > 0 ? [r / a, g / a, b / a, a] : [0, 0, 0, 0];
	};
	for (let y = 0; y < WH; y++) for (let x = 0; x < WW; x++) {
		const u = (x + 0.5 - WW / 2) / sx + SW / 2 - 0.5, v = SH - (WH - y - 0.5) / sy - 0.5;
		const [r, g, b, a] = sample(u, v), i = (y * WW + x) * 4;
		if (a < 0.5) continue;
		px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255;
	}
	return px;
}

// ---------------------------------------------------------------------------
// Segmentation
// ---------------------------------------------------------------------------
function analyze(px, view) {
	const w = WW, h = WH, n = w * h;
	const cls = new Uint8Array(n), L = new Float32Array(n);
	for (let p = 0; p < n; p++) {
		const i = p * 4;
		cls[p] = classify(px[i], px[i + 1], px[i + 2], px[i + 3]);
		L[p] = lum(px[i], px[i + 1], px[i + 2]);
	}
	const row = (y, c) => { let k = 0; for (let x = 0; x < w; x++) if (cls[y * w + x] === c) k++; return k; };
	const rowW = new Int16Array(h);
	for (let y = 0; y < h; y++) { let a = w, b = -1; for (let x = 0; x < w; x++) if (cls[y * w + x] !== T) { if (x < a) a = x; b = x; } rowW[y] = b - a + 1; }
	let headTop = 0; while (headTop < h && rowW[headTop] <= 0) headTop++;
	let headW = 0; for (let y = headTop + 6; y < headTop + 32; y++) headW = Math.max(headW, rowW[y]);
	let shoulderY = headTop + 42; for (let y = headTop + 28; y < headTop + 80; y++) if (rowW[y] > headW * 1.3) { shoulderY = y; break; }
	let faceTop = headTop + 12;
	for (let y = headTop + 4; y < shoulderY; y++) { let run = 0, best = 0; for (let x = 0; x < w; x++) { if (cls[y * w + x] === SKIN) { run++; best = Math.max(best, run); } else run = 0; } if (best >= 6) { faceTop = y; break; } }
	for (let y = 0; y < shoulderY - 1; y++) for (let x = 0; x < w; x++) { const p = y * w + x; if (cls[p] === SHIRT || cls[p] === SHORTS) cls[p] = y < faceTop ? HAIR : SKIN; }
	let shortsTop = h, shortsBot = 0;
	for (let y = 0; y < h; y++) if (row(y, SHORTS) > 8) { shortsTop = y; break; }
	for (let y = h - 1; y >= 0; y--) if (row(y, SHORTS) > 6) { shortsBot = y; break; }
	let sMinX = w, sMaxX = 0;
	for (let y = shortsTop; y <= shortsBot; y++) for (let x = 0; x < w; x++) if (cls[y * w + x] === SHORTS) { sMinX = Math.min(sMinX, x); sMaxX = Math.max(sMaxX, x); }
	// light print on the boxers is still boxers
	for (let y = shortsTop + 2; y < h; y++) for (let x = 0; x < w; x++) { const p = y * w + x; if (cls[p] === SHIRT) cls[p] = SHORTS; }
	// face geometry
	const eyeY = faceTop + 10;
	let fl = w, fr = 0;
	for (let x = 0; x < w; x++) if (cls[eyeY * w + x] === SKIN || (cls[eyeY * w + x] === HAIR && x > 0 && cls[eyeY * w + x - 1] === SKIN)) { fl = Math.min(fl, x); fr = Math.max(fr, x); }
	const chin = Math.min(shoulderY - 2, faceTop + 28);
	// body center
	const bodyCx = (sMinX + sMaxX) / 2;
	const center = new Float32Array(h);
	for (let y = 0; y < h; y++) { let s = 0, k = 0; for (let x = 0; x < w; x++) if (cls[y * w + x] === SHIRT) { s += x; k++; } center[y] = k ? s / k : bodyCx; }
	// contiguous run containing the body center (torso core without hanging arms)
	const core = [];
	for (let y = 0; y < h; y++) {
		const c = Math.round(view >= 2 ? center[y] : bodyCx);
		if (cls[y * w + c] === T) { core.push([c, c - 1]); continue; }
		let a = c, b = c;
		while (a > 0 && cls[y * w + a - 1] !== T) a--;
		while (b < w - 1 && cls[y * w + b + 1] !== T) b++;
		core.push([a, b]);
	}
	// arms: skin components seeded from forearms
	const arm = new Uint8Array(n), stack = [];
	for (let y = shoulderY + 12; y < shortsTop; y++) for (let x = 0; x < w; x++) { const p = y * w + x; if (cls[p] === SKIN && !arm[p]) { arm[p] = 1; stack.push(p); } }
	while (stack.length) {
		const p = stack.pop(), x = p % w, y = (p / w) | 0;
		for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
			const xx = x + dx, yy = y + dy;
			if (xx < 0 || yy < shoulderY + 10 || xx >= w || yy > shortsBot + 14) continue;
			const q = yy * w + xx;
			if (!arm[q] && cls[q] === SKIN) {
				if (yy > shortsBot + 2 && xx >= sMinX + 3 && xx <= sMaxX - 3 && view < 2) continue; // thighs
				arm[q] = 1; stack.push(q);
			}
		}
	}
	// hands: the lowest 15px of each arm column cluster (left / right of body)
	const hand = new Uint8Array(n);
	for (const side of [-1, 1]) {
		let maxY = 0;
		for (let p = 0; p < n; p++) if (arm[p]) { const x = p % w; if ((x < bodyCx) === (side < 0) || view >= 2) maxY = Math.max(maxY, (p / w) | 0); }
		for (let p = 0; p < n; p++) if (arm[p]) { const x = p % w, y = (p / w) | 0; if (((x < bodyCx) === (side < 0) || view >= 2) && y >= maxY - 15) hand[p] = 1; }
		if (view >= 2) break;
	}
	// legs + feet
	const leg = new Uint8Array(n);
	for (let y = shortsTop + 6; y < h; y++) for (let x = 0; x < w; x++) { const p = y * w + x; if (!arm[p] && cls[p] !== T && cls[p] !== SHORTS) leg[p] = 1; }
	const colBot = new Int16Array(w).fill(-1);
	for (let x = 0; x < w; x++) for (let y = h - 1; y > shortsBot; y--) if (leg[y * w + x]) { colBot[x] = y; break; }
	const shoe = new Uint8Array(n);
	let ground = 0; for (let x = 0; x < w; x++) ground = Math.max(ground, colBot[x]);
	// feet: per connected leg blob near the ground, the lowest 11px
	const comp = new Int32Array(n).fill(-1); let nc = 0;
	for (let p0 = 0; p0 < n; p0++) {
		const y0 = (p0 / w) | 0;
		if (!leg[p0] || comp[p0] >= 0 || y0 < ground - 30) continue;
		const st = [p0], members = []; comp[p0] = nc; let maxY = 0;
		while (st.length) {
			const p = st.pop(), x = p % w, y = (p / w) | 0; members.push(p); maxY = Math.max(maxY, y);
			for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
				const xx = x + dx, yy = y + dy, q = yy * w + xx;
				if (xx < 0 || xx >= w || yy < ground - 30 || yy >= h || comp[q] >= 0 || !leg[q]) continue;
				comp[q] = nc; st.push(q);
			}
		}
		for (const p of members) if (((p / w) | 0) >= maxY - 11) shoe[p] = 1;
		nc++;
	}
	// trousers: trim the flared boxer hems so the outline runs straight from hip to thigh
	const cut = new Uint8Array(n);
	const isP = (p) => (cls[p] === SHORTS || (leg[p] && !shoe[p])) && !arm[p];
	const ext = (y) => { let a = w, b = -1; for (let x = 0; x < w; x++) if (isP(y * w + x)) { if (x < a) a = x; b = x; } return [a, b]; };
	const yA = shortsTop + 6, yB = Math.min(h - 1, shortsBot + 8);
	const [la, ra] = ext(yA), [lb, rb] = ext(yB);
	if (ra >= 0 && rb >= 0) for (let y = yA; y < yB; y++) {
		const k = (y - yA) / (yB - yA), tl = la + (lb - la) * k, tr = ra + (rb - ra) * k;
		for (let x = 0; x < w; x++) { const p = y * w + x; if (isP(p) && (x < tl - 1.5 || x > tr + 1.5)) { cls[p] = T; leg[p] = 0; cut[p] = 1; } }
	}
	// normalized brightness (removes per-class differences), and a blurred copy for cloth
	const t = new Float32Array(n);
	for (let p = 0; p < n; p++) if (cls[p] !== T) t[p] = clamp(L[p] / REF[cls[p] === HAIR ? SKIN : cls[p]], 0.3, 1.6) * (cls[p] === HAIR ? 0.5 : 1);
	const mean = (test) => { let s = 0, k = 0; for (let p = 0; p < n; p++) if (test(p)) { s += t[p]; k++; } return k ? s / k : 1; };
	const mPel = mean(p => cls[p] === SHORTS), mLeg = mean(p => leg[p] && !shoe[p] && cls[p] === SKIN);
	for (let p = 0; p < n; p++) { if (cls[p] === SHORTS) t[p] /= mPel; else if (leg[p] && !shoe[p] && cls[p] !== HAIR) t[p] /= mLeg; }
	// close small gaps where the loose boxer hems met the thighs
	for (let y = shortsBot - 6; y < shortsBot + 12; y++) for (let x = 1; x < w - 1; x++) {
		const p = y * w + x; if (cls[p] !== T) continue;
		if (view < 2 && Math.abs(x - bodyCx) < 5) continue;
		const reach = view < 2 ? 5 : 7;
		let l = 0, r = 0; for (let d = 1; d <= reach; d++) { if (!l && x - d >= 0 && cls[p - d] !== T && !arm[p - d]) l = d; if (!r && x + d < w && cls[p + d] !== T && !arm[p + d]) r = d; }
		if (l && r) { cls[p] = SHORTS; t[p] = 1; leg[p] = 1; }
	}
	const tb = blur(t, cls, w, h, 4);
	return { w, h, cls, L, t, tb, cut, arm, hand, leg, shoe, core, center, bodyCx, headTop, shoulderY, shortsTop, shortsBot, sMinX, sMaxX, faceTop, eyeY, chin, faceL: fl, faceR: fr, view };
}

function blur(t, cls, w, h, r) {
	const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
	for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
		let s = 0, k = 0;
		for (let d = -r; d <= r; d++) { const xx = x + d; if (xx < 0 || xx >= w) continue; const q = y * w + xx; if (cls[q] !== T) { s += t[q]; k++; } }
		tmp[y * w + x] = k ? s / k : 1;
	}
	for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
		let s = 0, k = 0;
		for (let d = -r; d <= r; d++) { const yy = y + d; if (yy < 0 || yy >= h) continue; const q = yy * w + x; if (cls[q] !== T) { s += tmp[q]; k++; } }
		out[y * w + x] = k ? s / k : 1;
	}
	return out;
}

// ---------------------------------------------------------------------------
// Costume painting
// ---------------------------------------------------------------------------
function dress(px, A, o, fy) {
	const { w, h, cls, t, tb } = A;
	const out = new Uint8Array(px);
	for (let p = 0; p < w * h; p++) if (A.cut[p]) out[p * 4 + 3] = 0;
	const front = fy === 0, back = fy === 1, side = fy >= 2, faceDir = fy === 2 ? 1 : -1;
	const put = (x, y, c, a = 1) => {
		x |= 0; y |= 0; if (x < 0 || y < 0 || x >= w || y >= h) return;
		c = [clamp(c[0], 0, 255), clamp(c[1], 0, 255), clamp(c[2], 0, 255)];
		const i = (y * w + x) * 4;
		if (out[i + 3] === 0 || a >= 1) { out[i] = c[0]; out[i + 1] = c[1]; out[i + 2] = c[2]; out[i + 3] = 255; return; }
		out[i] = out[i] * (1 - a) + c[0] * a; out[i + 1] = out[i + 1] * (1 - a) + c[1] * a; out[i + 2] = out[i + 2] * (1 - a) + c[2] * a;
	};
	const opaque = (x, y) => x >= 0 && y >= 0 && x < w && y < h && out[(y * w + x) * 4 + 3] > 0;
	const cloth = (p, soft = 0.65) => t[p] * (1 - soft) + tb[p] * soft;
	const coreHas = (x, y) => x >= A.core[y][0] && x <= A.core[y][1];
	const cx = A.bodyCx;
	const neckTop = A.chin + 3;
	const isNeckline = (x, y) => y >= neckTop && y < A.shoulderY + 10 && cls[y * w + x] === SKIN && !A.arm[y * w + x];

	// --- skin & base hair recolor ---
	for (let p = 0; p < w * h; p++) {
		const x = p % w, y = (p / w) | 0;
		if (cls[p] === SKIN) put(x, y, shade(o.skin, t[p] * 1.02));
		else if (cls[p] === HAIR && y < A.shoulderY) put(x, y, shade(o.hair.color, 0.55 + A.L[p] / 80));
	}

	// --- trousers / pelvis ---
	const inPants = (p, y) => (cls[p] === SHORTS || (A.leg[p] && !A.shoe[p]) || (cls[p] === HAIR && y >= A.shortsTop - 1)) && !A.arm[p] && !A.shoe[p];
	const cyl = new Float32Array(w * h);
	for (let y = A.shortsTop - 1; y < h; y++) {
		let x = 0;
		while (x < w) {
			if (!inPants(y * w + x, y)) { x++; continue; }
			let x1 = x; while (x1 + 1 < w && inPants(y * w + x1 + 1, y)) x1++;
			for (let k = x; k <= x1; k++) { const u = (k - x + 0.5) / (x1 - x + 1); cyl[y * w + k] = 0.7 + 0.42 * Math.sin(Math.PI * Math.pow(u, 0.8)); }
			x = x1 + 1;
		}
	}
	const pantsT = (p, y) => (cyl[p] * 0.7 + clamp(tb[p], 0.8, 1.15) * 0.3) * (o.pants.jeans ? 0.95 + hash(p % w, y, 3) * 0.1 : 1);
	for (let p = 0; p < w * h; p++) {
		const x = p % w, y = (p / w) | 0;
		const pantsDark = cls[p] === HAIR && y >= A.shortsTop - 1 && !A.arm[p] && !A.shoe[p];
		if (cls[p] === SHORTS || (A.leg[p] && !A.shoe[p]) || pantsDark) {
			let c = shade(o.pants.color, pantsT(p, y) * (pantsDark ? 0.92 : 1));
			if (o.pants.crease && front && y > A.shortsBot) {
				const legs = [A.sMinX + (A.sMaxX - A.sMinX) * 0.27, A.sMinX + (A.sMaxX - A.sMinX) * 0.73];
				for (const lx of legs) if (Math.abs(x - lx) < 0.8) c = mul(c, 1.18);
			}
			put(x, y, c);
		}
	}
	// hem / cuffs at the shoe line
	for (let p = 0; p < w * h; p++) if (A.shoe[p]) {
		const x = p % w, y = (p / w) | 0;
		const top = !A.shoe[(y - 1) * w + x];
		put(x, y, top ? shade(o.pants.color, 0.5) : shade(o.shoes, 0.75 + (cls[p] === HAIR ? 0 : t[p] * 0.25)));
	}
	// shoe toe highlight + chunkier soles
	for (let x = 0; x < w; x++) for (let y = h - 1; y > A.shortsBot + 30; y--) if (A.shoe[y * w + x]) {
		put(x, y, shade(o.shoes, 0.38));
		if (o.boots) put(x, y - 12, shade(o.shoes, 0.9));
		break;
	}
	if (o.boots) for (let p = 0; p < w * h; p++) if (A.leg[p] && !A.shoe[p]) { const x = p % w, y = (p / w) | 0; const below = y + 6 < h && A.shoe[(y + 6) * w + x]; if (below) put(x, y, shade(o.shoes, 0.85 + tb[p] * 0.2)); }

	// --- shirt / top ---
	const top = o.top;
	const topColorAt = (x, y, p) => {
		let c = shade(top.color, cloth(p, 0.82));
		if (top.pattern === "plaid") {
			const gx = ((x + 1000) % 9), gy = ((y + 1000) % 9);
			if (gx < 3) c = mul(c, 0.7); if (gy < 3) c = mul(c, 0.72);
			if (gx === 5 || gy === 5) c = mix(c, [235, 220, 160], 0.35);
		}
		return c;
	};
	for (let p = 0; p < w * h; p++) {
		const x = p % w, y = (p / w) | 0;
		const sleeveSkin = A.arm[p] && !A.hand[p] && top.long;
		const torso = cls[p] === SHIRT && y >= A.shoulderY - 2 && y <= A.shortsTop + 2;
		const darkOnTorso = cls[p] === HAIR && y >= A.shoulderY && y < A.shortsTop && !A.arm[p];
		if (torso || sleeveSkin || darkOnTorso || isNeckline(x, y)) {
			let c = topColorAt(x, y, p);
			if (darkOnTorso) c = mul(c, 0.55);
			if (sleeveSkin) c = shade(top.color, (t[p] * 0.25 + tb[p] * 0.75) * 0.95);
			put(x, y, c);
		}
	}
	// cuffs: a band just above each hand
	if (top.long) for (let p = 0; p < w * h; p++) if (A.arm[p] && !A.hand[p]) {
		const x = p % w, y = (p / w) | 0;
		if (y + 3 < h && A.hand[(y + 3) * w + x]) put(x, y, shade(top.cuff || top.color, 0.7));
	}
	// collar / neckline
	if (front) {
		const v = top.neck || "collar";
		for (let y = neckTop - 2; y < A.shoulderY + 22; y++) for (let x = Math.floor(cx - 14); x <= cx + 14; x++) {
			const p = y * w + x, dx = Math.abs(x - cx), dy = y - neckTop;
			if (!opaque(x, y)) continue;
			if (v === "v" || v === "open") {
				const depth = v === "v" ? 16 : 10;
				if (dy >= 0 && dy < depth && dx < (depth - dy) * 0.45) put(x, y, shade(o.skin, t[p] || 1));
				if (v === "open" && dy >= -1 && dy < 6 && dx >= (depth - dy) * 0.45 && dx < (depth - dy) * 0.45 + 3) put(x, y, shade(top.collar || top.color, 1.25));
			} else if (v === "collar") {
				// two collar points meeting under the chin
				if (dy >= -2 && dy < 5 && dx < 7 - dy * 0.5 && dx > 0.5) put(x, y, shade(top.color, 1.32));
				if (dy >= 3 && dy < 5 && dx < 7) put(x, y, shade(top.color, 0.8), 0.5);
			}
		}
	} else if (side) {
		for (let y = neckTop - 2; y < neckTop + 4; y++) for (let x = 0; x < w; x++) if (cls[y * w + x] === SKIN && Math.abs(x - A.center[y + 6]) < 8) put(x, y, shade(top.color, 1.25));
	} else if (back) {
		for (let y = neckTop - 2; y < neckTop + 3; y++) for (let x = Math.floor(cx - 7); x <= cx + 7; x++) if (opaque(x, y)) put(x, y, shade(top.color, 1.2));
	}
	// button placket
	if (top.placket && front && !o.tie) for (let y = neckTop + 4; y < A.shortsTop - 1; y++) {
		put(cx, y, shade(top.color, 0.78));
		if ((y - neckTop) % 9 === 6) put(cx + 1, y, [240, 240, 236]);
	}

	// --- tie ---
	if (o.tie && front) {
		const tc = o.tie.color, kx = cx, ky = neckTop + 2;
		for (let y = ky; y < ky + 5; y++) for (let x = kx - 2.5; x <= kx + 2.5; x++) put(x, y, shade(tc, 1.1 - (y - ky) * 0.06));
		const bladeEnd = A.shortsTop - 4;
		for (let y = ky + 5; y <= bladeEnd; y++) {
			const k = (y - ky - 5) / (bladeEnd - ky - 5), hw = 2 + k * 2.8 - (y > bladeEnd - 3 ? (y - bladeEnd + 3) * 1.4 : 0);
			for (let x = Math.floor(kx - hw); x <= kx + hw; x++) {
				let c = shade(tc, 0.95 + (x < kx ? 0.12 : -0.1));
				if (o.tie.stripe && ((x + y) % 7 < 2)) c = mix(c, o.tie.stripe, 0.55);
				put(x, y, c);
			}
		}
	}
	// --- suspenders ---
	if (o.suspenders && (front || back)) for (const s of [-1, 1]) for (let y = A.shoulderY; y < A.shortsTop; y++) {
		const x = cx + s * (9 - (y - A.shoulderY) * 0.04);
		for (let k = 0; k < 2.5; k++) if (opaque(x + k, y)) put(x + k, y, shade(o.suspenders, 0.9 + k * 0.1));
	}

	// --- belt ---
	if (o.belt) {
		const bh = o.belt.duty ? 7 : 4, by = A.shortsTop - (o.belt.duty ? 3 : 2);
		for (let y = by; y < by + bh; y++) for (let x = 0; x < w; x++) {
			const p = y * w + x;
			if (!opaque(x, y) || A.arm[p] || A.hand[p]) continue;
			if (!coreHas(x, y) && !side) continue;
			put(x, y, shade(o.belt.color, y === by ? 1.25 : 0.9));
		}
		if (front) for (let y = by; y < by + bh; y++) for (let x = cx - 3; x <= cx + 3; x++) put(x, y, shade(o.belt.buckle, (x === cx - 3 || y === by) ? 1.3 : 0.95));
		if (o.belt.duty) for (const ox of [-15, -9, 10, 16]) if (front || back) for (let y = by + 1; y < by + bh + 3; y++) for (let x = cx + ox - 2; x <= cx + ox + 2; x++) if (opaque(x, y)) put(x, y, shade([30, 30, 34], 0.9 + (y - by) * 0.02));
	}
	// belt badge + holster (detective)
	if (o.beltBadge) {
		const by = A.shortsTop - 1, bx = front ? cx - 15 : side ? A.center[by] - 2 * faceDir : -99;
		if (bx > 0 && !back) for (let y = by; y < by + 7; y++) for (let x = bx - 2.5; x <= bx + 2.5; x++) if (Math.abs(x - bx) <= 2.6 - (y > by + 4 ? (y - by - 4) : 0)) put(x, y, shade([228, 188, 70], 1.2 - (y - by) * 0.06));
	}
	if (o.holster) {
		const by = A.shortsTop + 1;
		const hx = front ? cx + 15 : back ? cx - 15 : (fy === 2 ? A.center[by] - 5 : A.center[by] + 5);
		for (let y = by; y < by + 15; y++) for (let x = hx - 3; x <= hx + 3; x++) if (opaque(x, y) || y < by + 12) put(x, y, shade([58, 38, 26], 0.8 + (x - hx + 3) * 0.06));
		for (let y = by - 4; y < by; y++) for (let x = hx - 2; x <= hx + 2; x++) put(x, y, shade([34, 34, 38], 1.0));
	}

	// --- uniform details ---
	if (o.uniform) {
		const u = o.uniform;
		if (front) {
			// badge on the left chest (viewer's right), name plate on the right chest
			const by = A.shoulderY + 12, bx = cx + 10;
			for (let y = by; y < by + 9; y++) for (let x = bx - 3; x <= bx + 3; x++) if (Math.abs(x - bx) <= 3.5 - Math.max(0, y - by - 5) * 0.8) put(x, y, shade([235, 198, 80], 1.25 - (y - by) * 0.05));
			for (let y = by + 2; y < by + 5; y++) for (let x = cx - 14; x <= cx - 6; x++) put(x, y, y === by + 3 ? [230, 230, 230] : [24, 24, 28]);
			for (const s of [-1, 1]) for (let y = A.shoulderY + 14; y < A.shoulderY + 34; y++) put(cx + s * 4, y, shade(top.color, 0.65)); // pocket seams
		}
		// shoulder patches and sergeant chevrons on the sleeves
		for (let p = 0; p < w * h; p++) {
			const x = p % w, y = (p / w) | 0;
			if (cls[p] !== SHIRT || (!side && Math.abs(x - cx) < (A.core[y][1] - A.core[y][0]) / 2 - 7)) continue;
			if (y >= A.shoulderY + 5 && y < A.shoulderY + 13) put(x, y, (y === A.shoulderY + 5 || y === A.shoulderY + 12) ? [210, 175, 70] : shade(u.patch, 1.0));
			if (u.chevrons && y >= A.shoulderY + 16 && y < A.shoulderY + 26) {
				const d = (y - A.shoulderY - 16) % 4;
				const armC = x < cx ? A.core[y][0] - 6 : A.core[y][1] + 6;
				if (!side && Math.abs(Math.abs(x - armC) - (3 - d)) < 1) put(x, y, [230, 190, 70]);
			}
		}
	}

	// --- outer garments ---
	const ov = o.over;
	if (ov) {
		const hemY = ov.type === "labcoat" ? A.shortsBot + 34 : ov.type === "waistcoat" ? A.shortsTop + 5 : A.shortsTop + 13;
		const lapelBot = ov.type === "labcoat" ? A.shoulderY + 30 : ov.type === "waistcoat" ? A.shoulderY + 26 : ov.type === "workjacket" ? neckTop + 4 : A.shoulderY + 24;
		const coversSleeves = ov.type !== "waistcoat";
		for (let y = neckTop; y <= hemY; y++) {
			// horizontal extent: body at this row; skirt flares a little past the legs
			let x0 = w, x1 = -1;
			for (let x = 0; x < w; x++) {
				const p = y * w + x;
				if (!opaque(x, y) || A.hand[p]) continue;
				if (!coversSleeves && !coreHas(x, y)) continue;
				if (y > A.shortsTop && A.arm[p]) continue;
				if (y < A.shoulderY - 1 && cls[p] === SKIN && !isNeckline(x, y)) continue;
				x0 = Math.min(x0, x); x1 = Math.max(x1, x);
			}
			if (x1 < 0) continue;
			const flare = y > A.shortsTop ? Math.min(4, (y - A.shortsTop) * 0.15) : 0;
			const a0 = y > A.shortsTop ? x0 - flare : x0, a1 = y > A.shortsTop ? x1 + flare : x1;
			for (let x = Math.floor(a0); x <= a1; x++) {
				const p = y * w + x;
				if (y <= A.shortsTop && !opaque(x, y)) continue;
				if (y <= A.shortsTop + 2 && (A.arm[p] || cls[p] === SKIN) && !isNeckline(x, y) && !(A.arm[p] && !A.hand[p])) continue;
				if (y > A.shortsTop && A.arm[p]) continue;
				const dx = x - cx, dy = y - neckTop;
				// front opening (lapels showing the shirt beneath)
				if (front) {
					const open = ov.type === "labcoat" ? (y < lapelBot ? (lapelBot - y) * 0.42 + 1.5 : 1.5 + (y > A.shortsTop ? 0.5 : 0)) :
						ov.type === "waistcoat" ? (y < lapelBot ? (lapelBot - y) * 0.42 : 0) :
						ov.type === "workjacket" ? 0.6 : (y < lapelBot ? (lapelBot - y) * 0.4 + 1 : 0);
					if (Math.abs(dx) < open) continue;
					if (Math.abs(dx) < open + 2 && y < lapelBot && ov.type !== "workjacket") { put(x, y, shade(ov.color, 1.3)); continue; }
				}
				const k = ov.type === "labcoat" && !opaque(x, y) ? 0.92 : cloth(p, 0.75);
				const roll = 1 - Math.min(0.35, Math.abs(dx) / 60);
				let c = shade(ov.color, (opaque(x, y) ? k : 0.9) * roll * 1.02);
				if (y === hemY) c = shade(ov.color, 0.55);
				put(x, y, c);
			}
		}
		if (front && ov.type === "labcoat") for (const s of [-1, 1]) for (let y = A.shortsTop + 4; y < A.shortsTop + 12; y++) for (let x = cx + s * 14 - 4; x <= cx + s * 14 + 4; x++) if (y === A.shortsTop + 4 || Math.abs(x - (cx + s * 14)) > 3.5) put(x, y, shade(ov.color, 0.68));
		if (front && (ov.type === "waistcoat" || ov.type === "blazer")) for (let y = lapelBot; y < hemY - 2; y += 6) put(cx - 2, y, shade(ov.button || [200, 200, 200], 1));
		if (front && ov.type === "workjacket") {
			for (let y = neckTop + 2; y < hemY; y++) put(cx, y, shade([150, 150, 140], 1.1));
			for (const s of [-1, 1]) { for (let x = cx + s * 5; Math.abs(x - cx) < 13; x += s) { put(x, A.shoulderY + 10, shade(ov.color, 0.6)); put(x, A.shoulderY + 20, shade(ov.color, 0.6)); } }
			for (let y = neckTop - 1; y < neckTop + 4; y++) for (let x = cx - 9; x <= cx + 9; x++) if (opaque(x, y)) put(x, y, shade(ov.collar || [110, 76, 40], 1.0 - (y - neckTop) * 0.05));
		}
		if (ov.type === "tactical" || ov.text) { /* handled below */ }
	}
	if (o.apron && (front || side)) {
		for (let y = A.shortsTop - 1; y < A.shortsBot + 26; y++) {
			let x0 = w, x1 = -1;
			for (let x = 0; x < w; x++) { const p = y * w + x; if (opaque(x, y) && !A.arm[p] && (y > A.shortsTop + 2 || coreHas(x, y))) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); } }
			if (x1 < 0) continue;
			if (side) { const c = A.center[A.shortsTop]; if (fy === 2) x0 = Math.max(x0, c - 2); else x1 = Math.min(x1, c + 2); }
			else { x0 -= 1; x1 += 1; }
			for (let x = x0; x <= x1; x++) put(x, y, shade([236, 234, 226], 0.95 + 0.05 * Math.sin((x - x0) * 0.5) - (y === A.shortsTop - 1 ? 0.3 : 0)));
		}
	}
	if (o.vest) {
		const vy0 = A.shoulderY + 1, vy1 = A.shortsTop + 3;
		for (let y = vy0; y <= vy1; y++) for (let x = 0; x < w; x++) {
			const p = y * w + x;
			if (!opaque(x, y) || A.arm[p] || !coreHas(x, y)) continue;
			const inset = Math.abs(x - (side ? A.center[y] : cx)) > (A.core[y][1] - A.core[y][0]) / 2 - 2 && !side;
			if (inset && y < A.shoulderY + 8) continue;
			put(x, y, shade(o.vest, 0.85 + tb[p] * 0.25 - (y === vy1 ? 0.3 : 0)));
		}
		if (front || back) {
			const label = "POLICE", sc = back ? 2 : 1, tw = font.measure(label) * sc;
			const ty = back ? A.shoulderY + 14 : A.shoulderY + 10;
			const tmp = { rect: (x, y, ww, hh) => { for (let yy = y; yy < y + hh; yy++) for (let xx = x; xx < x + ww; xx++) put(xx, yy, [235, 235, 225]); } };
			if (front) for (let y = ty - 2; y < ty + 9; y++) for (let x = cx - tw / 2 - 2; x <= cx + tw / 2 + 2; x++) put(x, y, [30, 32, 40]);
			font.stamp(tmp, label, Math.round(cx - tw / 2), ty, null, sc);
		}
	}

	// --- face & head details ---
	const fcx = (A.faceL + A.faceR) / 2;
	const frontX = fy === 2 ? A.faceR : A.faceL;
	if (o.glasses) {
		const gc = o.glasses, ey = A.eyeY;
		if (front) for (const s of [-1, 1]) { const ex = fcx + s * 6.5; for (let x = ex - 3.5; x <= ex + 3.5; x++) { put(x, ey - 2, gc); put(x, ey + 2, gc); } for (let y = ey - 2; y <= ey + 2; y++) { put(ex - 3.5, y, gc); put(ex + 3.5, y, gc); } put(fcx, ey - 1, gc); put(fcx + 0.9, ey - 1, gc); }
		if (side) { const ex = frontX - faceDir * 3; for (let x = -3; x <= 3; x++) { put(ex + x, ey - 2, gc); put(ex + x, ey + 2, gc); } for (let y = -2; y <= 2; y++) { put(ex - 3, ey + y, gc); put(ex + 3, ey + y, gc); } for (let k = 4; k < 13; k++) put(ex - faceDir * k, ey - 1, gc); }
	}
	const hairC = o.facialHair || o.hair.color;
	if (o.mustache && !back) {
		const my = A.faceTop + 21;
		if (front) for (let y = my; y < my + 3; y++) for (let x = fcx - 6 + (y - my); x <= fcx + 6 - (y - my); x++) put(x, y, shade(hairC, 0.85 + hash(x | 0, y) * 0.3));
		if (side) for (let y = my; y < my + 3; y++) for (let k = 1; k < 7; k++) put(frontX - faceDir * k, y, shade(hairC, 0.85 + hash(k, y) * 0.3));
	}
	if ((o.beard || o.stubble) && !back) {
		const a = o.beard ? 0.85 : 0.32;
		for (let y = A.faceTop + 19; y <= A.chin + 1; y++) for (let x = 0; x < w; x++) {
			const p = y * w + x;
			if (cls[p] !== SKIN) continue;
			const mouth = front && y >= A.faceTop + 23 && y <= A.faceTop + 25 && Math.abs(x - fcx) < 4;
			const cheek = front ? Math.abs(x - fcx) > 7 || y > A.faceTop + 24 : (x - frontX) * faceDir > -10;
			if (!mouth && (cheek || o.beard) && hash(x, y, 9) < (o.beard ? 0.95 : 0.6)) put(x, y, shade(hairC, 0.8 + hash(x, y) * 0.3), a);
		}
	}
	if (o.lipstick && !back) {
		const my = A.faceTop + 24;
		if (front) for (let x = fcx - 3.5; x <= fcx + 3.5; x++) { put(x, my, o.lipstick); put(x, my + 1, mul(o.lipstick, 0.8)); }
		if (side) { put(frontX - faceDir, my, o.lipstick); put(frontX - faceDir * 2, my, o.lipstick); }
	}
	if (o.earrings && !back) {
		const ey = A.faceTop + 17;
		if (front) { put(A.faceL - 2, ey, o.earrings); put(A.faceL - 2, ey + 1, o.earrings); put(A.faceR + 2, ey, o.earrings); put(A.faceR + 2, ey + 1, o.earrings); }
		if (side) { put(frontX - faceDir * 13, ey + 1, o.earrings); put(frontX - faceDir * 13, ey + 2, o.earrings); }
	}
	if (o.idBadge && front) { const bx = cx - 11, by = A.shoulderY + 12; for (let y = by; y < by + 8; y++) for (let x = bx; x < bx + 6; x++) put(x, y, y < by + 2 ? [50, 90, 160] : (x > bx + 2 && y > by + 3 ? [170, 130, 110] : [240, 240, 236])); }

	// --- hairstyle ---
	paintHair(out, put, opaque, A, o, fy);
	return out;
}

function paintHair(out, put, opaque, A, o, fy) {
	const { w, cls, L } = A;
	const style = o.hair.style || "base", hc = o.hair.color;
	const front = fy === 0, back = fy === 1, side = fy >= 2, faceDir = fy === 2 ? 1 : -1;
	const strand = (x, y) => shade(hc, 0.75 + 0.3 * Math.sin(x * 1.7 + Math.sin(y * 0.3) * 2) + (hash(x, y, 5) - 0.5) * 0.15);
	let hl = w, hr = 0;
	for (let y = A.headTop; y < A.chin; y++) for (let x = 0; x < w; x++) { const c = cls[y * w + x]; if (c === HAIR || c === SKIN) { hl = Math.min(hl, x); hr = Math.max(hr, x); } }
	const hcx = (hl + hr) / 2;
	if (back && (style === "bald" || style === "buzz")) {
		for (let y = A.headTop; y < A.shoulderY - 1; y++) for (let x = hl; x <= hr; x++) {
			const p = y * w + x;
			if (cls[p] === T) continue;
			const ex = (x - hcx) / ((hr - hl) / 2 + 0.5), top = A.headTop + (style === "bald" ? 6 : 3);
			if (y < top && Math.abs(ex) > 0.55 + (y - A.headTop) * 0.08) { out[p * 4 + 3] = 0; continue; }
			if (y > A.shoulderY - 12) { put(x, y, shade(o.skin, 0.8 + A.L[p] / 600)); continue; }
			const fringe = style === "bald" && y > A.shoulderY - 20;
			put(x, y, style === "bald" && !fringe ? shade(o.skin, 1.0 + (1 - Math.min(1, Math.hypot(x - hcx + 3, y - top - 6) / 14)) * 0.3) :
				mix(shade(o.skin, 0.9), shade(hc, 0.9 + A.L[p] / 300), style === "bald" ? 0.85 : 0.5 + hash(x, y) * 0.3));
		}
		return;
	}
	if (style === "bald") {
		const cut = A.headTop + (A.faceTop - A.headTop) * 0.5;
		for (let y = A.headTop; y < A.faceTop + 8; y++) for (let x = hl; x <= hr; x++) {
			const p = y * w + x;
			if (cls[p] !== HAIR && !(cls[p] === SKIN && y < A.faceTop)) continue;
			const ex = (x - hcx) / ((hr - hl) / 2 - 1), ey = (y - (A.faceTop + 2)) / (A.faceTop + 2 - cut);
			if (ex * ex + ey * ey > 1.0) { out[p * 4 + 3] = 0; continue; }
			const fringe = y > A.faceTop - 1 && Math.abs(x - hcx) > (hr - hl) * 0.3;
			put(x, y, fringe ? shade(hc, 0.7 + L[p] / 120) : shade(o.skin, 1.05 + (1 - Math.min(1, Math.hypot(x - hcx + 4, y - cut - 4) / 12)) * 0.35));
		}
	}
	if (style === "buzz") {
		const cut = A.headTop + (A.faceTop - A.headTop) * 0.35;
		for (let y = A.headTop; y < A.faceTop + 2; y++) for (let x = hl; x <= hr; x++) {
			const p = y * w + x;
			if (cls[p] !== HAIR && !(cls[p] === SKIN && y < A.faceTop)) continue;
			const ex = (x - hcx) / ((hr - hl) / 2), ey = (y - (A.faceTop + 3)) / (A.faceTop + 3 - cut);
			if (ex * ex + ey * ey > 1.0) { out[p * 4 + 3] = 0; continue; }
			put(x, y, mix(shade(o.skin, 0.95), shade(hc, 1.0), 0.55 + hash(x, y) * 0.3));
		}
		for (let y = A.faceTop + 12; y < A.shoulderY - 1; y++) for (let x = hl; x <= hr; x++) {
			const p = y * w + x;
			if (cls[p] === HAIR && (x < A.faceL || x > A.faceR)) put(x, y, shade(o.skin, 0.62));
		}
	}
	if (style === "long" || style === "bob") {
		const endY = style === "long" ? A.shoulderY + 22 : A.chin + 4;
		const faceSkin = (x, y) => cls[y * w + x] === SKIN && y < A.chin + 1 && x > A.faceL - 1 && x < A.faceR + 1;
		for (let y = A.headTop + 2; y < endY; y++) {
			const k = (y - A.faceTop) / (endY - A.faceTop);
			const spread = y < A.faceTop ? 0 : 3 + Math.min(1, k) * 3;
			for (let x = Math.floor(hl - spread); x <= hr + spread; x++) {
				const p = y * w + x;
				if (x < 0 || x >= w) continue;
				const inHead = cls[p] === HAIR && y < A.shoulderY;
				if (front) {
					if (faceSkin(x, y)) continue;
					if (y > A.chin - 2 && Math.abs(x - hcx) < (A.faceR - A.faceL) / 2 - 1) continue;    // neck / chest stays visible
					if (!inHead && y < A.faceTop) continue;
					if (!inHead && (x > hl + 4 + spread && x < hr - 4 - spread)) continue;
				} else if (side) {
					if (faceSkin(x, y) && (x - (fy === 2 ? A.faceR : A.faceL)) * faceDir > -11) continue;
					const backEdge = fy === 2 ? hl : hr, inner = (x - backEdge) * faceDir;
					if (!inHead && (inner > 9 - Math.max(0, y - A.chin) * 0.25 || inner < -spread + Math.max(0, y - A.chin) * 0.2)) continue;
				}
				if (!inHead && !opaque(x, y) && y < A.faceTop) continue;
				const edge = y > endY - 3 ? 0.75 : 1;
				put(x, y, mul(strand(x, y), edge));
			}
		}
	}
	if (style === "receding") {
		for (let y = A.headTop; y < A.faceTop; y++) for (let x = hl; x <= hr; x++) {
			const p = y * w + x;
			if (cls[p] !== HAIR && !(cls[p] === SKIN && y < A.faceTop)) continue;
			const ex = (x - hcx) / ((hr - hl) / 2), ey = (y - (A.faceTop + 2)) / (A.faceTop + 2 - (A.headTop + (A.faceTop - A.headTop) * 0.4));
			if (ex * ex + ey * ey > 1) { out[p * 4 + 3] = 0; continue; }
			if (front && y > A.faceTop - 4 && Math.abs(x - hcx) < 6) put(x, y, shade(o.skin, 1.05));
		}
	}
}

// ---------------------------------------------------------------------------
// Downsampling to VGA scale levels (premultiplied area average, crisp alpha,
// darkened rim so figures read cleanly against busy backgrounds)
// ---------------------------------------------------------------------------
function downsample(px, dw, dh) {
	const out = new Uint8Array(dw * dh * 4);
	const fx = WW / dw, fy = WH / dh;
	for (let ty = 0; ty < dh; ty++) for (let tx = 0; tx < dw; tx++) {
		const x0 = tx * fx, x1 = (tx + 1) * fx, y0 = WH - (dh - ty) * fy, y1 = y0 + fy;
		let r = 0, g = 0, b = 0, a = 0, wsum = 0;
		for (let sy = Math.floor(y0); sy < Math.ceil(y1); sy++) for (let sx = Math.floor(x0); sx < Math.ceil(x1); sx++) {
			if (sx < 0 || sy < 0 || sx >= WW || sy >= WH) continue;
			const wx = Math.min(sx + 1, x1) - Math.max(sx, x0), wy = Math.min(sy + 1, y1) - Math.max(sy, y0), wt = wx * wy;
			const i = (sy * WW + sx) * 4, pa = px[i + 3] / 255 * wt;
			r += px[i] * pa; g += px[i + 1] * pa; b += px[i + 2] * pa; a += pa; wsum += wt;
		}
		const cov = wsum ? a / wsum : 0, i = (ty * dw + tx) * 4;
		if (cov < 0.42) continue;
		out[i] = r / a; out[i + 1] = g / a; out[i + 2] = b / a; out[i + 3] = 255;
	}
	// light unsharp mask for detail, then darken the silhouette rim
	const sharp = new Uint8Array(out);
	for (let y = 1; y < dh - 1; y++) for (let x = 1; x < dw - 1; x++) {
		const i = (y * dw + x) * 4; if (!out[i + 3]) continue;
		for (let c = 0; c < 3; c++) {
			let s = 0, k = 0;
			for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const j = ((y + dy) * dw + x + dx) * 4; if (out[j + 3]) { s += out[j + c]; k++; } }
			if (k) sharp[i + c] = clamp(out[i + c] * 1.35 - (s / k) * 0.35, 0, 255);
		}
	}
	for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) {
		const i = (y * dw + x) * 4; if (!sharp[i + 3]) continue;
		let edge = false;
		for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= dw || yy >= dh || !out[(yy * dw + xx) * 4 + 3]) edge = true; }
		if (edge) for (let c = 0; c < 3; c++) sharp[i + c] *= 0.72;
	}
	return sharp;
}

// ---------------------------------------------------------------------------
// The cast
// ---------------------------------------------------------------------------
const TONE = { fair: [236, 190, 160], tan: [214, 160, 118], olive: [200, 150, 105], brown: [150, 100, 70], dark: [108, 70, 50], pink: [232, 175, 150] };
const blackShoes = [30, 26, 26];
const CAST = {
	gabe_boxers: null,
	gabe: { build: [1.0, 0.98], skin: TONE.tan, hair: { color: [32, 24, 20] },
		top: { color: [164, 194, 230], long: true, neck: "collar" }, tie: { color: [130, 30, 42], stripe: [190, 160, 90] },
		pants: { color: [74, 76, 88], crease: true }, shoes: blackShoes, belt: { color: [44, 30, 22], buckle: [205, 195, 150] }, beltBadge: true, holster: true },
	gabe_vest: { build: [1.02, 0.98], skin: TONE.tan, hair: { color: [32, 24, 20] },
		top: { color: [164, 194, 230], long: true, neck: "collar" }, vest: [40, 44, 56],
		pants: { color: [74, 76, 88], crease: true }, shoes: blackShoes, belt: { color: [44, 30, 22], buckle: [205, 195, 150] }, beltBadge: true, holster: true },
	cho: { build: [0.96, 0.95], skin: [228, 188, 148], hair: { color: [18, 16, 18] },
		top: { color: [44, 56, 98], neck: "open", collar: [44, 56, 98] }, uniform: { patch: [70, 90, 150] },
		pants: { color: [34, 42, 76], crease: true }, shoes: [16, 16, 18], belt: { color: [20, 20, 22], buckle: [200, 200, 205], duty: true }, holster: true },
	voss: { build: [1.06, 0.95], skin: TONE.pink, hair: { color: [160, 158, 152], style: "buzz" }, glasses: [40, 40, 46], mustache: true, facialHair: [150, 145, 140],
		top: { color: [44, 56, 98], long: true, neck: "open", collar: [44, 56, 98] }, uniform: { patch: [70, 90, 150], chevrons: true },
		pants: { color: [34, 42, 76], crease: true }, shoes: [16, 16, 18], belt: { color: [20, 20, 22], buckle: [200, 200, 205], duty: true }, holster: true },
	pruitt: { build: [1.14, 0.95], skin: TONE.dark, hair: { color: [180, 178, 172], style: "receding" }, mustache: true, facialHair: [190, 188, 182],
		top: { color: [232, 228, 214], neck: "collar" }, tie: { color: [120, 84, 44] }, suspenders: [90, 40, 36],
		pants: { color: [118, 96, 70], crease: true }, shoes: [70, 46, 28], belt: { color: [60, 40, 24], buckle: [190, 170, 110] }, beltBadge: true },
	kessler: { build: [0.9, 0.93], skin: TONE.fair, hair: { color: [140, 64, 34], style: "bob" }, lipstick: [170, 50, 60], earrings: [235, 205, 90],
		top: { color: [240, 236, 228], long: true, neck: "v" }, over: { type: "blazer", color: [100, 34, 48], button: [210, 180, 90] },
		pants: { color: [36, 34, 40], crease: true }, shoes: [24, 20, 20] },
	oduya: { build: [1.02, 0.98], skin: TONE.dark, hair: { color: [20, 18, 18], style: "buzz" }, beard: true, glasses: [60, 50, 40],
		top: { color: [150, 180, 215], long: true, neck: "collar" }, tie: { color: [40, 50, 90], stripe: [160, 40, 40] },
		over: { type: "labcoat", color: [236, 238, 240] }, pants: { color: [70, 70, 78], crease: true }, shoes: blackShoes },
	rosa: { build: [0.88, 0.92], skin: TONE.olive, hair: { color: [34, 22, 18], style: "long" }, lipstick: [150, 60, 70], earrings: [210, 210, 220],
		top: { color: [90, 60, 110], long: true, neck: "v" }, over: { type: "labcoat", color: [236, 238, 240] },
		pants: { color: [40, 40, 50] }, shoes: blackShoes },
	sal: { build: [1.1, 0.94], skin: TONE.pink, hair: { color: [176, 170, 160], style: "bald" }, mustache: true, facialHair: [150, 140, 130],
		top: { color: [238, 236, 226], long: true, neck: "collar" }, tie: { color: [26, 26, 30] }, over: { type: "waistcoat", color: [40, 38, 44], button: [200, 190, 140] }, apron: true,
		pants: { color: [32, 32, 36] }, shoes: blackShoes },
	wendell: { build: [1.12, 1.0], skin: TONE.brown, hair: { color: [40, 30, 24], style: "buzz" }, stubble: true,
		top: { color: [170, 42, 36], pattern: "plaid", long: true, neck: "open", collar: [150, 36, 30] },
		pants: { color: [66, 90, 140], jeans: true }, shoes: [96, 64, 36], boots: true, belt: { color: [80, 56, 34], buckle: [180, 160, 100] } },
	maddox: { build: [1.08, 1.0], skin: TONE.pink, hair: { color: [220, 196, 120], style: "buzz" }, stubble: true, facialHair: [170, 140, 90],
		top: { color: [200, 200, 196], neck: "collar" }, over: { type: "workjacket", color: [92, 96, 56], collar: [110, 76, 40] },
		pants: { color: [44, 56, 84], jeans: true }, shoes: [70, 48, 30], boots: true },
	elena: { build: [0.88, 0.92], skin: TONE.olive, hair: { color: [26, 18, 16], style: "long" }, lipstick: [160, 60, 70], earrings: [230, 200, 90],
		top: { color: [64, 150, 150], neck: "v" }, idBadge: true,
		pants: { color: [60, 140, 140] }, shoes: [236, 236, 236] },
};

function main() {
	const src = decodePNG(fs.readFileSync(SRC));
	fs.mkdirSync(OUT, { recursive: true });
	const only = process.argv[2];
	for (const [id, o] of Object.entries(CAST)) {
		if (only && only !== id) continue;
		const frames = [];
		for (let fy = 0; fy < ROWS; fy++) for (let fx = 0; fx < COLS; fx++) {
			const [sx, sy] = o ? o.build : [1.0, 0.98];
			const px = getFrame(src, fx, fy, sx, sy);
			frames.push(o ? dress(px, analyze(px, fy), o, fy) : px);
		}
		for (const [lv, suffix] of LEVELS) {
			const fw = Math.round(OW * lv), fh = Math.round(OH * lv);
			const sheet = new Uint8Array(fw * COLS * fh * ROWS * 4);
			frames.forEach((px, k) => {
				const fx = k % COLS, fy = (k / COLS) | 0, small = downsample(px, fw, fh);
				for (let y = 0; y < fh; y++) sheet.set(small.subarray(y * fw * 4, (y + 1) * fw * 4), ((fy * fh + y) * fw * COLS + fx * fw) * 4);
			});
			fs.writeFileSync(path.join(OUT, id + suffix + ".png"), encodePNG(fw * COLS, fh * ROWS, sheet));
		}
		console.log("chars/" + id);
	}
}
// Debug: DUMP=<id> FR=<col>,<row> OUTF=<file.png> node tools/gen_sprites.js
// writes one dressed frame at full working resolution (140x210).
if (process.env.DUMP) {
	const src = decodePNG(fs.readFileSync(SRC)), o = CAST[process.env.DUMP];
	const [fx, fy] = (process.env.FR || "0,0").split(",").map(Number);
	const px = getFrame(src, fx, fy, o.build[0], o.build[1]);
	fs.writeFileSync(process.env.OUTF, encodePNG(WW, WH, dress(px, analyze(px, fy), o, fy)));
} else main();
