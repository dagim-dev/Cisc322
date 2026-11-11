// Shared glyph material for the world: a texture atlas of terminal characters
// (the same technique WezTerm uses to draw text on the GPU), and a sampler
// that scatters points over the ink of a word.
import * as THREE from "three";

export const CHARS = Array.from("01{}[]<>/\\|=+-*#$%&@;:.~^_abcdefghijkmnopqrstuvwxyzABCDEFGHKMNRSTXYZ23456789!?").slice(0, 64);
export const ATLAS_GRID = 8;

// GLSL helper: atlas UV for glyph `index` at local coordinate `p` (0..1, y up).
export const atlasGLSL = /* glsl */ `
  vec2 atlasUv(float index, vec2 p) {
    float col = mod(index, 8.0);
    float row = floor(index / 8.0);
    return (vec2(col, 7.0 - row) + clamp(p, 0.04, 0.96)) / 8.0;
  }
`;

let atlas = null;

export function buildAtlas() {
  if (atlas) return atlas;
  const tile = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = tile * ATLAS_GRID;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `500 ${tile * 0.78}px "JetBrains Mono", ui-monospace, monospace`;
  CHARS.forEach((char, i) => {
    const col = i % ATLAS_GRID;
    const row = Math.floor(i / ATLAS_GRID);
    ctx.fillText(char, col * tile + tile / 2, row * tile + tile / 2 + 2);
  });
  atlas = new THREE.CanvasTexture(canvas);
  atlas.generateMipmaps = true;
  atlas.minFilter = THREE.LinearMipmapLinearFilter;
  atlas.anisotropy = 4;
  return atlas;
}

// Returns `count` random points on the ink of `text`, set in `font`, in units
// where the word is 1 wide and centred on the origin (y up).
export function sampleWord(text, font, count, letterSpacing = 0) {
  const size = 320;
  const probe = document.createElement("canvas").getContext("2d");
  probe.font = `${font.style} ${font.weight} ${size}px ${font.family}`;
  if ("letterSpacing" in probe) probe.letterSpacing = `${letterSpacing * size}px`;
  const metrics = probe.measureText(text);
  const width = Math.ceil(metrics.width) + 8;
  const ascent = Math.ceil(metrics.actualBoundingBoxAscent || size * 0.8);
  const descent = Math.ceil(metrics.actualBoundingBoxDescent || size * 0.2);
  const height = ascent + descent + 8;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.font = probe.font;
  if ("letterSpacing" in ctx) ctx.letterSpacing = probe.letterSpacing;
  ctx.fillStyle = "#fff";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(text, 4, ascent + 4);
  const pixels = ctx.getImageData(0, 0, width, height).data;

  const ink = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (pixels[(y * width + x) * 4 + 3] > 128) ink.push(x, y);
    }
  }
  // Origin at the start of the baseline, so the word lines up with the
  // heading's own baseline in the page.
  const advance = metrics.width;
  const points = new Float32Array(count * 2);
  const pairs = ink.length / 2;
  for (let i = 0; i < count; i++) {
    const j = Math.floor(Math.random() * pairs) * 2;
    const x = ink[j] + Math.random();
    const y = ink[j + 1] + Math.random();
    points[i * 2] = (x - 4) / advance;
    points[i * 2 + 1] = (ascent + 4 - y) / advance;
  }
  // Centre of the ink, in the same units.
  const center = [0.5, (ascent - descent) / 2 / advance];
  return { points, center };
}
