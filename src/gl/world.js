// The WebGL world behind the page: one fixed canvas, one continuous camera
// journey driven by scroll. Chapters along the path (all on the -z axis):
//   hero     z ≈ 0      the name as glyph particles
//   tunnel   z -6..-86  a warp of glyphs
//   hall     z = -100   six glass slabs, camera slides sideways (pinned)
//   portals  z ≤ -140   one floating screen per assignment
//   outro               camera pulls back; the particles regather
// Everything is placed from DOM measurements, so the page stays the source
// of truth for layout.
import * as THREE from "three";
import { site, team, assignments } from "../content.js";
import { createParticles } from "./particles.js";
import { createTunnel } from "./tunnel.js";
import { createMonoliths } from "./monoliths.js";
import { createPortals, SCREEN } from "./portal.js";
import { createAtmosphere } from "./atmosphere.js";
import { createPost } from "./post.js";

const FOV = 45;
const HALF_TAN = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
const HERO_CAM = 12;
const HALL_Z = -100;
const HALL_D = 11;
const PORTAL_Z0 = -142;
const PORTAL_GAP = 34;
const PORTAL_D = 9.5;
const OUTRO_D = 10;

const TIERS = {
  high: { dpr: 1.75, post: true, aberration: true, refract: true, particles: 384, dust: 1800, fog: 26, tunnel: [96, 40], rain: 320 },
  medium: { dpr: 1.5, post: true, aberration: false, refract: true, particles: 256, dust: 1100, fog: 16, tunnel: [70, 30], rain: 220 },
  low: { dpr: 1, post: false, aberration: false, refract: false, particles: 160, dust: 500, fog: 8, tunnel: [44, 22], rain: 120 },
};

const ROLE_TINT = { leader: "#7fe3ff", presenter: "#e8c468" };
const MEMBER_TINT = "#c9b8ff";

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

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const bump = (center, width, x) => {
  const d = Math.abs(x - center) / width;
  return d >= 1 ? 0 : (1 - d) * (1 - d);
};

// Chapter moods. Colours are converted to linear space by THREE.Color.
function mood(top, bottom, glow, fog, dust, accent) {
  return {
    top: new THREE.Color(top),
    bottom: new THREE.Color(bottom),
    glow: new THREE.Color(glow),
    fog: new THREE.Color(fog),
    dust: new THREE.Color(dust),
    accent: new THREE.Color(accent),
  };
}

function tintMood(hex) {
  const tint = new THREE.Color(hex);
  const m = mood("#0b0a10", "#020203", "#000000", "#000000", "#000000", hex);
  m.top.lerp(tint, 0.06);
  m.glow.copy(tint).multiplyScalar(0.07);
  m.fog.copy(tint).multiplyScalar(0.05);
  m.dust.copy(tint).lerp(new THREE.Color("#ffffff"), 0.4).multiplyScalar(0.9);
  return m;
}

const MOODS = {
  hero: mood("#120a1a", "#030205", "#1c0b22", "#120818", "#ffd6a0", "#ffb35c"),
  warp: mood("#0d0920", "#020208", "#1b1050", "#0f0a26", "#c9b8ff", "#a98bff"),
  team: mood("#06141b", "#010406", "#06303a", "#062028", "#bff3ff", "#7fe3ff"),
  outro: mood("#140a18", "#030204", "#2a0f22", "#140812", "#ffd6a0", "#ffb35c"),
};

function mixMood(out, a, b, t) {
  for (const key of Object.keys(out)) out[key].copy(a[key]).lerp(b[key], t);
  return out;
}

const docTop = (el) => el.getBoundingClientRect().top + window.scrollY;

// Page y of an element's first text baseline.
function baselineOf(el) {
  const probe = document.createElement("span");
  probe.style.cssText = "display:inline-block;width:0;height:0;vertical-align:baseline";
  el.prepend(probe);
  const y = probe.getBoundingClientRect().top + window.scrollY;
  probe.remove();
  return y;
}

export async function createWorld({ canvas, teamRange }) {
  let tierName = pickTier();
  let tier = TIERS[tierName];

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !tier.post,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setClearColor(0x040406, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 700);
  camera.position.set(0, 0, HERO_CAM);

  const title = document.querySelector(".hero-title");
  const style = getComputedStyle(title);
  const particles = createParticles(renderer, {
    size: tier.particles,
    text: site.group,
    font: { family: style.fontFamily, weight: style.fontWeight, style: style.fontStyle },
    letterSpacing: parseFloat(style.letterSpacing) / parseFloat(style.fontSize) || 0,
  });
  const tunnel = createTunnel({ rings: tier.tunnel[0], perRing: tier.tunnel[1] });
  const monoliths = createMonoliths({ tints: team.map((m) => ROLE_TINT[m.role] || MEMBER_TINT) });
  const portals = createPortals(assignments, { rain: tier.rain });
  const atmos = createAtmosphere({ dust: tier.dust, fog: tier.fog });
  scene.add(atmos.group, tunnel.mesh, monoliths.group, portals.group, particles.points);

  let post = createPost(renderer, scene, camera, tier);
  const refraction = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
  const stationMoods = assignments.map((a) => tintMood(a.tint));
  const current = mixMood(mood("#000", "#000", "#000", "#000", "#000", "#000"), MOODS.hero, MOODS.hero, 0);

  // ---- Layout ----

  const view = { width: 1, height: 1, wide: true, dpr: 1, proj: 800 };
  const buffer = new THREE.Vector2();
  let keys = [];
  let posCurve = null;
  let lookCurve = null;
  let range = { start: 0, end: 1, pinned: false };
  let panels = team.length + 1;
  let xEnd = 0;
  let heroH = 1;
  let stationY = [0, 1, 2];
  let maxScroll = 1;
  let moodKeys = [];
  let cuts = [];
  const heroWord = { left: 0, baseline: 0, width: 1, z: 0 };
  const outroWord = { left: 0, baseline: 0, width: 1, z: 0 };

  // Places a word in the world exactly over a heading, as seen from a camera
  // looking straight down -z from `cam`, `dist` units away, at scroll `at`.
  function placeWord(el, out, cam, dist, at) {
    const rect = el.getBoundingClientRect();
    const upp = (2 * dist * HALF_TAN) / view.height;
    const left = rect.left - view.width / 2;
    const base = baselineOf(el) - at - view.height / 2;
    out.left = cam.x + left * upp;
    out.baseline = cam.y - base * upp;
    out.width = rect.width * upp;
    out.z = cam.z - dist;
  }

  function measure() {
    // A tab opened in the background can report a zero-size viewport.
    if (!window.innerWidth || !window.innerHeight) return false;
    view.width = window.innerWidth;
    view.height = window.innerHeight;
    view.wide = view.width >= 900 && view.width / view.height >= 1;
    camera.aspect = view.width / view.height;
    camera.updateProjectionMatrix();

    view.dpr = Math.min(window.devicePixelRatio || 1, tier.dpr);
    renderer.setPixelRatio(view.dpr);
    renderer.setSize(view.width, view.height, false);
    renderer.getDrawingBufferSize(buffer);
    post?.setSize(view.width, view.height, view.dpr);
    refraction.setSize(Math.ceil(buffer.x / 2), Math.ceil(buffer.y / 2));
    monoliths.shared.uRes.value.copy(buffer);
    view.proj = buffer.y / (2 * HALF_TAN);

    const vh = view.height;
    range = teamRange();
    heroH = document.querySelector(".hero").offsetHeight;
    maxScroll = Math.max(1, document.documentElement.scrollHeight - vh);
    stationY = [...document.querySelectorAll(".station")].map(
      (el) => docTop(el) + el.offsetHeight / 2 - vh / 2,
    );

    // Hero word, over the transparent heading.
    placeWord(title, heroWord, new THREE.Vector3(0, 0, HERO_CAM), HERO_CAM, 0);

    // Hall: when pinned, slabs are spaced exactly one screen apart at their
    // depth, so each stays locked beside its name as the gallery slides.
    const hallH = 2 * HALL_D * HALF_TAN;
    const hallW = hallH * camera.aspect;
    const spacing = range.pinned ? hallW : Math.max(6, hallW * 0.95);
    panels = team.length + 1;
    xEnd = (panels - 1) * spacing;
    monoliths.layout({ spacing, offsetX: range.pinned ? hallW * 0.2 : 0, z: HALL_Z, first: 1 });

    // Portals: beside the text on wide screens, above it on narrow ones.
    const pH = 2 * PORTAL_D * HALF_TAN;
    const pW = pH * camera.aspect;
    const portalZ = assignments.map((_, i) => PORTAL_Z0 - i * PORTAL_GAP);
    portals.layout(
      portalZ.map((z) => {
        const scale = view.wide ? Math.min(1, (pW * 0.5) / SCREEN.w) : Math.min(1, (pW * 0.9) / SCREEN.w);
        const x = view.wide ? xEnd + pW * 0.22 : xEnd;
        const y = view.wide ? 0 : pH / 2 - (SCREEN.h * scale) / 2 - pH * 0.12;
        return { position: new THREE.Vector3(x, y, z), scale };
      }),
    );

    // Outro: the camera pulls back from the last portal; the name regathers
    // over the outro's (transparent) heading.
    const lastZ = portalZ[portalZ.length - 1];
    const outroCam = new THREE.Vector3(xEnd, 0.8, lastZ + 6 + OUTRO_D);
    placeWord(document.querySelector(".outro-mark"), outroWord, outroCam, OUTRO_D, maxScroll);

    // Camera path keyframes, tied to where sections sit in the page.
    const station = (i, dx, dy) => ({
      y: stationY[i],
      pos: [xEnd + dx, dy, portalZ[i] + PORTAL_D],
      look: [xEnd, 0, portalZ[i]],
    });
    keys = [
      { y: 0, pos: [0, 0, HERO_CAM], look: [0, 0, 0] },
      { y: heroH * 0.8, pos: [0, 0, 1.5], look: [0, 0, -30] },
      { y: range.start, pos: [0, 0, HALL_Z + HALL_D], look: [0, 0, HALL_Z] },
      { y: range.end, pos: [xEnd, 0, HALL_Z + HALL_D], look: [xEnd, 0, HALL_Z] },
      station(0, 0, 0),
      station(1, 0.5, 0.25),
      station(2, -0.4, 0.1),
      { y: maxScroll, pos: outroCam.toArray(), look: [xEnd, 0.8, lastZ + 6] },
    ];
    for (let i = 1; i < keys.length; i++) keys[i].y = Math.max(keys[i].y, keys[i - 1].y + 1);
    posCurve = new THREE.CatmullRomCurve3(keys.map((k) => new THREE.Vector3(...k.pos)), false, "centripetal");
    lookCurve = new THREE.CatmullRomCurve3(keys.map((k) => new THREE.Vector3(...k.look)), false, "centripetal");

    moodKeys = [
      { y: 0, mood: MOODS.hero },
      { y: heroH * 0.9, mood: MOODS.warp },
      { y: range.start, mood: MOODS.team },
      { y: range.end, mood: MOODS.team },
      ...stationY.map((y, i) => ({ y, mood: stationMoods[i] })),
      { y: maxScroll, mood: MOODS.outro },
    ];
    for (let i = 1; i < moodKeys.length; i++) moodKeys[i].y = Math.max(moodKeys[i].y, moodKeys[i - 1].y + 1);

    // Scroll positions where one chapter dissolves into the next.
    cuts = [range.start - vh * 0.55, ...stationY.slice(1).map((y, i) => (y + stationY[i]) / 2)];

    atmos.layout({
      fogMin: new THREE.Vector3(-14, -7, lastZ - 30),
      fogMax: new THREE.Vector3(xEnd + 14, 5, HALL_Z + 6),
    });
    return true;
  }

  // ---- Camera path ----

  const target = { pos: new THREE.Vector3(0, 0, HERO_CAM), look: new THREE.Vector3() };
  function pathAt(y) {
    // Inside the team gallery the camera slides in lockstep with the panels.
    if (y >= range.start && y <= range.end) {
      const p = (y - range.start) / Math.max(1, range.end - range.start);
      target.pos.set(p * xEnd, 0, HALL_Z + HALL_D);
      target.look.set(p * xEnd, 0, HALL_Z);
      return;
    }
    let i = 0;
    while (i < keys.length - 2 && y > keys[i + 1].y) i++;
    const local = clamp01((y - keys[i].y) / (keys[i + 1].y - keys[i].y));
    // Ease within each segment, so the camera settles on each subject.
    const eased = local * local * (3 - 2 * local);
    const t = (i + (local * 0.35 + eased * 0.65)) / (keys.length - 1);
    posCurve.getPoint(t, target.pos);
    lookCurve.getPoint(t, target.look);
  }

  function moodAt(y) {
    let i = 0;
    while (i < moodKeys.length - 2 && y > moodKeys[i + 1].y) i++;
    const t = smooth(moodKeys[i].y, moodKeys[i + 1].y, y);
    return mixMood(current, moodKeys[i].mood, moodKeys[i + 1].mood, t);
  }

  // ---- Pointer ----

  const pointer = { x: 0, y: 0, sx: 0, sy: 0, active: false };
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (finePointer) {
    window.addEventListener(
      "pointermove",
      (event) => {
        pointer.x = (event.clientX / view.width) * 2 - 1;
        pointer.y = -((event.clientY / view.height) * 2 - 1);
        pointer.active = true;
      },
      { passive: true },
    );
    document.addEventListener("pointerleave", () => (pointer.active = false));
  }
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const mouseWorld = new THREE.Vector3(999, 999, 0);
  const mousePrev = new THREE.Vector3(999, 999, 0);
  const mouseVel = new THREE.Vector3();

  // ---- Fly-in toward a portal (before the theatre opens) ----

  const fly = { index: -1, goal: 0, w: 0, pos: new THREE.Vector3(), look: new THREE.Vector3() };

  // ---- Frame loop ----

  let running = false;
  let paused = false;
  let started = 0;
  let last = performance.now();
  let time = 0;
  let frame = 0;
  let slow = 0;
  let sampled = 0;
  let speed = 0;
  const prevPos = new THREE.Vector3(0, 0, HERO_CAM);
  const near = assignments.map(() => 0);

  function setTier(name) {
    tierName = name;
    tier = TIERS[name];
    if (!tier.post) post = null;
    measure();
  }

  function tick() {
    if (!running) return;
    const now = performance.now();
    if (paused || document.hidden || (!keys.length && !measure())) {
      last = now;
      return;
    }
    const dt = Math.min(0.05, (now - last) / 1000);
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

    const y = window.scrollY;
    const vh = view.height;
    pathAt(y);

    // Fly toward a portal's screen when the theatre is about to open.
    fly.w += (fly.goal - fly.w) * (1 - Math.exp(-dt * 5));
    if (fly.w > 0.001 && fly.index >= 0) {
      const node = portals.portals[fly.index].node;
      node.localToWorld(fly.pos.set(0, 0, 3.4));
      node.getWorldPosition(fly.look);
      const e = fly.w * fly.w * (3 - 2 * fly.w);
      target.pos.lerp(fly.pos, e);
      target.look.lerp(fly.look, e);
    }

    pointer.sx += ((pointer.active ? pointer.x : 0) - pointer.sx) * (1 - Math.exp(-dt * 3));
    pointer.sy += ((pointer.active ? pointer.y : 0) - pointer.sy) * (1 - Math.exp(-dt * 3));
    camera.position.set(target.pos.x + pointer.sx * 0.35, target.pos.y + pointer.sy * 0.2, target.pos.z);
    camera.lookAt(target.look);

    const moved = camera.position.distanceTo(prevPos) / Math.max(dt, 1e-3);
    prevPos.copy(camera.position);
    speed += (moved - speed) * (1 - Math.exp(-dt * 6));
    const focus = camera.position.distanceTo(target.look);
    const m = moodAt(y);

    // ---- Hero particles ----
    const outro = smooth(stationY[2], maxScroll - vh * 0.15, y);
    const inOutro = outro > 0.02;
    const word = inOutro ? outroWord : heroWord;
    particles.layout(word);
    const sim = particles.sim;
    const age = (now - started) / 1000;
    sim.uForm.value = smooth(0.2, 1.8, age);
    sim.uPour.value = inOutro ? 0 : smooth(heroH * 0.04, heroH * 1.05, y);
    sim.uTravel.value = outro;
    const particlesLive = camera.position.z > -40 || inOutro;
    particles.points.visible = particlesLive;
    if (particlesLive) {
      if (pointer.active) {
        ndc.set(pointer.x, pointer.y);
        raycaster.setFromCamera(ndc, camera);
        const ray = raycaster.ray;
        const t = (word.z - ray.origin.z) / ray.direction.z;
        if (t > 0) mouseWorld.copy(ray.origin).addScaledVector(ray.direction, t);
        if (mousePrev.x !== 999) {
          const v = mouseWorld.clone().sub(mousePrev).divideScalar(Math.max(dt, 1e-3));
          mouseVel.lerp(v, 0.5);
        }
        mousePrev.copy(mouseWorld);
      } else {
        mouseVel.multiplyScalar(0.9);
      }
      sim.uMouse.value.copy(mouseWorld);
      sim.uMouseVel.value.copy(mouseVel).clampLength(0, 30);
      sim.uMouseOn.value = pointer.active ? 1 : 0;
      particles.uniforms.uProj.value = view.proj;
      particles.uniforms.uFocus.value = focus;
      particles.uniforms.uAperture.value = 0.9 * view.dpr;
      particles.step(dt, time);
    }

    // ---- Tunnel ----
    const tunnelOn = smooth(heroH * 0.25, heroH * 0.95, y) * (1 - smooth(range.start - vh * 0.3, range.start + vh * 0.2, y));
    tunnel.mesh.visible = tunnelOn > 0.002;
    tunnel.uniforms.uOpacity.value = tunnelOn;
    tunnel.uniforms.uSpeed.value = speed;
    tunnel.uniforms.uTime.value = time;

    // ---- Hall ----
    // The slabs are only worth drawing while they are in front of the camera.
    const hallOn = camera.position.z < -55 && camera.position.z > HALL_Z + 1;
    monoliths.group.visible = hallOn;
    if (hallOn) {
      const p = clamp01((y - range.start) / Math.max(1, range.end - range.start));
      monoliths.update({ time, focus: p * (panels - 1), first: 1, pointer: { x: pointer.sx, y: pointer.sy } });
    }

    // ---- Portals ----
    portals.group.visible = camera.position.z < -95;
    stationY.forEach((sy, i) => (near[i] = 1 - smooth(vh * 0.2, vh * 1.1, Math.abs(y - sy))));
    if (fly.index >= 0) near[fly.index] = Math.max(near[fly.index], fly.w);
    portals.update({ time, near, proj: view.proj, fade: 1 - outro });

    // ---- Air, light and the chapter dissolve ----
    atmos.update({ time, camera, mood: m, proj: view.proj, focus, aperture: 0.7 * view.dpr });
    if (post) {
      let cut = 0;
      for (const c of cuts) cut = Math.max(cut, bump(c, vh * 0.4, y));
      post.transition.amount = cut * 0.42;
      post.transition.color.copy(m.accent).multiplyScalar(1.6);
    }

    // Refraction source for the glass: the scene without the slabs.
    const refract = hallOn && tier.refract;
    monoliths.shared.uHasScene.value = refract ? 1 : 0;
    monoliths.shared.uBase.value.copy(m.fog).multiplyScalar(2.5).add(m.bottom);
    if (refract) {
      monoliths.setSlabsVisible(false);
      const showParticles = particles.points.visible;
      particles.points.visible = false;
      renderer.setRenderTarget(refraction);
      // The composer turns autoClear off, so clear by hand.
      renderer.clear();
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      particles.points.visible = showParticles;
      monoliths.setSlabsVisible(true);
      monoliths.shared.tScene.value = refraction.texture;
    }

    if (post) post.render(dt);
    else renderer.render(scene, camera);
  }

  let resizeTimer = 0;
  const queueMeasure = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(measure, 150);
  };
  window.addEventListener("resize", queueMeasure);
  // Also catches layout changes that do not resize the window.
  new ResizeObserver(queueMeasure).observe(document.body);
  document.fonts?.ready.then(() => setTimeout(measure, 50));
  window.addEventListener("load", () => setTimeout(measure, 300));

  measure();
  particles.layout(heroWord);
  renderer.compile(scene, camera);

  return {
    measure,
    tick,
    start() {
      if (running) return;
      measure();
      particles.layout(heroWord);
      particles.prime();
      running = true;
      started = performance.now();
      last = started;
      time = 0;
    },
    setPaused(value) {
      paused = value;
      if (value) portals.pauseAll();
    },
    focusPortal(index) {
      if (!(index >= 0) || !portals.portals[index] || paused) return Promise.resolve();
      fly.index = index;
      fly.goal = 1;
      return new Promise((resolve) => setTimeout(resolve, 650));
    },
    releasePortal() {
      fly.goal = 0;
    },
    get tier() {
      return tierName;
    },
    // For debugging in development.
    get debug() {
      return { range, xEnd, keys, stationY, maxScroll, camera: camera.position.toArray(), view, renderer, refraction, monoliths, portals, scene };
    },
  };
}
