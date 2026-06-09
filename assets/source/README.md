# Source images (for pixelation)

Drop full-resolution source images here (photos, 3D renders, AI-generated
images) to be crunched into the game's pixel grid.

**Requirements:** 8-bit, non-interlaced **PNG** (RGB / RGBA / grayscale). If your
image is a JPG or 16-bit, re-export it as an 8-bit PNG first.

## Convert one to a room background

```
# bedroom: drop bedroom.png here, then:
node tools/pixelate.js assets/source/bedroom.png assets/art/bedroom_bg.png --levels 6 --dither
```

Flags:
- `--w` / `--h` — target size (default 320x200, the room resolution).
- `--levels N` — colors per channel after posterizing (lower = more retro;
  try 4–8). Omit dithering for flat bands, add `--dither` for smoother gradients.
- `--dither` — Floyd–Steinberg dithering.

The image is **center-cropped** to the 320x200 aspect (no stretching), then
area-averaged down and quantized. Tweak `--levels` to taste and re-run.

> Source images here are git-ignored by default (they can be large). Commit one
> deliberately if you want it version-controlled.
