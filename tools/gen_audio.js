// Cop Quest — synthesized sound effects and title music (AdLib/Sound Blaster
// flavored square & FM-ish tones), written as 22 kHz mono 16-bit WAVs.
//
//   node tools/gen_audio.js
//
// Output -> assets/audio/*.wav

const fs = require("fs");
const path = require("path");
const OUT = path.join(__dirname, "..", "assets/audio");
fs.mkdirSync(OUT, { recursive: true });
const SR = 22050;

function wav(name, samples) {
	const n = samples.length, buf = Buffer.alloc(44 + n * 2);
	buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write("WAVE", 8); buf.write("fmt ", 12);
	buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(SR, 24);
	buf.writeUInt32LE(SR * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write("data", 36); buf.writeUInt32LE(n * 2, 40);
	for (let i = 0; i < n; i++) buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(samples[i] * 32767))), 44 + i * 2);
	fs.writeFileSync(path.join(OUT, name + ".wav"), buf);
	console.log("audio/" + name + ".wav");
}
const buf = (sec) => new Float32Array(Math.ceil(sec * SR));
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
let seed = 1; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;

// FM-ish voice: carrier sine modulated by a sine (OPL2 feel)
function fm(b, t0, dur, freq, vol, { ratio = 2, index = 1.5, attack = 0.01, release = 0.12, square = 0, vib = 0 } = {}) {
	const s0 = Math.floor(t0 * SR), n = Math.floor((dur + release) * SR);
	for (let i = 0; i < n && s0 + i < b.length; i++) {
		const t = i / SR;
		let env = t < attack ? t / attack : t < dur ? 1 - 0.3 * (t - attack) / dur : 0.7 * Math.max(0, 1 - (t - dur) / release);
		const f = freq * (1 + vib * Math.sin(t * 2 * Math.PI * 5.5) * Math.min(1, t * 3));
		const mod = Math.sin(2 * Math.PI * f * ratio * t) * index * (0.4 + 0.6 * env);
		let v = Math.sin(2 * Math.PI * f * t + mod);
		if (square) v = v * (1 - square) + Math.sign(Math.sin(2 * Math.PI * f * t)) * square * 0.6;
		b[s0 + i] += v * env * vol;
	}
}
function noise(b, t0, dur, vol, decay = 20, lp = 0.5) {
	const s0 = Math.floor(t0 * SR); let y = 0;
	for (let i = 0; i < dur * SR && s0 + i < b.length; i++) { y += (rnd() - y) * lp; b[s0 + i] += y * vol * Math.exp(-i / SR * decay); }
}
const norm = (b, peak = 0.85) => { let m = 0; for (const v of b) m = Math.max(m, Math.abs(v)); if (m) for (let i = 0; i < b.length; i++) b[i] *= peak / m; return b; };

// points chime (rising)
{ const b = buf(0.7); [72, 76, 79, 84].forEach((m, i) => fm(b, i * 0.07, 0.12, mtof(m), 0.3, { ratio: 3, index: 0.8, release: 0.3 })); wav("points", norm(b, 0.6)); }
// phone ring (two rings)
{ const b = buf(2.2); for (const st of [0, 1.0]) for (let i = 0; i < 0.75 * SR; i++) { const t = i / SR; const k = Math.floor(st * SR) + i; b[k] += (Math.sin(2 * Math.PI * 440 * t) + Math.sin(2 * Math.PI * 480 * t)) * (Math.sin(2 * Math.PI * 20 * t) > 0 ? 0.3 : 0.05); } wav("ring", norm(b, 0.55)); }
// gunshot
{ const b = buf(0.9); noise(b, 0, 0.9, 1, 9, 0.9); for (let i = 0; i < 0.3 * SR; i++) b[i] += Math.sin(2 * Math.PI * (90 - i / SR * 120) * i / SR) * Math.exp(-i / SR * 12) * 0.8; wav("gun", norm(b, 0.95)); }
// door
{ const b = buf(0.6); noise(b, 0, 0.25, 0.6, 30, 0.15); for (let i = 0; i < 0.35 * SR; i++) b[i] += Math.sin(2 * Math.PI * 70 * i / SR) * Math.exp(-i / SR * 14) * 0.7; wav("door", norm(b, 0.7)); }
// car start + drive away
{ const b = buf(2.0); for (let i = 0; i < b.length; i++) { const t = i / SR, f = 38 + Math.min(1, t * 1.5) * 30 + Math.sin(t * 7) * 3; b[i] = ((t * f) % 1 - 0.5) * 0.5 * Math.min(1, t * 4) * (t > 1.6 ? (2 - t) / 0.4 : 1); } noise(b, 0, 0.4, 0.3, 6, 0.3); wav("car", norm(b, 0.6)); }
// computer beeps
{ const b = buf(0.5); [0, 0.1, 0.2].forEach((t, i) => fm(b, t, 0.06, 1200 + i * 200, 0.3, { square: 1, index: 0, release: 0.01 })); wav("beep", norm(b, 0.4)); }
// handcuffs click
{ const b = buf(0.4); noise(b, 0, 0.05, 1, 80, 0.9); noise(b, 0.12, 0.05, 0.8, 80, 0.9); fm(b, 0, 0.05, 2400, 0.3, { index: 3, release: 0.05 }); wav("cuffs", norm(b, 0.6)); }
// camera shutter
{ const b = buf(0.35); noise(b, 0, 0.04, 1, 60, 0.95); noise(b, 0.09, 0.06, 0.7, 50, 0.6); wav("camera", norm(b, 0.6)); }
// radio squelch
{ const b = buf(0.6); noise(b, 0, 0.5, 0.5, 4, 0.8); for (let i = 0; i < 0.5 * SR; i++) b[i] *= 0.5 + 0.5 * Math.sign(Math.sin(i / SR * 2 * Math.PI * 30)); wav("radio", norm(b, 0.45)); }
// death sting (descending minor)
{ const b = buf(2.4); [64, 63, 62, 57].forEach((m, i) => fm(b, i * 0.35, i === 3 ? 1.2 : 0.3, mtof(m), 0.35, { ratio: 1, index: 2.5, square: 0.3, release: 0.5, vib: i === 3 ? 0.01 : 0 })); fm(b, 1.05, 1.2, mtof(45), 0.35, { ratio: 0.5, index: 1, release: 0.6 }); wav("death", norm(b, 0.7)); }

// --- Title theme: moody police-procedural groove in A minor, ~19 s loop -------------
{
	const bpm = 100, beat = 60 / bpm, bars = 8, b = buf(bars * 4 * beat + 0.01);
	const chords = [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59], [57, 60, 64], [53, 57, 60], [50, 53, 57], [52, 56, 59]];
	const bassPat = [0, 0, 12, 0, 0, 10, 12, 7];
	for (let bar = 0; bar < bars; bar++) {
		const ch = chords[bar], root = ch[0] - 24, t0 = bar * 4 * beat;
		for (let k = 0; k < 8; k++) fm(b, t0 + k * beat / 2, beat * 0.4, mtof(root + bassPat[k]), 0.32, { ratio: 1, index: 2.2, release: 0.05 });
		for (const m of ch) fm(b, t0, 4 * beat * 0.95, mtof(m), 0.07, { ratio: 2, index: 0.6, attack: 0.3, release: 0.3, vib: 0.004 });
		for (let k = 0; k < 4; k++) { noise(b, t0 + k * beat, 0.05, 0.25, 60, 0.95); if (k % 2) noise(b, t0 + k * beat, 0.18, 0.35, 18, 0.5); }
		for (let k = 0; k < 8; k++) noise(b, t0 + k * beat / 2 + beat / 4, 0.03, 0.07, 90, 0.98);
	}
	const mel = [[0, 69, 1.5], [1.5, 72, 0.5], [2, 71, 1], [3, 67, 1], [4, 69, 3], [7.5, 64, 0.5], [8, 65, 1.5], [9.5, 69, 0.5], [10, 67, 1], [11, 64, 1], [12, 67, 2], [14, 71, 2],
		[16, 76, 1.5], [17.5, 74, 0.5], [18, 72, 1], [19, 71, 1], [20, 72, 2], [22, 69, 2], [24, 65, 1.5], [25.5, 69, 0.5], [26, 72, 1], [27, 71, 1], [28, 68, 3], [31, 71, 1]];
	for (const [st, m, d] of mel) fm(b, st * beat, d * beat * 0.9, mtof(m), 0.2, { ratio: 1, index: 1.2, square: 0.35, attack: 0.02, release: 0.1, vib: 0.006 });
	wav("theme", norm(b, 0.7));
}
