// Cop Quest — image pixelator (no external dependencies).
//
// Turns a real source image (photo / 3D render / AI image, exported as an
// 8-bit PNG) into retro pixel art that matches the game's grid: center-crop to
// the target aspect, area-average downscale, then optional palette quantization
// (posterize, with optional Floyd–Steinberg dithering) and a nearest-neighbor
// pixel feel.
//
// Usage:
//   node tools/pixelate.js <input.png> [output.png] [--w 320] [--h 200]
//                          [--levels 6] [--dither]
//
// Example (drop your image at assets/source/bedroom.png):
//   node tools/pixelate.js assets/source/bedroom.png assets/art/bedroom_bg.png --levels 6 --dither
//
// Source must be an 8-bit, non-interlaced PNG (RGB / RGBA / grayscale). If your
// image is a JPG or 16-bit, re-export it as an 8-bit PNG first.

const fs = require("fs");
const zlib = require("zlib");

// ---------------------------------------------------------------------------
// PNG decode (8-bit, color types 0/2/6, non-interlaced)
// ---------------------------------------------------------------------------
function decodePNG(buf) {
	if (buf.length < 8 || buf.readUInt32BE(0) !== 0x89504e47) throw new Error("not a PNG file");
	let off = 8, W = 0, H = 0, bitDepth = 0, colorType = 0, interlace = 0;
	const idat = [];
	while (off + 8 <= buf.length) {
		const len = buf.readUInt32BE(off);
		const type = buf.toString("ascii", off + 4, off + 8);
		const data = buf.subarray(off + 8, off + 8 + len);
		if (type === "IHDR") {
			W = data.readUInt32BE(0); H = data.readUInt32BE(4);
			bitDepth = data[8]; colorType = data[9]; interlace = data[12];
		} else if (type === "IDAT") idat.push(Buffer.from(data));
		else if (type === "IEND") break;
		off += 12 + len;
	}
	if (bitDepth !== 8) throw new Error(`need an 8-bit PNG (got ${bitDepth}-bit). Re-export as 8-bit.`);
	if (interlace !== 0) throw new Error("interlaced PNG is unsupported. Re-export without interlacing.");
	const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 0 ? 1 : -1;
	if (channels < 0) throw new Error(`unsupported color type ${colorType}. Use RGB, RGBA, or grayscale.`);

	const raw = zlib.inflateSync(Buffer.concat(idat));
	const stride = W * channels;
	const out = new Uint8Array(W * H * 4);
	const prev = new Uint8Array(stride);
	const cur = new Uint8Array(stride);
	const paeth = (a, b, c) => {
		const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
		return pa <= pb && pa <= pc ? a : (pb <= pc ? b : c);
	};
	let p = 0;
	for (let y = 0; y < H; y++) {
		const ft = raw[p++];
		for (let i = 0; i < stride; i++) {
			const x = raw[p++];
			const a = i >= channels ? cur[i - channels] : 0;
			const b = prev[i];
			const c = i >= channels ? prev[i - channels] : 0;
			let v;
			switch (ft) {
				case 0: v = x; break;
				case 1: v = x + a; break;
				case 2: v = x + b; break;
				case 3: v = x + ((a + b) >> 1); break;
				case 4: v = x + paeth(a, b, c); break;
				default: throw new Error("bad PNG filter type " + ft);
			}
			cur[i] = v & 0xff;
		}
		for (let x = 0; x < W; x++) {
			const si = x * channels, di = (y * W + x) * 4;
			if (channels === 4) { out[di] = cur[si]; out[di + 1] = cur[si + 1]; out[di + 2] = cur[si + 2]; out[di + 3] = cur[si + 3]; }
			else if (channels === 3) { out[di] = cur[si]; out[di + 1] = cur[si + 1]; out[di + 2] = cur[si + 2]; out[di + 3] = 255; }
			else { out[di] = out[di + 1] = out[di + 2] = cur[si]; out[di + 3] = 255; }
		}
		prev.set(cur);
	}
	return { w: W, h: H, px: out };
}

// ---------------------------------------------------------------------------
// PNG encode (RGBA, filter none)
// ---------------------------------------------------------------------------
const CRC = (() => {
	const t = new Uint32Array(256);
	for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; }
	return t;
})();
function crc32(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function chunk(type, data) {
	const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
	const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
	const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0);
	return Buffer.concat([len, body, crc]);
}
function encodePNG(w, h, px) {
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
	ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
	const stride = w * 4, raw = Buffer.alloc(h * (stride + 1));
	for (let y = 0; y < h; y++) { raw[y * (stride + 1)] = 0; Buffer.from(px.buffer, px.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1); }
	const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
	return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

// ---------------------------------------------------------------------------
// Processing
// ---------------------------------------------------------------------------
// Area-average resample of a source region into a dw x dh buffer.
function areaResize(src, dw, dh, region) {
	const { cx, cy, cw, ch } = region || { cx: 0, cy: 0, cw: src.w, ch: src.h };
	const out = new Uint8Array(dw * dh * 4);
	for (let ty = 0; ty < dh; ty++) for (let tx = 0; tx < dw; tx++) {
		const sx0 = cx + tx * cw / dw, sx1 = cx + (tx + 1) * cw / dw;
		const sy0 = cy + ty * ch / dh, sy1 = cy + (ty + 1) * ch / dh;
		let r = 0, g = 0, b = 0, a = 0, n = 0;
		for (let sy = Math.floor(sy0); sy < Math.max(Math.ceil(sy1), Math.floor(sy0) + 1); sy++)
			for (let sx = Math.floor(sx0); sx < Math.max(Math.ceil(sx1), Math.floor(sx0) + 1); sx++) {
				if (sx < 0 || sy < 0 || sx >= src.w || sy >= src.h) continue;
				const i = (sy * src.w + sx) * 4; r += src.px[i]; g += src.px[i + 1]; b += src.px[i + 2]; a += src.px[i + 3]; n++;
			}
		if (!n) n = 1;
		const di = (ty * dw + tx) * 4;
		out[di] = r / n; out[di + 1] = g / n; out[di + 2] = b / n; out[di + 3] = a / n;
	}
	return { w: dw, h: dh, px: out };
}

// COVER: center-crop to the target aspect, then downscale to fill (for rooms).
function resizeCover(src, TW, TH) {
	const srcAR = src.w / src.h, dstAR = TW / TH;
	let cw, ch, cx, cy;
	if (srcAR > dstAR) { ch = src.h; cw = Math.round(src.h * dstAR); cx = Math.round((src.w - cw) / 2); cy = 0; }
	else { cw = src.w; ch = Math.round(src.w / dstAR); cx = 0; cy = Math.round((src.h - ch) / 2); }
	return areaResize(src, TW, TH, { cx, cy, cw, ch });
}

// CONTAIN: scale the whole image to fit inside TWxTH (no cropping), center
// horizontally, align vertically (bottom for a standing character), and pad
// with transparency. For sprites/cutouts.
function resizeContain(src, TW, TH, valign) {
	const scale = Math.min(TW / src.w, TH / src.h);
	const sw = Math.max(1, Math.round(src.w * scale)), sh = Math.max(1, Math.round(src.h * scale));
	const fitted = areaResize(src, sw, sh);
	const out = new Uint8Array(TW * TH * 4);
	const ox = Math.floor((TW - sw) / 2);
	const oy = valign === "center" ? Math.floor((TH - sh) / 2) : (TH - sh); // default bottom
	for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
		const di = ((oy + y) * TW + (ox + x)) * 4, si = (y * sw + x) * 4;
		out[di] = fitted.px[si]; out[di + 1] = fitted.px[si + 1]; out[di + 2] = fitted.px[si + 2]; out[di + 3] = fitted.px[si + 3];
	}
	return { w: TW, h: TH, px: out };
}

// Harden anti-aliased edges into a crisp 1-bit alpha cutout.
function alphaThreshold(img, cut) {
	if (!cut) return;
	for (let i = 3; i < img.px.length; i += 4) img.px[i] = img.px[i] >= cut ? 255 : 0;
}

// Remove a solid background: flood-fill from the borders, clearing alpha on any
// pixel within `tol` color distance of the sampled corner color. Connected-only,
// so interior pixels of a similar color are kept.
function bgRemove(img, tol) {
	const { w, h, px } = img;
	let br = 0, bg = 0, bb = 0;
	for (const [cx, cy] of [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]]) { const i = (cy * w + cx) * 4; br += px[i]; bg += px[i + 1]; bb += px[i + 2]; }
	br /= 4; bg /= 4; bb /= 4;
	const t2 = tol * tol, visited = new Uint8Array(w * h), stack = [];
	const push = (x, y) => { if (x < 0 || y < 0 || x >= w || y >= h) return; const p = y * w + x; if (!visited[p]) { visited[p] = 1; stack.push(p); } };
	for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
	for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
	while (stack.length) {
		const p = stack.pop(), i = p * 4, dr = px[i] - br, dg = px[i + 1] - bg, db = px[i + 2] - bb;
		if (dr * dr + dg * dg + db * db <= t2) { px[i + 3] = 0; const x = p % w, y = (p / w) | 0; push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1); }
	}
}

// Crop to the bounding box of non-transparent pixels.
function cropToContent(img) {
	let minX = img.w, minY = img.h, maxX = -1, maxY = -1;
	for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) if (img.px[(y * img.w + x) * 4 + 3] > 8) {
		if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
	}
	if (maxX < 0) return img;
	const w = maxX - minX + 1, h = maxY - minY + 1, out = new Uint8Array(w * h * 4);
	for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
		const s = ((y + minY) * img.w + (x + minX)) * 4, d = (y * w + x) * 4;
		out[d] = img.px[s]; out[d + 1] = img.px[s + 1]; out[d + 2] = img.px[s + 2]; out[d + 3] = img.px[s + 3];
	}
	return { w, h, px: out };
}

// Posterize each channel to `levels` steps; optional Floyd–Steinberg dithering.
function quantize(img, levels, dither) {
	if (!levels || levels < 2) return;
	const step = 255 / (levels - 1);
	const q = (v) => Math.round(Math.round(v / step) * step);
	if (!dither) {
		for (let i = 0; i < img.px.length; i += 4) { img.px[i] = q(img.px[i]); img.px[i + 1] = q(img.px[i + 1]); img.px[i + 2] = q(img.px[i + 2]); }
		return;
	}
	const W = img.w, H = img.h, f = Float32Array.from(img.px);
	const spread = (i, c, err, fac) => { if (i >= 0 && i < f.length) f[i + c] += err * fac; };
	for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
		const i = (y * W + x) * 4;
		for (let c = 0; c < 3; c++) {
			const old = f[i + c], nv = q(old), err = old - nv; f[i + c] = nv;
			if (x + 1 < W) spread((y * W + x + 1) * 4, c, err, 7 / 16);
			if (x - 1 >= 0 && y + 1 < H) spread(((y + 1) * W + x - 1) * 4, c, err, 3 / 16);
			if (y + 1 < H) spread(((y + 1) * W + x) * 4, c, err, 5 / 16);
			if (x + 1 < W && y + 1 < H) spread(((y + 1) * W + x + 1) * 4, c, err, 1 / 16);
		}
	}
	for (let i = 0; i < img.px.length; i++) img.px[i] = Math.max(0, Math.min(255, f[i]));
}

module.exports = { decodePNG, encodePNG, areaResize, resizeCover, resizeContain, quantize, alphaThreshold, bgRemove, cropToContent };

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
if (require.main === module) {
	const args = process.argv.slice(2);
	const flags = { w: 320, h: 200, levels: 6, dither: false, fit: "cover", valign: "bottom", alphacut: 0, bgremove: false, bgtol: 70 };
	const pos = [];
	for (let i = 0; i < args.length; i++) {
		const a = args[i];
		if (a === "--dither") flags.dither = true;
		else if (a === "--w") flags.w = +args[++i];
		else if (a === "--h") flags.h = +args[++i];
		else if (a === "--levels") flags.levels = +args[++i];
		else if (a === "--fit") flags.fit = args[++i];        // cover | contain
		else if (a === "--valign") flags.valign = args[++i];  // bottom | center
		else if (a === "--alphacut") flags.alphacut = +args[++i];
		else if (a === "--bgremove") flags.bgremove = true;
		else if (a === "--bgtol") flags.bgtol = +args[++i];
		else pos.push(a);
	}
	const inPath = pos[0], outPath = pos[1] || "assets/art/bedroom_bg.png";
	if (!inPath) {
		console.log("Usage: node tools/pixelate.js <input.png> [output.png] [options]");
		console.log("  --w N --h N        target size (default 320x200)");
		console.log("  --levels N         colors per channel after posterizing (default 6)");
		console.log("  --dither           Floyd-Steinberg dithering");
		console.log("  --fit cover|contain   cover = crop to fill (rooms); contain = fit whole image (sprites)");
		console.log("  --valign bottom|center  vertical align for contain (default bottom)");
		console.log("  --alphacut N       harden alpha edges at threshold N (e.g. 128) for crisp cutouts");
		console.log("\nRoom:   node tools/pixelate.js assets/source/bedroom.png assets/art/bedroom_bg.png --levels 6 --dither");
		console.log("Sprite: node tools/pixelate.js assets/source/officer.png assets/art/officer.png --w 40 --h 56 --fit contain --alphacut 128");
		process.exit(1);
	}
	let src = decodePNG(fs.readFileSync(inPath));
	if (flags.bgremove) bgRemove(src, flags.bgtol);
	if (flags.fit === "contain") src = cropToContent(src); // trim transparent margins so feet reach the bottom
	const small = flags.fit === "contain"
		? resizeContain(src, flags.w, flags.h, flags.valign)
		: resizeCover(src, flags.w, flags.h);
	quantize(small, flags.levels, flags.dither);
	alphaThreshold(small, flags.alphacut);
	fs.writeFileSync(outPath, encodePNG(flags.w, flags.h, small.px));
	console.log(`pixelated ${inPath} (${src.w}x${src.h}) -> ${outPath} (${flags.w}x${flags.h}, fit=${flags.fit}, levels=${flags.levels}, dither=${flags.dither}, alphacut=${flags.alphacut})`);
}
