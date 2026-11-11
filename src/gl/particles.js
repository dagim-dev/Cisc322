// The hero name as living light: a GPU particle simulation (positions and
// velocities stored in float textures). Each particle is drawn as a glyph
// from the atlas. Modes, all blended by uniforms:
//   form  — spring toward the sampled shape of the word
//   flow  — divergence-free swirl (ABC flow), always on a little
//   stir  — the pointer drags nearby particles, like ink in water
//   pour  — on scroll, particles release and rush toward the camera
import * as THREE from "three";
import { GPUComputationRenderer } from "three/examples/jsm/misc/GPUComputationRenderer.js";
import { buildAtlas, sampleWord, atlasGLSL } from "./glyphs.js";

const flowGLSL = /* glsl */ `
  vec3 abc(vec3 q) {
    return vec3(sin(q.z) + 0.5 * cos(q.y), 0.7 * sin(q.x) + cos(q.z), 0.5 * sin(q.y) + 0.7 * cos(q.x));
  }
  vec3 flow(vec3 p, float t) {
    return abc(p * 0.55 + vec3(0.0, t * 0.13, t * 0.09)) + 0.55 * abc(p * 1.7 + vec3(t * 0.21, 0.0, -t * 0.17));
  }
`;

const velocityShader = /* glsl */ `
  uniform sampler2D tTarget;
  uniform float uTime;
  uniform float uDt;
  uniform float uForm;
  uniform float uPour;
  uniform float uTravel;
  uniform vec3 uAnchor;
  uniform float uScale;
  uniform vec3 uCenter;
  uniform vec3 uMouse;
  uniform vec3 uMouseVel;
  uniform float uMouseOn;
  uniform float uRadius;
  ${flowGLSL}

  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec4 P = texture2D(tPos, uv);
    vec3 v = texture2D(tVel, uv).xyz;
    vec3 p = P.xyz;
    float seed = P.w;
    vec3 target = texture2D(tTarget, uv).xyz * uScale + uAnchor;

    // Particles let go one after another as the visitor scrolls.
    float release = smoothstep(seed * 0.75, seed * 0.75 + 0.25, uPour);
    float form = uForm * (1.0 - release);

    vec3 acc = (target - p) * (form * 10.0);
    acc += flow(p / max(uScale, 0.001) * 6.0, uTime) * (0.22 + (1.0 - uForm) * 2.2 + release * 4.0) * uScale * 0.12;

    // Pour: rush toward the camera and fan out from the word's centre.
    vec2 out2 = p.xy - uCenter.xy;
    acc += vec3(out2 * (0.4 + seed * 0.6), 7.0 + 12.0 * seed) * release;

    // Stir: drag along with the pointer, plus a little push aside.
    vec3 d = p - uMouse;
    float fall = exp(-dot(d.xy, d.xy) / (uRadius * uRadius)) * (1.0 - smoothstep(0.5, 2.5, abs(d.z))) * uMouseOn * (1.0 - release);
    acc += uMouseVel * fall * 9.0;
    acc += vec3(normalize(d.xy + 1e-5), 0.6 * (seed - 0.5)) * fall * 6.0;

    v += acc * uDt;
    // Critically damped while forming; looser when free.
    v *= exp(-uDt * (mix(1.2, 6.3, form)));
    float limit = mix(14.0, 120.0, max(uTravel, release));
    float speed = length(v);
    if (speed > limit) v *= limit / speed;
    gl_FragColor = vec4(v, 1.0);
  }
`;

const positionShader = /* glsl */ `
  uniform float uDt;
  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec4 P = texture2D(tPos, uv);
    vec3 v = texture2D(tVel, uv).xyz;
    gl_FragColor = vec4(P.xyz + v * uDt, P.w);
  }
`;

const renderVertex = /* glsl */ `
  uniform sampler2D tPos;
  uniform sampler2D tVel;
  uniform float uSize;
  uniform float uProj;
  uniform float uFocus;
  uniform float uAperture;
  uniform float uAlpha;
  uniform float uTime;
  uniform vec3 uWarm;
  uniform vec3 uPale;
  attribute vec2 ref;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vSoft;
  varying float vGlyph;

  void main() {
    vec4 P = texture2D(tPos, ref);
    vec3 vel = texture2D(tVel, ref).xyz;
    float seed = P.w;
    vec4 mv = modelViewMatrix * vec4(P.xyz, 1.0);
    gl_Position = projectionMatrix * mv;
    float depth = -mv.z;

    // About one in five particles is a large, readable glyph.
    float big = step(0.8, fract(seed * 17.31));
    float px = uSize * mix(1.0, 3.4, big) * uProj / max(depth, 0.05);
    float blur = min(abs(depth - uFocus) * uAperture, 14.0);
    float total = px + blur;
    gl_PointSize = depth < 0.2 ? 0.0 : clamp(total, 1.0, 120.0);

    // Out of focus: bigger, softer, dimmer (same light spread over more area).
    float energy = (px * px) / (total * total);
    vSoft = max(blur / total, 1.0 - smoothstep(3.0, 8.0, total));

    float speed = length(vel);
    vec3 irid = mix(vec3(0.35, 0.85, 1.0), vec3(0.72, 0.5, 1.0), 0.5 + 0.5 * sin(seed * 40.0 + uTime * 0.8));
    vec3 base = mix(uWarm, uPale, big * 0.55 + 0.25 * step(0.6, fract(seed * 5.13)));
    vColor = mix(base, irid, smoothstep(1.2, 7.0, speed));
    vAlpha = uAlpha * mix(1.0, 1.9, big) * max(energy, 0.04) * smoothstep(0.2, 2.0, depth);

    float cycle = step(0.9, fract(seed * 7.7)) * floor(uTime * (1.5 + seed * 5.0));
    vGlyph = mod(floor(seed * 997.0) + cycle, 64.0);
  }
`;

const renderFragment = /* glsl */ `
  uniform sampler2D uAtlas;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vSoft;
  varying float vGlyph;
  ${atlasGLSL}

  void main() {
    vec2 pc = vec2(gl_PointCoord.x, 1.0 - gl_PointCoord.y);
    float glyph = texture2D(uAtlas, atlasUv(vGlyph, pc)).a;
    float d = length(pc - 0.5) * 2.0;
    float disc = 1.0 - smoothstep(0.2, 1.0, d);
    float shape = mix(glyph, disc * 0.75, vSoft);
    if (shape < 0.01) discard;
    gl_FragColor = vec4(vColor * shape * vAlpha, 1.0);
  }
`;

export function createParticles(renderer, { size, text, font, letterSpacing }) {
  const count = size * size;
  const gpu = new GPUComputationRenderer(size, size, renderer);

  // Word shape: target texture (xyz) and a stable seed in w.
  const target = gpu.createTexture();
  const pos0 = gpu.createTexture();
  const vel0 = gpu.createTexture();
  let word = sampleWord(text, font, count, letterSpacing);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) seeds[i] = Math.random();

  function fillTarget() {
    const data = target.image.data;
    for (let i = 0; i < count; i++) {
      data[i * 4] = word.points[i * 2];
      data[i * 4 + 1] = word.points[i * 2 + 1];
      data[i * 4 + 2] = (Math.random() - 0.5) * 0.012;
      data[i * 4 + 3] = seeds[i];
    }
    target.needsUpdate = true;
  }
  fillTarget();

  // Everything starts as one point (the intro's glyph) and bursts outward.
  function fillBurst(center) {
    const p = pos0.image.data;
    const v = vel0.image.data;
    for (let i = 0; i < count; i++) {
      const u = Math.random() * 2 - 1;
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      const speed = 2 + Math.pow(Math.random(), 2) * 14;
      p[i * 4] = center.x + Math.cos(a) * r * 0.01;
      p[i * 4 + 1] = center.y + Math.sin(a) * r * 0.01;
      p[i * 4 + 2] = center.z;
      p[i * 4 + 3] = seeds[i];
      v[i * 4] = Math.cos(a) * r * speed * 1.4;
      v[i * 4 + 1] = Math.sin(a) * r * speed;
      v[i * 4 + 2] = u * speed;
      v[i * 4 + 3] = 1;
    }
  }
  fillBurst({ x: 0, y: 0, z: 0 });

  const velVar = gpu.addVariable("tVel", velocityShader, vel0);
  const posVar = gpu.addVariable("tPos", positionShader, pos0);
  gpu.setVariableDependencies(velVar, [posVar, velVar]);
  gpu.setVariableDependencies(posVar, [posVar, velVar]);

  const sim = {
    tTarget: { value: target },
    uTime: { value: 0 },
    uDt: { value: 0.016 },
    uForm: { value: 0 },
    uPour: { value: 0 },
    uTravel: { value: 0 },
    uAnchor: { value: new THREE.Vector3() },
    uScale: { value: 1 },
    uCenter: { value: new THREE.Vector3() },
    uMouse: { value: new THREE.Vector3(999, 999, 0) },
    uMouseVel: { value: new THREE.Vector3() },
    uMouseOn: { value: 0 },
    uRadius: { value: 0.8 },
  };
  Object.assign(velVar.material.uniforms, sim);
  posVar.material.uniforms.uDt = sim.uDt;

  const error = gpu.init();
  if (error) throw new Error(error);

  // Points that read their position from the simulation.
  const refs = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    refs[i * 2] = ((i % size) + 0.5) / size;
    refs[i * 2 + 1] = (Math.floor(i / size) + 0.5) / size;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geometry.setAttribute("ref", new THREE.BufferAttribute(refs, 2));

  const material = new THREE.ShaderMaterial({
    vertexShader: renderVertex,
    fragmentShader: renderFragment,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      tPos: { value: null },
      tVel: { value: null },
      uAtlas: { value: buildAtlas() },
      uSize: { value: 0.02 },
      uProj: { value: 800 },
      uFocus: { value: 12 },
      uAperture: { value: 3 },
      uAlpha: { value: 0.5 },
      uTime: { value: 0 },
      uWarm: { value: new THREE.Color("#ff9a3c").multiplyScalar(1.4) },
      uPale: { value: new THREE.Color("#ffe6c2").multiplyScalar(1.6) },
    },
  });
  // Fewer particles each carry more light, so every tier looks equally bright.
  material.uniforms.uAlpha.value = 0.38 * Math.sqrt(65536 / count);

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 10;

  let started = false;

  return {
    points,
    sim,
    uniforms: material.uniforms,
    // Re-anchor the word over the heading (world units).
    layout({ left, baseline, width, z = 0 }) {
      sim.uAnchor.value.set(left, baseline, z);
      sim.uScale.value = width;
      sim.uCenter.value.set(left + word.center[0] * width, baseline + word.center[1] * width, z);
      sim.uRadius.value = width * 0.06;
      material.uniforms.uSize.value = width * 0.0016;
    },
    get center() {
      return sim.uCenter.value;
    },
    // Re-seed the burst at the word's centre just before the first frame.
    prime() {
      if (started) return;
      fillBurst(sim.uCenter.value);
      gpu.renderTexture(pos0, gpu.getCurrentRenderTarget(posVar));
      gpu.renderTexture(pos0, gpu.getAlternateRenderTarget(posVar));
      gpu.renderTexture(vel0, gpu.getCurrentRenderTarget(velVar));
      gpu.renderTexture(vel0, gpu.getAlternateRenderTarget(velVar));
      started = true;
    },
    step(dt, time) {
      sim.uDt.value = Math.min(dt, 1 / 30);
      sim.uTime.value = time;
      gpu.compute();
      material.uniforms.tPos.value = gpu.getCurrentRenderTarget(posVar).texture;
      material.uniforms.tVel.value = gpu.getCurrentRenderTarget(velVar).texture;
      material.uniforms.uTime.value = time;
    },
  };
}
