// The WebGL world behind the page: one fixed canvas whose camera is driven by
// scroll position. Scenes along the path: hero glyph field, pane frames behind
// the team section, and the architecture graph beside the assignments.
import * as THREE from "three";
import {
  EffectComposer,
  RenderPass,
  EffectPass,
  BloomEffect,
  ChromaticAberrationEffect,
  VignetteEffect,
  NoiseEffect,
  BlendFunction,
} from "postprocessing";
import { site } from "../content.js";
import { createGlyphField } from "./glyphs.js";
import { createGraph } from "./graph.js";

const FOV = 50;
const HALF_TAN = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
const HERO_Z = 12;
const GRAPH_Z = -95;
const GRAPH_CAM_Z = -78;
const BACKGROUND = 0x060b16;

const TIERS = {
  high: { dpr: 2, post: true, aberration: true, cellPx: 3.4, dust: 1800 },
  medium: { dpr: 1.5, post: true, aberration: false, cellPx: 4.2, dust: 1100 },
  low: { dpr: 1, post: false, aberration: false, cellPx: 5.2, dust: 600 },
};

function pickTier() {
  // ?tier=high|medium|low forces a quality tier, for testing.
  const forced = new URLSearchParams(window.location.search).get("tier");
  if (TIERS[forced]) return forced;
  const small = Math.min(window.innerWidth, window.innerHeight) < 760;
  const touch = window.matchMedia("(pointer: coarse)").matches;
  const cores = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory || 8;
  if (cores <= 4 || memory <= 4) return touch ? "low" : "medium";
  return touch || small ? "medium" : "high";
}

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function softDot() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 32;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(canvas);
}

function createDust(count) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 70;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 36;
    positions[i * 3 + 2] = 24 - Math.random() * 150;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const points = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      color: 0x9dbcf0,
      map: softDot(),
      size: 0.16,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
    }),
  );
  points.frustumCulled = false;
  return points;
}

function createFloor() {
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: new THREE.Color("#2f6fd0") } },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying vec3 vWorld;
      void main() {
        vec2 coord = vWorld.xz / 2.5;
        vec2 width = fwidth(coord);
        vec2 grid = abs(fract(coord - 0.5) - 0.5) / width;
        float line = 1.0 - min(min(grid.x, grid.y), 1.0);
        // Far away the cells shrink below a pixel; fade out instead of filling in.
        line *= 1.0 - smoothstep(0.25, 0.7, max(width.x, width.y));
        float fade = smoothstep(48.0, 5.0, distance(vWorld, cameraPosition));
        gl_FragColor = vec4(uColor * line * fade, 1.0);
      }
    `,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(160, 260), material);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -7.5, -60);
  return floor;
}

// Empty terminal-pane outlines drifting around the team section.
function createFrames() {
  const positions = [];
  const colors = [];
  const blue = new THREE.Color("#4a8be6");
  const gold = new THREE.Color("#e8c468");
  for (let i = 0; i < 18; i++) {
    const side = i % 2 ? 1 : -1;
    const w = 3 + Math.random() * 4;
    const h = w * 0.62;
    const x = side * (9 + Math.random() * 13);
    const y = (Math.random() - 0.5) * 15;
    const z = -32 - Math.random() * 32;
    const bar = h / 2 - 0.35;
    const lines = [
      [-w / 2, -h / 2, w / 2, -h / 2],
      [w / 2, -h / 2, w / 2, h / 2],
      [w / 2, h / 2, -w / 2, h / 2],
      [-w / 2, h / 2, -w / 2, -h / 2],
      [-w / 2, bar, w / 2, bar],
    ];
    const color = i % 5 === 0 ? gold : blue;
    for (const [x1, y1, x2, y2] of lines) {
      positions.push(x + x1, y + y1, z, x + x2, y + y2, z);
      colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  const frames = new THREE.LineSegments(
    geometry,
    new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.75, depthWrite: false }),
  );
  frames.frustumCulled = false;
  return frames;
}

export async function createWorld({ canvas, labelLayer }) {
  let tierName = pickTier();
  let tier = TIERS[tierName];

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !tier.post,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setClearColor(BACKGROUND, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 220);
  camera.position.set(0, 0, HERO_Z);

  const glyphs = createGlyphField(site.group);
  const graph = createGraph(labelLayer);
  const dust = createDust(tier.dust);
  const frames = createFrames();
  scene.add(createFloor(), dust, frames, glyphs.mesh, graph.group);

  let composer = null;
  let aberration = null;
  function buildComposer() {
    composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType });
    composer.addPass(new RenderPass(scene, camera));
    const effects = [
      new BloomEffect({ intensity: 1.15, luminanceThreshold: 0.3, luminanceSmoothing: 0.3, mipmapBlur: true, radius: 0.7 }),
      new VignetteEffect({ darkness: 0.62, offset: 0.28 }),
      new NoiseEffect({ blendFunction: BlendFunction.OVERLAY, premultiply: false }),
    ];
    effects[2].blendMode.opacity.value = 0.1;
    aberration = new ChromaticAberrationEffect({
      offset: new THREE.Vector2(0.0007, 0.0007),
      radialModulation: true,
      modulationOffset: 0.35,
    });
    const main = new EffectPass(camera, ...effects);
    // Only the last pass may convert to sRGB, or colours get encoded twice.
    main.fullscreenMaterial.encodeOutput = false;
    composer.addPass(main);
    composer.addPass(new EffectPass(camera, aberration));
  }
  if (tier.post) buildComposer();

  // ---- Layout: everything that depends on the page's size ----

  const view = { width: 1, height: 1, wide: true };
  const graphCenter = new THREE.Vector3(0, 0, GRAPH_Z);
  let keys = [];
  let stationY = [0, 1, 2];
  let heroHeight = 1;
  let maxScroll = 1;
  let glyphWidthPx = 0;

  const docTop = (el) => el.getBoundingClientRect().top + window.scrollY;
  const centerScroll = (el) => docTop(el) + el.offsetHeight / 2 - view.height / 2;

  function measure() {
    // A tab opened in the background can report a zero-size viewport.
    if (!window.innerWidth || !window.innerHeight) return false;
    view.width = window.innerWidth;
    view.height = window.innerHeight;
    view.wide = view.width / view.height >= 1 && view.width >= 760;
    camera.aspect = view.width / view.height;
    camera.updateProjectionMatrix();

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, tier.dpr));
    renderer.setSize(view.width, view.height, false);
    composer?.setSize(view.width, view.height);

    // Hero word: placed exactly over the (transparent) h1.
    const title = document.querySelector(".hero-title");
    const rect = title.getBoundingClientRect();
    if (Math.abs(rect.width - glyphWidthPx) > 2) {
      glyphWidthPx = rect.width;
      const unitsPerPx = (2 * HERO_Z * HALF_TAN) / view.height;
      glyphs.layout({
        width: rect.width * unitsPerPx,
        centerX: (rect.left + rect.width / 2 - view.width / 2) * unitsPerPx,
        centerY: -(docTop(title) + rect.height / 2 - view.height / 2) * unitsPerPx,
        columns: Math.max(120, Math.min(320, Math.round(rect.width / tier.cellPx))),
      });
    }

    // Graph: beside the cards on wide screens, above them on narrow ones.
    const distance = GRAPH_CAM_Z - GRAPH_Z;
    const visibleH = 2 * distance * HALF_TAN;
    const visibleW = visibleH * camera.aspect;
    if (view.wide) {
      graphCenter.set(visibleW * 0.2, 0, GRAPH_Z);
      graph.group.scale.setScalar(Math.min(1, (visibleW * 0.5) / 10.5));
    } else {
      // No room beside the cards: the graph sits behind them as a backdrop.
      graphCenter.set(0, visibleH * 0.16, GRAPH_Z);
      graph.group.scale.setScalar(Math.min(0.9, (visibleW * 0.95) / 10.5));
    }
    graph.group.position.copy(graphCenter);

    // Camera keyframes, tied to where sections sit in the page.
    const hero = document.querySelector(".hero");
    const stations = [...document.querySelectorAll(".station")];
    heroHeight = hero.offsetHeight;
    maxScroll = Math.max(1, document.documentElement.scrollHeight - view.height);
    stationY = stations.map(centerScroll);
    const axis = [0, 0, GRAPH_Z];
    keys = [
      { y: 0, pos: [0, 0, HERO_Z], look: [0, 0, 0] },
      { y: heroHeight * 0.72, pos: [0, 0, -10], look: [0, 0, -30] },
      { y: centerScroll(document.getElementById("team")), pos: [0, 0, -30], look: [0, 0, -50] },
      { y: stationY[0], pos: [0, 0, GRAPH_CAM_Z], look: axis },
      { y: stationY[1], pos: [1.3, 0.4, GRAPH_CAM_Z + 1], look: axis },
      { y: stationY[2], pos: [-1.4, 0.2, GRAPH_CAM_Z - 0.5], look: axis },
      { y: maxScroll, pos: [0, 3.5, GRAPH_CAM_Z + 13], look: graphCenter.toArray() },
    ];
    for (let i = 1; i < keys.length; i++) keys[i].y = Math.max(keys[i].y, keys[i - 1].y + 1);
    return true;
  }

  // ---- Per-frame state ----

  const pointer = { x: 0, y: 0, sx: 0, sy: 0, moved: false, active: false };
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (finePointer) {
    window.addEventListener(
      "pointermove",
      (event) => {
        pointer.x = (event.clientX / view.width) * 2 - 1;
        pointer.y = -((event.clientY / view.height) * 2 - 1);
        pointer.moved = true;
        pointer.active = true;
      },
      { passive: true },
    );
  }

  const target = { pos: new THREE.Vector3(0, 0, HERO_Z), look: new THREE.Vector3() };
  const current = { pos: new THREE.Vector3(0, 0, HERO_Z), look: new THREE.Vector3() };
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();

  function cameraAt(scrollY) {
    let i = 0;
    while (i < keys.length - 2 && scrollY > keys[i + 1].y) i++;
    const from = keys[i];
    const to = keys[i + 1];
    const t = smooth(from.y, to.y, scrollY);
    target.pos.lerpVectors(a.fromArray(from.pos), b.fromArray(to.pos), t);
    target.look.lerpVectors(a.fromArray(from.look), b.fromArray(to.look), t);
  }

  let running = false;
  let paused = false;
  let startedAt = null;
  let last = performance.now();
  let time = 0;
  let frame = 0;
  let slow = 0;
  let sampled = 0;

  function setTier(name) {
    tierName = name;
    tier = TIERS[name];
    if (!tier.post) composer = null;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, tier.dpr));
    renderer.setSize(view.width, view.height, false);
    composer?.setSize(view.width, view.height);
  }

  function render(now) {
    if (!running) return;
    requestAnimationFrame(render);
    if (paused || document.hidden || (!keys.length && !measure())) {
      last = now;
      return;
    }
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    time += dt;
    frame++;

    // Step down a quality tier if early frames are slow.
    if (frame > 40 && sampled < 120 && tierName !== "low") {
      sampled++;
      if (dt > 0.03) slow++;
      if (sampled === 120) {
        if (slow > 45) setTier(tierName === "high" ? "medium" : "low");
        if (tierName !== "low") {
          sampled = 0;
          slow = 0;
          frame = -400;
        }
      }
    }

    const scrollY = window.scrollY;
    cameraAt(scrollY);
    const ease = 1 - Math.exp(-dt * 5);
    current.pos.lerp(target.pos, ease);
    current.look.lerp(target.look, ease);
    pointer.sx += (pointer.x - pointer.sx) * (1 - Math.exp(-dt * 4));
    pointer.sy += (pointer.y - pointer.sy) * (1 - Math.exp(-dt * 4));
    camera.position.set(current.pos.x + pointer.sx * 0.5, current.pos.y + pointer.sy * 0.3, current.pos.z);
    camera.lookAt(current.look);

    // Hero glyphs
    const u = glyphs.uniforms;
    u.uTime.value = time;
    u.uAssemble.value = startedAt === null ? 0 : Math.min(1, (now - startedAt) / 2000);
    u.uScatter.value = Math.min(1, scrollY / (heroHeight * 0.62));
    glyphs.mesh.visible = camera.position.z > -26;
    if (pointer.active && camera.position.z > 1) {
      ndc.set(pointer.x, pointer.y);
      raycaster.setFromCamera(ndc, camera);
      const ray = raycaster.ray;
      const t = -ray.origin.z / ray.direction.z;
      u.uMouse.value.set(ray.origin.x + ray.direction.x * t, ray.origin.y + ray.direction.y * t);
    } else {
      u.uMouse.value.set(999, 999);
    }

    // Ambient
    dust.rotation.z = time * 0.006;
    frames.position.y = Math.sin(time * 0.25) * 0.5;
    frames.material.opacity = 0.75 * smooth(-4, -18, camera.position.z) * smooth(-74, -58, camera.position.z);

    // Architecture graph
    const s =
      scrollY <= stationY[1]
        ? smooth(stationY[0], stationY[1], scrollY)
        : 1 + smooth(stationY[1], stationY[2], scrollY);
    const outro = smooth(stationY[2] + (maxScroll - stationY[2]) * 0.25, maxScroll, scrollY);
    const lit = Math.max(1 - smooth(0.3, 0.75, s), outro);
    const ghost = smooth(1.35, 1.85, s) * (1 - outro);
    const vis = smooth(-42, -64, camera.position.z);
    graph.group.rotation.y = Math.sin(time * 0.18) * 0.32 + pointer.sx * 0.25;
    graph.group.rotation.x = -pointer.sy * 0.12;
    if (pointer.moved) {
      pointer.moved = false;
      let hit = null;
      if (vis > 0.7 && lit > 0.6) {
        ndc.set(pointer.x, pointer.y);
        raycaster.setFromCamera(ndc, camera);
        hit = raycaster.intersectObjects(graph.hitTargets, false)[0]?.object.userData.id ?? null;
      }
      graph.setHovered(hit);
    }
    graph.update({
      time,
      lit,
      ghost,
      vis,
      camera,
      width: view.width,
      height: view.height,
      showLabels: view.wide && vis > 0.5 && outro < 0.5,
    });

    if (composer) {
      aberration.blendMode.opacity.value = tier.aberration ? 1 : 0;
      composer.render(dt);
    } else {
      renderer.render(scene, camera);
    }
  }

  let resizeTimer = 0;
  const queueMeasure = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(measure, 150);
  };
  window.addEventListener("resize", queueMeasure);
  // Also catches layout changes that do not resize the window.
  new ResizeObserver(queueMeasure).observe(document.body);
  // Web fonts and late layout can move sections after the first measure.
  document.fonts?.ready.then(() => setTimeout(measure, 50));
  window.addEventListener("load", () => setTimeout(measure, 300));

  measure();
  camera.lookAt(0, 0, 0);
  renderer.compile(scene, camera);

  return {
    start() {
      if (running) return;
      measure();
      running = true;
      startedAt = performance.now();
      last = startedAt;
      time = 0;
      requestAnimationFrame(render);
    },
    setPaused(value) {
      paused = value;
    },
    get tier() {
      return tierName;
    },
  };
}
