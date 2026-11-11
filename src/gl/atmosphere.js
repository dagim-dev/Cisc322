// Air and sky: a gradient nebula dome that follows the camera, drifting dust
// with depth of field, and soft fog cards. Colours change by chapter.
import * as THREE from "three";

const skyVertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const skyFragment = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uBottom;
  uniform vec3 uGlow;
  uniform float uTime;
  varying vec3 vDir;

  float hash(vec3 p) { return fract(sin(dot(p, vec3(17.1, 113.7, 41.3))) * 43758.5453); }
  float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
      f.z);
  }
  float fbm(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p *= 2.03;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec3 d = normalize(vDir);
    vec3 col = mix(uBottom, uTop, smoothstep(-0.6, 0.8, d.y));
    float clouds = fbm(d * 2.4 + vec3(uTime * 0.01, 0.0, uTime * 0.006));
    float glow = smoothstep(0.35, 0.85, clouds) * (0.6 + 0.4 * smoothstep(-0.2, 0.6, d.y));
    col += uGlow * glow * 1.1;
    // Faint horizon band.
    col += uGlow * 0.25 * exp(-abs(d.y) * 6.0);
    gl_FragColor = vec4(col, 1.0);
  }
`;

const dustVertex = /* glsl */ `
  attribute vec4 aDust;
  uniform vec3 uBox;
  uniform vec3 uCam;
  uniform float uTime;
  uniform float uProj;
  uniform float uFocus;
  uniform float uAperture;
  varying float vAlpha;
  varying float vSoft;
  void main() {
    // Dust lives in a box that wraps around the camera, so it is everywhere.
    vec3 p = aDust.xyz * uBox;
    p.y += sin(uTime * 0.2 + aDust.w * 30.0) * 0.4;
    p.x += cos(uTime * 0.15 + aDust.w * 20.0) * 0.4;
    p = uCam + mod(p - uCam + uBox * 0.5, uBox) - uBox * 0.5;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float depth = -mv.z;
    float px = 0.05 * uProj / max(depth, 0.1);
    float blur = min(abs(depth - uFocus) * uAperture, 30.0);
    float total = px + blur;
    gl_PointSize = depth < 0.3 ? 0.0 : clamp(total, 1.0, 64.0);
    vSoft = blur / total;
    vAlpha = (px * px) / (total * total) * (0.4 + aDust.w) * smoothstep(0.3, 3.0, depth) * (1.0 - smoothstep(16.0, 27.0, depth));
  }
`;

const dustFragment = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;
  varying float vSoft;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float a = (1.0 - smoothstep(mix(0.3, 0.0, vSoft), 1.0, d)) * max(vAlpha, 0.02);
    gl_FragColor = vec4(uColor * a, 1.0);
  }
`;

const fogVertex = /* glsl */ `
  attribute vec4 aFog;
  uniform vec3 uMin;
  uniform vec3 uMax;
  uniform float uTime;
  varying vec2 vUv;
  varying float vSeed;
  varying float vFade;
  void main() {
    vec3 c = mix(uMin, uMax, aFog.xyz);
    c.x += sin(uTime * 0.05 + aFog.w * 12.0) * 2.0;
    vec4 mv = modelViewMatrix * vec4(c, 1.0);
    float size = 14.0 + aFog.w * 16.0;
    mv.xy += position.xy * size;
    gl_Position = projectionMatrix * mv;
    vUv = uv;
    vSeed = aFog.w;
    float depth = -mv.z;
    vFade = smoothstep(2.0, 12.0, depth) * (1.0 - smoothstep(45.0, 80.0, depth));
  }
`;

const fogFragment = /* glsl */ `
  uniform sampler2D uNoise;
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uDensity;
  varying vec2 vUv;
  varying float vSeed;
  varying float vFade;
  void main() {
    vec2 c = vUv - 0.5;
    float r = 1.0 - smoothstep(0.1, 0.5, length(c));
    float n = texture2D(uNoise, vUv * 0.9 + vec2(vSeed * 3.0 + uTime * 0.008, vSeed * 1.7)).r;
    float a = r * n * vFade * uDensity;
    gl_FragColor = vec4(uColor * a, 1.0);
  }
`;

function noiseTexture() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, size, size);
  // Layered soft blobs make a cheap, tileable-enough cloud.
  for (let layer = 0; layer < 3; layer++) {
    const n = 18 * (layer + 1);
    for (let i = 0; i < n; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const r = (size / (layer + 1.4)) * (0.2 + Math.random() * 0.4);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      const a = 0.12 / (layer + 1);
      g.addColorStop(0, `rgba(255,255,255,${a})`);
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function unitAttribute(count) {
  const data = new Float32Array(count * 4);
  for (let i = 0; i < data.length; i++) data[i] = Math.random();
  return data;
}

export function createAtmosphere({ dust, fog }) {
  const group = new THREE.Group();

  const skyUniforms = {
    uTop: { value: new THREE.Color() },
    uBottom: { value: new THREE.Color() },
    uGlow: { value: new THREE.Color() },
    uTime: { value: 0 },
  };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(400, 48, 24),
    new THREE.ShaderMaterial({
      vertexShader: skyVertex,
      fragmentShader: skyFragment,
      uniforms: skyUniforms,
      side: THREE.BackSide,
      depthWrite: false,
    }),
  );
  sky.renderOrder = -10;
  sky.frustumCulled = false;

  const dustGeometry = new THREE.BufferGeometry();
  dustGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(dust * 3), 3));
  dustGeometry.setAttribute("aDust", new THREE.BufferAttribute(unitAttribute(dust), 4));
  const dustUniforms = {
    uBox: { value: new THREE.Vector3(44, 26, 58) },
    uCam: { value: new THREE.Vector3() },
    uTime: { value: 0 },
    uProj: { value: 800 },
    uFocus: { value: 12 },
    uAperture: { value: 2 },
    uColor: { value: new THREE.Color() },
  };
  const dustPoints = new THREE.Points(
    dustGeometry,
    new THREE.ShaderMaterial({
      vertexShader: dustVertex,
      fragmentShader: dustFragment,
      uniforms: dustUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  dustPoints.frustumCulled = false;

  const plane = new THREE.PlaneGeometry(1, 1);
  const fogGeometry = new THREE.InstancedBufferGeometry();
  fogGeometry.index = plane.index;
  fogGeometry.setAttribute("position", plane.attributes.position);
  fogGeometry.setAttribute("uv", plane.attributes.uv);
  fogGeometry.setAttribute("aFog", new THREE.InstancedBufferAttribute(unitAttribute(fog), 4));
  fogGeometry.instanceCount = fog;
  const fogUniforms = {
    uMin: { value: new THREE.Vector3(-20, -8, -260) },
    uMax: { value: new THREE.Vector3(20, 6, -70) },
    uTime: dustUniforms.uTime,
    uNoise: { value: noiseTexture() },
    uColor: { value: new THREE.Color() },
    uDensity: { value: 0.5 },
  };
  const fogCards = new THREE.Mesh(
    fogGeometry,
    new THREE.ShaderMaterial({
      vertexShader: fogVertex,
      fragmentShader: fogFragment,
      uniforms: fogUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  fogCards.frustumCulled = false;
  fogCards.renderOrder = 2;

  group.add(sky, dustPoints, fogCards);

  return {
    group,
    sky,
    // Fog fills a box around the hall and the portals; set when the layout changes.
    layout({ fogMin, fogMax }) {
      fogUniforms.uMin.value.copy(fogMin);
      fogUniforms.uMax.value.copy(fogMax);
    },
    update({ time, camera, mood, proj, focus, aperture }) {
      sky.position.copy(camera.position);
      skyUniforms.uTime.value = time;
      skyUniforms.uTop.value.copy(mood.top);
      skyUniforms.uBottom.value.copy(mood.bottom);
      skyUniforms.uGlow.value.copy(mood.glow);
      dustUniforms.uTime.value = time;
      dustUniforms.uCam.value.copy(camera.position);
      dustUniforms.uProj.value = proj;
      dustUniforms.uFocus.value = focus;
      dustUniforms.uAperture.value = aperture;
      dustUniforms.uColor.value.copy(mood.dust);
      fogUniforms.uColor.value.copy(mood.fog);
    },
  };
}
