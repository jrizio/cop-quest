// Cop Quest — character sprite generator.
//
// Takes the base walk-cycle sheet (assets/art/officer_walk.png: 8 frames x 4
// rows of a man in a T-shirt and boxers) and re-dresses it into every cast
// member by classifying pixels (hair / skin / shirt / shorts) and re-tinting
// each class while keeping the original shading. Output sheets are downscaled
// to the game's VGA scale (56x96 frames, same 8x4 layout).
//
//   node tools/gen_sprites.js
//
// Output -> assets/art/chars/<id>.png

const fs = require("fs");
const path = require("path");
const { decodePNG, encodePNG, areaResize } = require("./pixelate.js");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "assets/art/officer_walk.png");
const OUT = path.join(ROOT, "assets/art/chars");
const FW = 123, FH = 210, COLS = 8, ROWS = 4;
const OW = 56, OH = 96;

// Pixel classes
const T = 0, HAIR = 1, SKIN = 2, SHIRT = 3, SHORTS = 4;

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
const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;

// Reference luminance per class (computed from the sheet).
const REF = { [HAIR]: 40, [SKIN]: 150, [SHIRT]: 215, [SHORTS]: 120 };

function tint(target, l, ref, contrast = 1.0) {
	let f = 1 + (l / ref - 1) * contrast;
	f = Math.max(0.35, Math.min(1.45, f));
	return [Math.min(255, target[0] * f), Math.min(255, target[1] * f), Math.min(255, target[2] * f)];
}

function dressFrame(src, fx, fy, o) {
	const w = FW, h = FH;
	const out = new Uint8Array(w * h * 4);
	const cls = new Uint8Array(w * h);
	const L = new Float32Array(w * h);
	for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
		const si = ((fy * FH + y) * src.w + fx * FW + x) * 4;
		const r = src.px[si], g = src.px[si + 1], b = src.px[si + 2], a = src.px[si + 3];
		cls[y * w + x] = classify(r, g, b, a);
		L[y * w + x] = lum(r, g, b);
		out[y * w * 4 + x * 4 + 3] = a < 128 ? 0 : 255;
	}
	// Head region: rows above the shoulders. Light skin highlights can be
	// misread as shirt, so force everything above the shoulders to skin/hair.
	const rowW = new Int16Array(h);
	for (let y = 0; y < h; y++) { let a = w, b = -1; for (let x = 0; x < w; x++) if (cls[y * w + x] !== T) { if (x < a) a = x; b = x; } rowW[y] = b - a + 1; }
	let headW = 0; for (let y = 10; y < 36; y++) headW = Math.max(headW, rowW[y]);
	let shoulderY = 44; for (let y = 30; y < 80; y++) if (rowW[y] > headW * 1.3) { shoulderY = y; break; }
	for (let y = 0; y < shoulderY - 1; y++) for (let x = 0; x < w; x++) { const p = y * w + x; if (cls[p] === SHIRT || cls[p] === SHORTS) cls[p] = SKIN; }
	// Landmarks
	let shortsTop = h, shortsBot = 0, shirtTop = h, figBot = 0, headBot = 0;
	let sMinX = w, sMaxX = 0;
	for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
		const c = cls[y * w + x];
		if (c === SHORTS) { shortsTop = Math.min(shortsTop, y); shortsBot = Math.max(shortsBot, y); sMinX = Math.min(sMinX, x); sMaxX = Math.max(sMaxX, x); }
		if (c === SHIRT && y >= shoulderY - 1) shirtTop = Math.min(shirtTop, y);
		if (c !== T) figBot = Math.max(figBot, y);
	}
	// shortsTop: first row with a solid band of shorts (ignore stray pixels)
	for (let y = 0; y < h; y++) { let n = 0; for (let x = 0; x < w; x++) if (cls[y * w + x] === SHORTS) n++; if (n > 8) { shortsTop = y; break; } }
	for (let y = h - 1; y >= 0; y--) { let n = 0; for (let x = 0; x < w; x++) if (cls[y * w + x] === SHORTS) n++; if (n > 6) { shortsBot = y; break; } }
	headBot = Math.max(shirtTop + 2, shoulderY - 2);
	// torso center per row (mean x of shirt pixels)
	const center = new Float32Array(h);
	for (let y = 0; y < h; y++) { let s = 0, n = 0; for (let x = 0; x < w; x++) if (cls[y * w + x] === SHIRT) { s += x; n++; } center[y] = n ? s / n : -1; }
	// lowest opaque pixel per column (for shoes)
	const colBot = new Int16Array(w).fill(-1);
	for (let x = 0; x < w; x++) for (let y = h - 1; y >= 0; y--) if (cls[y * w + x] !== T) { colBot[x] = y; break; }

	const torsoHalf = Math.max(8, (sMaxX - sMinX) * 0.36);
	const front = fy === 0, back = fy === 1;

	for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
		const p = y * w + x, c = cls[p], l = L[p];
		if (c === T) continue;
		let col = null;
		const legZone = y > shortsBot - 1;
		if (c === HAIR) {
			if (y > headBot) {
				// dark pixels on the body (shadows, outlines): darken the region color
				col = legZone ? o.pants.map(v => v * 0.45) : (y > shortsTop ? (o.coat || o.pants).map(v => v * 0.45) : o.shirt.map(v => v * 0.4));
			} else col = tint(o.hair, l + 5, REF[HAIR] + 5, 1.2);
		} else if (c === SKIN) {
			if (y <= headBot) col = tint(o.skin, l, REF[SKIN]);
			else if (legZone || (y > shortsTop + 4 && x >= sMinX + 4 && x <= sMaxX - 4)) {
				const shoe = colBot[x] >= 0 && y >= colBot[x] - 9 && y > shortsBot + 30;
				col = shoe ? tint(o.shoes, l, REF[SKIN], 0.8) : tint(o.pants, l, REF[SKIN]);
			} else {
				// arms: sleeves above the wrist when long-sleeved
				const wrist = shortsTop + 8;
				if (o.longSleeves && y < wrist) col = tint(o.shirt, l, REF[SKIN]);
				else col = tint(o.skin, l, REF[SKIN]);
			}
		} else if (c === SHIRT) {
			col = tint(o.shirt, l, REF[SHIRT], o.shirtContrast || 1.4);
			if (o.plaid && ((((x >> 2) + (y >> 2)) & 1) || ((y >> 3) & 1) === 0)) col = col.map(v => v * 0.72);
		} else if (c === SHORTS) {
			col = tint(o.coat || o.pants, l, REF[SHORTS]);
		}
		// Body armor vest over the torso
		if (o.vest && y > shirtTop + 6 && y < shortsTop + 2 && center[y] >= 0 && Math.abs(x - center[y]) < torsoHalf && c !== HAIR) {
			col = tint(o.vest, l, REF[SHIRT], 0.6);
			if (front && y > shirtTop + 22 && y < shirtTop + 32 && Math.abs(x - center[y]) < 10) col = [210, 210, 200]; // "POLICE" patch
		}
		// Tie (front-facing frames)
		if (o.tie && front && !o.vest && y > shirtTop + 2 && y < shortsTop - 4 && center[y] >= 0 && Math.abs(x - center[y]) < (y < shirtTop + 7 ? 2.5 : 3.5) && c === SHIRT) {
			col = tint(o.tie, l, REF[SHIRT], 0.8);
		}
		// Badge on chest (uniforms)
		if (o.badge && front && center[y] >= 0 && y > shirtTop + 12 && y < shirtTop + 19 && x > center[y] + 7 && x < center[y] + 13) col = [235, 200, 70];
		const i = p * 4;
		out[i] = col[0]; out[i + 1] = col[1]; out[i + 2] = col[2]; out[i + 3] = 255;
	}

	// Long hair: paint hair down past the jaw on both sides (front / back / sides)
	if (o.longHair) {
		let hMin = w, hMax = 0, hTop = h;
		for (let y = 0; y < headBot; y++) for (let x = 0; x < w; x++) if (cls[y * w + x] === HAIR || cls[y * w + x] === SKIN) { hMin = Math.min(hMin, x); hMax = Math.max(hMax, x); hTop = Math.min(hTop, y); }
		const hc = (yy) => tint(o.hair, 40 + ((yy * 7) % 11), REF[HAIR] + 5, 1.2);
		const put = (x, y, c) => { if (x < 0 || y < 0 || x >= w || y >= h) return; const i = (y * w + x) * 4; out[i] = c[0]; out[i + 1] = c[1]; out[i + 2] = c[2]; out[i + 3] = 255; };
		const yEnd = headBot + 22;
		for (let y = hTop + 6; y < yEnd; y++) {
			const t = (y - hTop) / (yEnd - hTop);
			const spread = 3 + Math.round(t * 3);
			if (back) {
				for (let x = hMin - spread + 2; x <= hMax + spread - 2; x++) put(x, y, hc(y));
			} else if (front) {
				for (let k = 0; k < spread + 3; k++) { put(hMin - spread + 2 + k, y, hc(y)); put(hMax + spread - 2 - k, y, hc(y)); }
			} else {
				// profile: hair falls behind the head
				const backSide = fy === 2 ? hMin : hMax, dir = fy === 2 ? 1 : -1;
				for (let k = 0; k < 9 + spread; k++) put(backSide + dir * (k - spread + 1), y, hc(y));
			}
		}
	}
	return { w, h, px: out };
}

const CAST = {
	// The hero, three wardrobe states
	gabe_boxers: null, // original sheet, just downscaled
	gabe: { hair: [30, 24, 20], skin: [205, 150, 110], shirt: [168, 196, 230], longSleeves: true, tie: [120, 30, 40], pants: [70, 72, 82], shoes: [25, 22, 22] },
	gabe_vest: { hair: [30, 24, 20], skin: [205, 150, 110], shirt: [168, 196, 230], longSleeves: true, vest: [44, 50, 66], pants: [70, 72, 82], shoes: [25, 22, 22] },
	cho: { hair: [16, 14, 14], skin: [222, 180, 140], shirt: [42, 54, 96], shirtContrast: 0.9, badge: true, pants: [36, 44, 80], shoes: [18, 18, 20] },
	voss: { hair: [150, 150, 150], skin: [226, 160, 140], shirt: [42, 54, 96], shirtContrast: 0.9, longSleeves: true, badge: true, pants: [36, 44, 80], shoes: [18, 18, 20] },
	pruitt: { hair: [170, 170, 165], skin: [120, 80, 55], shirt: [225, 220, 205], longSleeves: true, tie: [110, 80, 40], pants: [110, 90, 66], shoes: [60, 40, 25] },
	kessler: { hair: [130, 60, 30], skin: [230, 180, 150], shirt: [96, 34, 46], shirtContrast: 0.9, longSleeves: true, pants: [30, 30, 36], shoes: [20, 18, 18], longHair: true },
	oduya: { hair: [20, 18, 18], skin: [105, 70, 50], shirt: [232, 232, 228], longSleeves: true, coat: [225, 225, 222], pants: [80, 80, 86], shoes: [30, 26, 26] },
	rosa: { hair: [30, 20, 16], skin: [190, 135, 95], shirt: [232, 232, 228], longSleeves: true, coat: [225, 225, 222], pants: [50, 60, 90], shoes: [30, 26, 26], longHair: true },
	sal: { hair: [175, 170, 160], skin: [230, 170, 145], shirt: [232, 228, 215], tie: [20, 20, 20], pants: [28, 28, 30], shoes: [20, 18, 18] },
	wendell: { hair: [100, 70, 40], skin: [200, 145, 105], shirt: [170, 40, 34], shirtContrast: 0.9, plaid: true, longSleeves: true, pants: [60, 80, 130], shoes: [90, 60, 35] },
	maddox: { hair: [210, 190, 120], skin: [225, 165, 135], shirt: [82, 86, 50], shirtContrast: 0.9, longSleeves: true, pants: [40, 50, 75], shoes: [50, 35, 25] },
	elena: { hair: [24, 16, 14], skin: [200, 145, 108], shirt: [70, 150, 150], shirtContrast: 0.9, pants: [60, 135, 135], shoes: [235, 235, 235], longHair: true },
};

function main() {
	const src = decodePNG(fs.readFileSync(SRC));
	fs.mkdirSync(OUT, { recursive: true });
	for (const [id, o] of Object.entries(CAST)) {
		const sheet = new Uint8Array(OW * COLS * OH * ROWS * 4);
		for (let fy = 0; fy < ROWS; fy++) for (let fx = 0; fx < COLS; fx++) {
			let frame;
			if (!o) {
				frame = { w: FW, h: FH, px: new Uint8Array(FW * FH * 4) };
				for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
					const si = ((fy * FH + y) * src.w + fx * FW + x) * 4, di = (y * FW + x) * 4;
					for (let k = 0; k < 4; k++) frame.px[di + k] = src.px[si + k];
				}
			} else frame = dressFrame(src, fx, fy, o);
			const small = areaResize(frame, OW, OH);
			for (let y = 0; y < OH; y++) for (let x = 0; x < OW; x++) {
				const si = (y * OW + x) * 4, di = ((fy * OH + y) * OW * COLS + fx * OW + x) * 4;
				const a = small.px[si + 3];
				if (a < 110) continue;
				// un-premultiply the averaged edge color
				const k = 255 / a;
				sheet[di] = Math.min(255, small.px[si] * (a < 250 ? Math.min(k, 1.6) : 1));
				sheet[di + 1] = Math.min(255, small.px[si + 1] * (a < 250 ? Math.min(k, 1.6) : 1));
				sheet[di + 2] = Math.min(255, small.px[si + 2] * (a < 250 ? Math.min(k, 1.6) : 1));
				sheet[di + 3] = 255;
			}
		}
		fs.writeFileSync(path.join(OUT, id + ".png"), encodePNG(OW * COLS, OH * ROWS, sheet));
		console.log("wrote chars/" + id + ".png");
	}
}
main();
