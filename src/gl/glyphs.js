// The hero title, drawn as a field of terminal cells: one instanced quad per
// cell, each showing a character from a glyph atlas (the same technique the
// A1 report describes for WezTerm's own renderer).
import * as THREE from "three";

const CHARS = Array.from("01{}[]<>/\\|=+-*#$%&@;:.~^_abcdefghijkmnopqrstuvwxyzABCDEFGHKMNRSTXYZ23456789!?").slice(0, 64);
const ATLAS_GRID = 8;
const CELL_ASPECT = 0.6;

function buildAtlas() {
  const tile = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = tile * ATLAS_GRID;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 ${tile * 0.8}px "JetBrains Mono", ui-monospace, monospace`;
  CHARS.forEach((char, i) => {
    const col = i % ATLAS_GRID;
    const row = Math.floor(i / ATLAS_GRID);
    ctx.fillText(char, col * tile + tile / 2, row * tile + tile / 2 + 2);
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  return texture;
}

// Rasterises the word and returns the centre of every cell that lands on ink,
// in units where the word is 1 wide and centred on the origin.
function sampleWord(text, columns) {
  const size = 240;
  const font = `700 ${size}px "Fraunces", Georgia, serif`;
  const probe = document.createElement("canvas").getContext("2d");
  probe.font = font;
  const width = Math.ceil(probe.measureText(text).width);
  const height = Math.ceil(size * 1.3);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.font = font;
  ctx.fillStyle = "#fff";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 0, height / 2);
  const pixels = ctx.getImageData(0, 0, width, height).data;

  const cellW = width / columns;
  const cellH = cellW / CELL_ASPECT;
  const rows = Math.floor(height / cellH);
  const cells = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const x = Math.floor((col + 0.5) * cellW);
      const y = Math.floor((row + 0.5) * cellH);
      if (pixels[(y * width + x) * 4 + 3] > 120) {
        cells.push([(x - width / 2) / width, (height / 2 - y) / width]);
      }
    }
  }
  return { cells, cell: [1 / columns, 1 / columns / CELL_ASPECT] };
}

const vertexShader = /* glsl */ `
  attribute vec3 aTarget;
  attribute vec3 aRand;
  attribute float aSeed;
  uniform float uTime;
  uniform float uAssemble;
  uniform float uScatter;
  uniform vec2 uMouse;
  uniform vec2 uCell;
  varying vec2 vUv;
  varying float vSeed;
  varying float vHot;
  varying float vIndex;

  void main() {
    float arrive = clamp(uAssemble * 1.7 - aSeed * 0.7, 0.0, 1.0);
    arrive = 1.0 - pow(1.0 - arrive, 3.0);
    vec3 start = vec3(aRand.xy * vec2(26.0, 15.0), -18.0 + aRand.z * 26.0);
    vec3 p = mix(start, aTarget, arrive);
    p.z += sin(uTime * 0.9 + aSeed * 40.0) * 0.035 * arrive;

    // Cells near the pointer scatter and come back.
    vec2 away = p.xy - uMouse;
    float hot = smoothstep(1.7, 0.0, length(away)) * arrive * (1.0 - uScatter);
    p.xy += normalize(away + 0.0001) * hot * 0.8;
    p.z += hot * 1.4 * (aSeed - 0.35);

    // On scroll the word breaks into a tunnel the camera flies through.
    float s = uScatter * uScatter;
    p.xy += aRand.xy * (5.0 + 13.0 * aSeed) * s;
    p.z += aRand.z * 16.0 * s;

    vec3 corner = vec3(position.xy * uCell * (1.0 + hot * 0.6 + s * 1.5), 0.0);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p + corner, 1.0);

    // Most cells keep their character; a few keep cycling.
    float cycle = step(0.82, aSeed) * floor(uTime * (2.0 + aSeed * 5.0));
    vIndex = mod(floor(aSeed * 997.0) + cycle, 64.0);
    vUv = uv;
    vSeed = aSeed;
    vHot = hot;
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uAtlas;
  uniform float uScatter;
  uniform float uAssemble;
  uniform vec3 uGold;
  uniform vec3 uPale;
  uniform vec3 uSignal;
  varying vec2 vUv;
  varying float vSeed;
  varying float vHot;
  varying float vIndex;

  void main() {
    float col = mod(vIndex, 8.0);
    float row = floor(vIndex / 8.0);
    vec2 uv = (vec2(col, 7.0 - row) + vUv) / 8.0;
    float glyph = texture2D(uAtlas, uv).a;

    vec3 color = mix(uGold, uPale, step(0.7, fract(vSeed * 13.0)));
    color = mix(color, uSignal, vHot);
    // A faint filled cell behind each character keeps the word readable.
    float alpha = glyph * (0.7 + 0.3 * fract(vSeed * 7.0)) + 0.42 * (1.0 - smoothstep(0.0, 0.45, uScatter));
    alpha *= 1.0 - smoothstep(0.45, 1.0, uScatter) * 0.75;
    alpha *= smoothstep(0.0, 0.25, uAssemble);
    gl_FragColor = vec4(color * alpha, alpha);
  }
`;

export function createGlyphField(text) {
  const atlas = buildAtlas();
  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
    uniforms: {
      uAtlas: { value: atlas },
      uTime: { value: 0 },
      uAssemble: { value: 0 },
      uScatter: { value: 0 },
      uMouse: { value: new THREE.Vector2(999, 999) },
      uCell: { value: new THREE.Vector2(0.1, 0.16) },
      uGold: { value: new THREE.Color("#e8c468") },
      uPale: { value: new THREE.Color("#f6edd6") },
      uSignal: { value: new THREE.Color("#6fd3ff") },
    },
  });

  const mesh = new THREE.Mesh(new THREE.InstancedBufferGeometry(), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 5;

  // width and centre are in world units; columns sets the cell resolution.
  function layout({ width, centerX, centerY, columns }) {
    const { cells, cell } = sampleWord(text, columns);
    const count = cells.length;
    const target = new Float32Array(count * 3);
    const rand = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      target[i * 3] = cells[i][0] * width + centerX;
      target[i * 3 + 1] = cells[i][1] * width + centerY;
      target[i * 3 + 2] = 0;
      rand[i * 3] = Math.random() * 2 - 1;
      rand[i * 3 + 1] = Math.random() * 2 - 1;
      rand[i * 3 + 2] = Math.random();
      seed[i] = Math.random();
    }
    const plane = new THREE.PlaneGeometry(1, 1);
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.index = plane.index;
    geometry.setAttribute("position", plane.attributes.position);
    geometry.setAttribute("uv", plane.attributes.uv);
    geometry.setAttribute("aTarget", new THREE.InstancedBufferAttribute(target, 3));
    geometry.setAttribute("aRand", new THREE.InstancedBufferAttribute(rand, 3));
    geometry.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seed, 1));
    geometry.instanceCount = count;
    mesh.geometry.dispose();
    mesh.geometry = geometry;
    material.uniforms.uCell.value.set(cell[0] * width * 0.86, cell[1] * width * 0.9);
    return count;
  }

  return { mesh, uniforms: material.uniforms, layout };
}
