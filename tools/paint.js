// Cop Quest — "digitized VGA" painting library.
//
// A tiny software painter used by gen_rooms.js. It paints at 2x supersampling
// in 320x200 coordinates with per-pixel shader callbacks (for textures and
// lighting), then box-downsamples and reduces the picture to a 256-color
// palette with light ordered dithering — the look of a 1993 Sierra SCI1.1
// photo background.

const fs = require("fs");
const { encodePNG } = require("./pixelate.js");

// ---------------------------------------------------------------------------
// Noise
// ---------------------------------------------------------------------------
function hash(x, y, s = 0) {
	let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0;
	h = (h ^ (h >>> 13)) * 1274126177;
	return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function vnoise(x, y, s = 0) {
	const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
	const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
	const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
	return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, oct = 4, s = 0) {
	let t = 0, amp = 0.5, f = 1;
	for (let i = 0; i < oct; i++) { t += vnoise(x * f, y * f, s + i * 17) * amp; f *= 2; amp *= 0.5; }
	return t;
}
const clamp = (v, a = 0, b = 255) => v < a ? a : v > b ? b : v;
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mul = (c, f) => [c[0] * f, c[1] * f, c[2] * f];

// ---------------------------------------------------------------------------
// Painter
// ---------------------------------------------------------------------------
class Painter {
	constructor(opts = {}) {
		this.W = opts.w || 320; this.H = opts.h || 200; this.S = opts.ss || 2;
		this.w = this.W * this.S; this.h = this.H * this.S;
		this.px = new Float32Array(this.w * this.h * 4);
		if (!opts.transparent) for (let i = 0; i < this.w * this.h; i++) this.px[i * 4 + 3] = 1;
	}
	_blend(i, c, a) {
		const p = this.px, k = i * 4;
		if (a >= 1 && (c[3] === undefined || c[3] >= 1)) { p[k] = c[0]; p[k + 1] = c[1]; p[k + 2] = c[2]; p[k + 3] = 1; return; }
		const fa = a * (c[3] === undefined ? 1 : c[3]);
		if (fa <= 0) return;
		const ba = p[k + 3], oa = fa + ba * (1 - fa);
		p[k] = (c[0] * fa + p[k] * ba * (1 - fa)) / oa;
		p[k + 1] = (c[1] * fa + p[k + 1] * ba * (1 - fa)) / oa;
		p[k + 2] = (c[2] * fa + p[k + 2] * ba * (1 - fa)) / oa;
		p[k + 3] = oa;
	}
	_col(c, x, y) { return typeof c === "function" ? c(x, y) : c; }
	// Generic: run a shader over integer sample pixels inside a bbox, with a test.
	_span(x0, y0, x1, y1, test, c, a) {
		const S = this.S;
		const ix0 = Math.max(0, Math.floor(x0 * S)), iy0 = Math.max(0, Math.floor(y0 * S));
		const ix1 = Math.min(this.w, Math.ceil(x1 * S)), iy1 = Math.min(this.h, Math.ceil(y1 * S));
		for (let iy = iy0; iy < iy1; iy++) for (let ix = ix0; ix < ix1; ix++) {
			const x = (ix + 0.5) / S, y = (iy + 0.5) / S;
			if (test && !test(x, y)) continue;
			const col = this._col(c, x, y);
			if (col) this._blend(iy * this.w + ix, col, typeof a === "function" ? a(x, y) : a);
		}
	}
	rect(x, y, w, h, c, a = 1) { this._span(x, y, x + w, y + h, null, c, a); return this; }
	poly(pts, c, a = 1) {
		let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
		for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
		const n = pts.length;
		const inside = (x, y) => {
			let c2 = false;
			for (let i = 0, j = n - 1; i < n; j = i++) {
				const [xi, yi] = pts[i], [xj, yj] = pts[j];
				if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c2 = !c2;
			}
			return c2;
		};
		this._span(x0, y0, x1, y1, inside, c, a); return this;
	}
	ellipse(cx, cy, rx, ry, c, a = 1) {
		this._span(cx - rx, cy - ry, cx + rx, cy + ry, (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1, c, a); return this;
	}
	line(xa, ya, xb, yb, wd, c, a = 1) {
		const dx = xb - xa, dy = yb - ya, L2 = dx * dx + dy * dy || 1, r = wd / 2;
		this._span(Math.min(xa, xb) - r, Math.min(ya, yb) - r, Math.max(xa, xb) + r, Math.max(ya, yb) + r, (x, y) => {
			const t = clamp(((x - xa) * dx + (y - ya) * dy) / L2, 0, 1);
			const px = xa + t * dx - x, py = ya + t * dy - y;
			return px * px + py * py <= r * r;
		}, c, a); return this;
	}
	// Multiply the existing pixels in a region by f (scalar or function).
	shadeRect(x, y, w, h, f) { return this.shadePoly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], f); }
	shadePoly(pts, f) {
		let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
		for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
		const n = pts.length, S = this.S;
		for (let iy = Math.max(0, Math.floor(y0 * S)); iy < Math.min(this.h, Math.ceil(y1 * S)); iy++)
			for (let ix = Math.max(0, Math.floor(x0 * S)); ix < Math.min(this.w, Math.ceil(x1 * S)); ix++) {
				const x = (ix + 0.5) / S, y = (iy + 0.5) / S;
				let c2 = false;
				for (let i = 0, j = n - 1; i < n; j = i++) {
					const [xi, yi] = pts[i], [xj, yj] = pts[j];
					if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c2 = !c2;
				}
				if (!c2) continue;
				const k = (iy * this.w + ix) * 4, m = typeof f === "function" ? f(x, y) : f;
				this.px[k] *= m; this.px[k + 1] *= m; this.px[k + 2] *= m;
			}
		return this;
	}
	// Additive/multiplicative light pool (warm lamp, flashlight, neon...).
	light(cx, cy, rx, ry, color, strength = 1) {
		const S = this.S;
		for (let iy = Math.max(0, Math.floor((cy - ry) * S)); iy < Math.min(this.h, Math.ceil((cy + ry) * S)); iy++)
			for (let ix = Math.max(0, Math.floor((cx - rx) * S)); ix < Math.min(this.w, Math.ceil((cx + rx) * S)); ix++) {
				const x = (ix + 0.5) / S, y = (iy + 0.5) / S;
				const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
				if (d >= 1) continue;
				const f = (1 - d) ** 2 * strength, k = (iy * this.w + ix) * 4;
				this.px[k] += color[0] * f * (this.px[k] / 255 + 0.25);
				this.px[k + 1] += color[1] * f * (this.px[k + 1] / 255 + 0.25);
				this.px[k + 2] += color[2] * f * (this.px[k + 2] / 255 + 0.25);
			}
		return this;
	}
	vignette(str = 0.35) {
		for (let iy = 0; iy < this.h; iy++) for (let ix = 0; ix < this.w; ix++) {
			const x = ix / this.w - 0.5, y = iy / this.h - 0.5, f = 1 - str * (x * x * 1.6 + y * y * 2.2);
			const k = (iy * this.w + ix) * 4; this.px[k] *= f; this.px[k + 1] *= f; this.px[k + 2] *= f;
		}
		return this;
	}
	grain(amt = 6, seed = 3) {
		for (let iy = 0; iy < this.h; iy++) for (let ix = 0; ix < this.w; ix++) {
			const n = (hash(ix, iy, seed) - 0.5) * amt, k = (iy * this.w + ix) * 4;
			this.px[k] += n; this.px[k + 1] += n; this.px[k + 2] += n;
		}
		return this;
	}
	// Draw an image ({w,h,px}) scaled into a destination rect.
	image(img, dx, dy, dw, dh) {
		this._span(dx, dy, dx + dw, dy + dh, null, (x, y) => {
			const sx = Math.min(img.w - 1, Math.floor((x - dx) / dw * img.w)), sy = Math.min(img.h - 1, Math.floor((y - dy) / dh * img.h));
			const i = (sy * img.w + sx) * 4;
			return [img.px[i], img.px[i + 1], img.px[i + 2], img.px[i + 3] / 255];
		}, 1);
		return this;
	}

	// --- output ---------------------------------------------------------------
	downsample() {
		const { W, H, S, w } = this, out = new Float32Array(W * H * 4);
		for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
			let r = 0, g = 0, b = 0, a = 0;
			for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
				const k = ((y * S + sy) * w + x * S + sx) * 4, pa = this.px[k + 3];
				r += this.px[k] * pa; g += this.px[k + 1] * pa; b += this.px[k + 2] * pa; a += pa;
			}
			const k = (y * W + x) * 4, n = S * S;
			out[k] = a ? r / a : 0; out[k + 1] = a ? g / a : 0; out[k + 2] = a ? b / a : 0; out[k + 3] = a / n;
		}
		return out;
	}
	// Save as a 256-color VGA-style PNG.
	save(file, { colors = 256, dither = 6, transparent = false } = {}) {
		const f = this.downsample(), N = this.W * this.H;
		const px = new Uint8Array(N * 4);
		const pal = medianCut(f, N, colors);
		const B = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
		const cache = new Map();
		for (let i = 0; i < N; i++) {
			const x = i % this.W, y = (i / this.W) | 0, k = i * 4;
			if (transparent && f[k + 3] < 0.5) continue;
			const d = (B[(y & 3) * 4 + (x & 3)] / 16 - 0.5) * dither;
			const r = clamp(f[k] + d), g = clamp(f[k + 1] + d), b = clamp(f[k + 2] + d);
			const key = ((r >> 2) << 12) | ((g >> 2) << 6) | (b >> 2);
			let best = cache.get(key);
			if (best === undefined) {
				let bd = 1e9; best = 0;
				for (let p = 0; p < pal.length; p++) {
					const dr = pal[p][0] - r, dg = pal[p][1] - g, db = pal[p][2] - b, dd = dr * dr * 3 + dg * dg * 4 + db * db * 2;
					if (dd < bd) { bd = dd; best = p; }
				}
				cache.set(key, best);
			}
			px[k] = pal[best][0]; px[k + 1] = pal[best][1]; px[k + 2] = pal[best][2]; px[k + 3] = 255;
		}
		fs.writeFileSync(file, encodePNG(this.W, this.H, px));
		return this;
	}
}

function medianCut(f, N, colors) {
	const pts = [];
	for (let i = 0; i < N; i++) if (f[i * 4 + 3] >= 0.5) pts.push([clamp(f[i * 4]), clamp(f[i * 4 + 1]), clamp(f[i * 4 + 2])]);
	if (!pts.length) return [[0, 0, 0]];
	let boxes = [pts];
	while (boxes.length < colors) {
		let bi = -1, br = -1, bc = 0;
		for (let i = 0; i < boxes.length; i++) {
			const b = boxes[i]; if (b.length < 2) continue;
			for (let c = 0; c < 3; c++) {
				let mn = 1e9, mx = -1e9; for (const p of b) { if (p[c] < mn) mn = p[c]; if (p[c] > mx) mx = p[c]; }
				const r = (mx - mn) * Math.sqrt(b.length);
				if (r > br) { br = r; bi = i; bc = c; }
			}
		}
		if (bi < 0) break;
		const b = boxes[bi].sort((p, q) => p[bc] - q[bc]), m = b.length >> 1;
		boxes.splice(bi, 1, b.slice(0, m), b.slice(m));
	}
	return boxes.map(b => { const s = [0, 0, 0]; for (const p of b) { s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; } return s.map(v => Math.round(v / b.length)); });
}

// ---------------------------------------------------------------------------
// Texture shaders (return functions (x,y)->[r,g,b])
// ---------------------------------------------------------------------------
const tex = {
	noise: (base, amt = 0.12, sc = 0.5, seed = 1) => (x, y) => mul(base, 1 + (fbm(x * sc, y * sc, 3, seed) - 0.5) * amt * 2),
	vgrad: (top, bot, y0, y1, n = 0.04) => (x, y) => mul(mix(top, bot, clamp((y - y0) / (y1 - y0), 0, 1)), 1 + (hash(x * 7 | 0, y * 7 | 0) - 0.5) * n),
	hgrad: (l, r, x0, x1) => (x, y) => mix(l, r, clamp((x - x0) / (x1 - x0), 0, 1)),
	carpet: (base, sc = 1.4) => (x, y) => mul(base, 0.86 + fbm(x * sc, y * sc * 1.3, 2, 9) * 0.22 + (hash(x * 2 | 0, y * 2 | 0, 4) - 0.5) * 0.08),
	stucco: (base) => (x, y) => mul(base, 0.9 + fbm(x * 0.8, y * 0.8, 3, 5) * 0.16 + (hash(x * 3 | 0, y * 3 | 0) - 0.5) * 0.06),
	wood: (base, vertical = false, plank = 6) => (x, y) => {
		const u = vertical ? x : y, v = vertical ? y : x;
		const pl = Math.floor(u / plank), grain = Math.sin(v * 0.35 + fbm(u * 0.3, v * 0.05 + pl * 9, 3, pl) * 8) * 0.06;
		const seam = (u % plank) < 0.6 ? 0.7 : 1;
		return mul(base, (0.88 + hash(pl, 1, 7) * 0.2 + grain) * seam);
	},
	brick: (base, mortar, bw = 10, bh = 4) => (x, y) => {
		const row = Math.floor(y / bh), off = (row & 1) * bw / 2, col = Math.floor((x + off) / bw);
		if ((y % bh) < 0.8 || ((x + off) % bw) < 0.8) return mul(mortar, 0.9 + hash(x * 3 | 0, y * 3 | 0) * 0.2);
		return mul(base, 0.8 + hash(col, row, 2) * 0.3 + (fbm(x, y, 2) - 0.5) * 0.2);
	},
	tiles: (base, grout, size = 8) => (x, y) => {
		if ((x % size) < 0.7 || (y % size) < 0.7) return grout;
		return mul(base, 0.94 + hash(Math.floor(x / size), Math.floor(y / size), 3) * 0.1);
	},
	corrugated: (base, period = 4) => (x, y) => mul(base, 0.78 + 0.28 * (0.5 + 0.5 * Math.sin(x / period * Math.PI * 2)) + (fbm(x * 0.2, y * 0.2, 3, 11) - 0.5) * 0.25),
	// Perspective floor: map screen to ground plane around a vanishing point.
	floor: (vx, vy, fn, depth = 60) => (x, y) => {
		const dz = Math.max(0.5, y - vy), Z = depth / dz, X = (x - vx) * Z * 0.12;
		const shade = clamp(0.62 + dz / 160, 0.55, 1.05);
		return mul(fn(X * 10, Z * 10), shade);
	},
};

module.exports = { Painter, tex, fbm, vnoise, hash, mix, mul, clamp };
