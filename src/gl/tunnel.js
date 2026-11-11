// The warp between the hero and the team: a long tube of glyphs on the walls
// of a cylinder. Glyphs stretch into streaks as the camera speeds up.
import * as THREE from "three";
import { buildAtlas, atlasGLSL } from "./glyphs.js";

const vertexShader = /* glsl */ `
  attribute vec4 aGlyph; // angle, z, radius, seed
  uniform float uTime;
  uniform float uSpeed;
  varying vec2 vUv;
  varying float vSeed;
  varying float vDist;
  varying float vZ;

  void main() {
    float seed = aGlyph.w;
    float dir = seed > 0.5 ? 1.0 : -1.0;
    float ang = aGlyph.x + uTime * 0.04 * dir * (0.4 + seed);
    float r = aGlyph.z;
    vec3 center = vec3(cos(ang) * r, sin(ang) * r, aGlyph.y);
    vec3 tangent = vec3(-sin(ang), cos(ang), 0.0);
    float stretch = 1.0 + uSpeed * (0.05 + 0.09 * seed);
    vec3 world = center + tangent * position.x * 0.24 + vec3(0.0, 0.0, position.y * 0.34 * stretch);
    vec4 mv = modelViewMatrix * vec4(world, 1.0);
    gl_Position = projectionMatrix * mv;
    vUv = uv;
    vSeed = seed;
    vDist = -mv.z;
    vZ = aGlyph.y;
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uAtlas;
  uniform float uTime;
  uniform float uOpacity;
  uniform float uSpeed;
  uniform vec3 uNear;
  uniform vec3 uFar;
  uniform vec2 uRange;
  varying vec2 vUv;
  varying float vSeed;
  varying float vDist;
  varying float vZ;
  ${atlasGLSL}

  void main() {
    float cycle = step(0.75, fract(vSeed * 11.0)) * floor(uTime * (2.0 + vSeed * 6.0));
    float index = mod(floor(vSeed * 991.0) + cycle, 64.0);
    float glyph = texture2D(uAtlas, atlasUv(index, vUv)).a;
    // At speed, glyphs smear into light streaks.
    float streak = (1.0 - abs(vUv.x - 0.5) * 2.0) * 0.55;
    float shape = mix(glyph, streak, smoothstep(2.0, 12.0, uSpeed));
    float t = clamp((vZ - uRange.x) / (uRange.y - uRange.x), 0.0, 1.0);
    vec3 color = mix(uNear, uFar, t) * (0.6 + 0.8 * step(0.86, fract(vSeed * 3.7)));
    float fade = smoothstep(0.6, 4.0, vDist) * (1.0 - smoothstep(18.0, 46.0, vDist));
    float alpha = shape * fade * uOpacity;
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(color * alpha, 1.0);
  }
`;

export function createTunnel({ rings, perRing, start = -6, end = -86 }) {
  const count = rings * perRing;
  const data = new Float32Array(count * 4);
  for (let r = 0; r < rings; r++) {
    const z = start + (end - start) * (r / (rings - 1)) + (Math.random() - 0.5) * 0.8;
    for (let i = 0; i < perRing; i++) {
      const k = (r * perRing + i) * 4;
      data[k] = (i / perRing) * Math.PI * 2 + Math.random() * 0.3;
      data[k + 1] = z + (Math.random() - 0.5) * 1.2;
      data[k + 2] = 3.2 + Math.pow(Math.random(), 2) * 4.5;
      data[k + 3] = Math.random();
    }
  }
  const plane = new THREE.PlaneGeometry(1, 1);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.index = plane.index;
  geometry.setAttribute("position", plane.attributes.position);
  geometry.setAttribute("uv", plane.attributes.uv);
  geometry.setAttribute("aGlyph", new THREE.InstancedBufferAttribute(data, 4));
  geometry.instanceCount = count;

  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uAtlas: { value: buildAtlas() },
      uTime: { value: 0 },
      uSpeed: { value: 0 },
      uOpacity: { value: 0 },
      uNear: { value: new THREE.Color("#ffb35c").multiplyScalar(1.3) },
      uFar: { value: new THREE.Color("#8f6bff").multiplyScalar(1.5) },
      uRange: { value: new THREE.Vector2(start, end) },
    },
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 4;
  return { mesh, uniforms: material.uniforms };
}
