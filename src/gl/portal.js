// One floating, gently curved screen per assignment. A live assignment plays
// its silent teaser loop (or shows its poster); a pending one shows tinted
// static with glyph rain falling behind it.
import * as THREE from "three";
import { buildAtlas, atlasGLSL } from "./glyphs.js";
import { isLive } from "../content.js";

export const SCREEN = { w: 6.4, h: 3.6, bend: 0.9 };

const screenVertex = /* glsl */ `
  uniform float uBend;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 p = position;
    // Edges curve toward the viewer.
    p.z += uBend * pow(p.x / ${(SCREEN.w / 2).toFixed(2)}, 2.0);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const screenFragment = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uHasMap;
  uniform float uLive;
  uniform float uTime;
  uniform float uVis;
  uniform float uFocus;
  uniform vec3 uTint;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  void main() {
    vec2 uv = vUv;
    vec3 picture = texture2D(uMap, uv).rgb * uHasMap;
    float n = hash(floor(uv * vec2(220.0, 124.0)) + floor(uTime * 14.0) * 1.7);
    float roll = smoothstep(0.0, 0.02, abs(fract(uv.y * 0.6 - uTime * 0.08) - 0.5));
    vec3 noise = uTint * (0.05 + 0.2 * n * n) * (0.75 + 0.25 * roll);
    vec3 col = mix(noise, picture * 0.72, uLive * uHasMap);
    // Scanlines and a soft vignette, like light from a real panel.
    col *= 0.9 + 0.1 * sin(uv.y * 900.0);
    vec2 c = uv - 0.5;
    col *= 1.0 - dot(c, c) * 0.9;
    // A thin frame of the assignment's tint.
    vec2 e = min(uv, 1.0 - uv);
    float frame = 1.0 - smoothstep(0.0, 0.006, min(e.x, e.y * 1.78));
    col += uTint * frame * (0.6 + uFocus);
    gl_FragColor = vec4(col * uVis, 1.0);
  }
`;

const glowVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const glowFragment = /* glsl */ `
  uniform vec3 uTint;
  uniform float uIntensity;
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    vec2 c = (vUv - 0.5) * vec2(1.0, 1.7);
    float d = length(c) * 2.0;
    float a = pow(max(0.0, 1.0 - d), 2.0) * uIntensity * (0.92 + 0.08 * sin(uTime * 3.1));
    gl_FragColor = vec4(uTint * a, 1.0);
  }
`;

const rainVertex = /* glsl */ `
  attribute vec4 aRain; // x, y0, z, seed
  uniform float uTime;
  uniform float uProj;
  varying float vSeed;
  varying float vFade;
  void main() {
    float seed = aRain.w;
    float y = 4.5 - mod(aRain.y + uTime * (0.25 + seed * 0.6), 9.0);
    vec4 mv = modelViewMatrix * vec4(aRain.x, y, aRain.z, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = clamp(0.16 * uProj / -mv.z, 1.0, 40.0);
    vSeed = seed;
    vFade = smoothstep(4.5, 3.0, abs(y));
  }
`;

const rainFragment = /* glsl */ `
  uniform sampler2D uAtlas;
  uniform vec3 uTint;
  uniform float uTime;
  uniform float uVis;
  varying float vSeed;
  varying float vFade;
  ${atlasGLSL}
  void main() {
    float index = mod(floor(vSeed * 997.0) + floor(uTime * (1.0 + vSeed * 3.0)), 64.0);
    vec2 pc = vec2(gl_PointCoord.x, 1.0 - gl_PointCoord.y);
    float g = texture2D(uAtlas, atlasUv(index, pc)).a;
    float a = g * vFade * uVis * (0.25 + 0.5 * step(0.85, vSeed));
    if (a < 0.01) discard;
    gl_FragColor = vec4(uTint * a, 1.0);
  }
`;

const additive = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending };

function createRain(tint, count) {
  const data = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    data[i * 4] = (Math.random() - 0.5) * 12;
    data[i * 4 + 1] = Math.random() * 9;
    data[i * 4 + 2] = -1.5 - Math.random() * 5;
    data[i * 4 + 3] = Math.random();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geometry.setAttribute("aRain", new THREE.BufferAttribute(data, 4));
  const uniforms = {
    uAtlas: { value: buildAtlas() },
    uTint: { value: tint.clone().multiplyScalar(1.3) },
    uTime: { value: 0 },
    uProj: { value: 800 },
    uVis: { value: 0 },
  };
  const points = new THREE.Points(
    geometry,
    new THREE.ShaderMaterial({ vertexShader: rainVertex, fragmentShader: rainFragment, uniforms, ...additive }),
  );
  points.frustumCulled = false;
  return { points, uniforms };
}

export function createPortals(assignments, { rain = 260 } = {}) {
  const group = new THREE.Group();
  const blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  blank.needsUpdate = true;
  const geometry = new THREE.PlaneGeometry(SCREEN.w, SCREEN.h, 48, 1);
  const glowPlane = new THREE.PlaneGeometry(1, 1);
  const loader = new THREE.TextureLoader();

  const portals = assignments.map((item) => {
    const tint = new THREE.Color(item.tint);
    const live = isLive(item);
    const node = new THREE.Group();

    const uniforms = {
      uMap: { value: blank },
      uHasMap: { value: 0 },
      uLive: { value: live ? 1 : 0 },
      uTime: { value: 0 },
      uVis: { value: 1 },
      uFocus: { value: 0 },
      uBend: { value: -SCREEN.bend },
      uTint: { value: tint.clone().multiplyScalar(1.2) },
    };
    const screen = new THREE.Mesh(
      geometry,
      // Additive, so a distant or fading screen reads as dim light, never a black hole.
      new THREE.ShaderMaterial({ vertexShader: screenVertex, fragmentShader: screenFragment, uniforms, side: THREE.DoubleSide, ...additive }),
    );

    const glowUniforms = { uTint: { value: tint.clone() }, uIntensity: { value: 0 }, uTime: uniforms.uTime };
    const glow = new THREE.Mesh(
      glowPlane,
      new THREE.ShaderMaterial({ vertexShader: glowVertex, fragmentShader: glowFragment, uniforms: glowUniforms, ...additive }),
    );
    glow.scale.set(SCREEN.w * 2.6, SCREEN.h * 3.2, 1);
    glow.position.z = -1.4;

    node.add(glow, screen);
    let drops = null;
    if (!live) {
      drops = createRain(tint, rain);
      drops.uniforms.uTime = uniforms.uTime;
      node.add(drops.points);
    }
    group.add(node);

    // Media is attached lazily, the first time the visitor gets close.
    let video = null;
    let loaded = false;
    function load() {
      if (loaded) return;
      loaded = true;
      if (item.teaser) {
        video = document.createElement("video");
        video.muted = true;
        video.loop = true;
        video.playsInline = true;
        video.preload = "auto";
        video.src = item.teaser;
        const texture = new THREE.VideoTexture(video);
        texture.colorSpace = THREE.SRGBColorSpace;
        video.addEventListener("loadeddata", () => {
          uniforms.uMap.value = texture;
          uniforms.uHasMap.value = 1;
        }, { once: true });
      } else if (item.poster) {
        loader.load(item.poster, (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          uniforms.uMap.value = texture;
          uniforms.uHasMap.value = 1;
        });
      }
    }

    return { node, screen, uniforms, glowUniforms, drops, live, load, get video() { return video; } };
  });

  return {
    group,
    portals,
    layout(placements) {
      placements.forEach(({ position, scale }, i) => {
        portals[i].base = position.clone();
        portals[i].node.position.copy(position);
        portals[i].node.scale.setScalar(scale);
      });
    },
    update({ time, near, proj, fade = 1 }) {
      portals.forEach((portal, i) => {
        const closeness = near[i];
        portal.uniforms.uTime.value = time;
        portal.uniforms.uFocus.value = closeness;
        portal.uniforms.uVis.value = (0.35 + 0.65 * closeness) * fade;
        portal.glowUniforms.uIntensity.value = (portal.live ? 0.55 : 0.28) * (0.3 + 0.7 * closeness) * fade;
        portal.node.rotation.y = -0.12 + Math.sin(time * 0.2 + i) * 0.04;
        if (portal.base) portal.node.position.y = portal.base.y + Math.sin(time * 0.5 + i * 2) * 0.08;
        if (portal.drops) {
          portal.drops.uniforms.uVis.value = closeness;
          portal.drops.uniforms.uProj.value = proj;
        }
        if (closeness > 0.01) portal.load();
        const video = portal.video;
        if (video) {
          if (closeness > 0.05 && video.paused) video.play().catch(() => {});
          else if (closeness <= 0.05 && !video.paused) video.pause();
        }
      });
    },
    pauseAll() {
      for (const portal of portals) portal.video?.pause();
    },
  };
}
