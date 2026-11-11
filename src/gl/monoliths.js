// The team hall: one tall glass slab per member. The slabs refract whatever
// is behind them (a half-resolution render of the scene without the slabs),
// with a little colour dispersion and a bright fresnel rim. A light shaft
// falls on the slab of the member currently in view.
import * as THREE from "three";

const SLAB = { w: 2.5, h: 6.6, d: 0.38 };

const slabVertex = /* glsl */ `
  uniform vec3 uHalf;
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vLocal;

  void main() {
    vLocal = position / uHalf;
    // Bend the front face's normals a little, as if the glass were ground into a lens.
    vec3 n = normal;
    if (normal.z > 0.5) n = normalize(n + vec3(vLocal.x * 0.45, vLocal.y * 0.12, 0.0));
    vNormal = normalize(normalMatrix * n);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vView = -mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;

const slabFragment = /* glsl */ `
  uniform sampler2D tScene;
  uniform vec2 uRes;
  uniform float uHasScene;
  uniform vec3 uTint;
  uniform vec3 uBase;
  uniform float uActive;
  uniform float uTime;
  uniform float uVis;
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vLocal;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  void main() {
    vec3 n = normalize(vNormal);
    vec3 v = normalize(vView);
    float facing = clamp(dot(n, v), 0.0, 1.0);
    float fres = pow(1.0 - facing, 2.6);

    vec2 suv = gl_FragCoord.xy / uRes;
    vec2 off = n.xy * 0.05;
    // Frosting: jitter the lookup a touch.
    vec2 j = (vec2(hash(gl_FragCoord.xy), hash(gl_FragCoord.yx + 7.0)) - 0.5) * 0.004;
    vec3 refr;
    refr.r = texture2D(tScene, suv - off * 0.9 + j).r;
    refr.g = texture2D(tScene, suv - off * 1.05 + j).g;
    refr.b = texture2D(tScene, suv - off * 1.22 + j).b;
    refr = mix(uBase, refr * 1.15, uHasScene);

    // Light from the shaft above pools at the top of the glass.
    float top = smoothstep(-0.4, 1.0, vLocal.y);
    float edgeX = smoothstep(0.9, 1.0, abs(vLocal.x));
    float edgeY = smoothstep(0.96, 1.0, abs(vLocal.y));
    float edge = max(edgeX, edgeY);
    float sweep = smoothstep(0.08, 0.0, abs(vLocal.x * 0.6 + vLocal.y * 0.35 - fract(uTime * 0.07) * 4.0 + 2.0));

    vec3 col = refr * mix(vec3(0.78, 0.8, 0.86), uTint, 0.22);
    col += uTint * (fres * (0.35 + 0.9 * uActive));
    col += uTint * top * 0.14 * uActive;
    col += uTint * edge * (0.12 + 0.9 * uActive);
    col += vec3(1.0, 0.95, 0.9) * sweep * 0.12 * (0.3 + uActive);
    gl_FragColor = vec4(col * uVis, 1.0);
  }
`;

const shaftVertex = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  varying float vY;
  void main() {
    vY = uv.y;
    vNormal = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vView = -mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;

const shaftFragment = /* glsl */ `
  uniform vec3 uTint;
  uniform float uIntensity;
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vView;
  varying float vY;
  void main() {
    float facing = abs(dot(normalize(vNormal), normalize(vView)));
    float soft = pow(facing, 2.5);
    float along = smoothstep(0.0, 0.55, vY) * (1.0 - smoothstep(0.85, 1.0, vY));
    float motes = 0.85 + 0.15 * sin(vY * 40.0 - uTime * 1.5);
    float a = soft * along * motes * uIntensity * 0.32;
    gl_FragColor = vec4(uTint * a, 1.0);
  }
`;

const glowFragment = /* glsl */ `
  uniform vec3 uTint;
  uniform float uIntensity;
  varying vec2 vUv;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float a = pow(max(0.0, 1.0 - d), 2.2) * uIntensity;
    gl_FragColor = vec4(uTint * a, 1.0);
  }
`;

const uvVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const additive = {
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
};

export function createMonoliths({ tints }) {
  const group = new THREE.Group();
  const shared = {
    tScene: { value: null },
    uRes: { value: new THREE.Vector2(1, 1) },
    uHasScene: { value: 0 },
    uTime: { value: 0 },
    uVis: { value: 1 },
    uBase: { value: new THREE.Color("#0a1418") },
  };

  const slabGeometry = new THREE.BoxGeometry(SLAB.w, SLAB.h, SLAB.d);
  const shaftGeometry = new THREE.CylinderGeometry(0.5, 2.3, 13, 40, 1, true);
  shaftGeometry.translate(0, 6.5, 0);
  const plane = new THREE.PlaneGeometry(1, 1);

  const items = tints.map((hex) => {
    const tint = new THREE.Color(hex);
    const slab = new THREE.Mesh(
      slabGeometry,
      new THREE.ShaderMaterial({
        vertexShader: slabVertex,
        fragmentShader: slabFragment,
        uniforms: {
          ...shared,
          uHalf: { value: new THREE.Vector3(SLAB.w / 2, SLAB.h / 2, SLAB.d / 2) },
          uTint: { value: tint.clone().multiplyScalar(1.4) },
          uActive: { value: 0 },
        },
      }),
    );
    slab.renderOrder = 6;

    const shaftUniforms = {
      uTint: { value: tint.clone().lerp(new THREE.Color("#fff3e0"), 0.35) },
      uIntensity: { value: 0 },
      uTime: shared.uTime,
    };
    const shaft = new THREE.Mesh(
      shaftGeometry,
      new THREE.ShaderMaterial({ vertexShader: shaftVertex, fragmentShader: shaftFragment, uniforms: shaftUniforms, side: THREE.DoubleSide, ...additive }),
    );
    shaft.rotation.z = -0.16;

    const glowUniforms = { uTint: { value: tint.clone() }, uIntensity: { value: 0.3 } };
    const glow = new THREE.Mesh(
      plane,
      new THREE.ShaderMaterial({ vertexShader: uvVertex, fragmentShader: glowFragment, uniforms: glowUniforms, ...additive }),
    );
    glow.scale.set(11, 11, 1);

    const poolUniforms = { uTint: { value: tint.clone() }, uIntensity: { value: 0 } };
    const pool = new THREE.Mesh(
      plane,
      new THREE.ShaderMaterial({ vertexShader: uvVertex, fragmentShader: glowFragment, uniforms: poolUniforms, ...additive }),
    );
    pool.rotation.x = -Math.PI / 2;
    pool.scale.set(7, 4, 1);

    group.add(glow, shaft, pool, slab);
    return { slab, shaft, glow, pool, shaftUniforms, glowUniforms, poolUniforms, seed: Math.random() * 10 };
  });

  return {
    group,
    shared,
    slabs: items.map((item) => item.slab),
    // Slab j sits at x = (j + first) * spacing + offsetX.
    layout({ spacing, offsetX, z, first }) {
      items.forEach((item, j) => {
        const x = (j + first) * spacing + offsetX;
        item.slab.position.set(x, 0, z);
        item.shaft.position.set(x + 0.9, SLAB.h / 2 - 0.2, z - 0.4);
        item.glow.position.set(x - 0.6, 0.8, z - 5);
        item.pool.position.set(x, -SLAB.h / 2 - 0.02, z + 0.4);
      });
    },
    setSlabsVisible(value) {
      for (const item of items) item.slab.visible = value;
    },
    update({ time, focus, first, pointer }) {
      shared.uTime.value = time;
      items.forEach((item, j) => {
        const act = 1 - Math.min(1, Math.abs(focus - (j + first)) / 0.9);
        const a = act * act * (3 - 2 * act);
        item.slab.material.uniforms.uActive.value = a;
        item.slab.rotation.y = -0.18 + Math.sin(time * 0.25 + item.seed) * 0.05 + a * pointer.x * 0.35;
        item.slab.rotation.x = a * -pointer.y * 0.08;
        item.slab.position.y = Math.sin(time * 0.4 + item.seed) * 0.08;
        item.shaftUniforms.uIntensity.value = 0.12 + a * 0.88;
        item.glowUniforms.uIntensity.value = 0.12 + a * 0.4;
        item.poolUniforms.uIntensity.value = 0.05 + a * 0.4;
      });
    },
  };
}
