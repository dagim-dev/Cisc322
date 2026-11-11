import gsap from "gsap";
import { renderContent } from "./dom.js";
import { initScroll, playHeroIntro } from "./scroll.js";
import { initTheatre } from "./theatre.js";
import { createIntro } from "./intro.js";
import { initCursor } from "./cursor.js";
import { initSound } from "./sound.js";

const root = document.documentElement;
const motion = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function hasWebGL() {
  try {
    return Boolean(document.createElement("canvas").getContext("webgl2"));
  } catch {
    return false;
  }
}

const fontsReady = () =>
  Promise.race([
    Promise.all([
      document.fonts.load('400 100px "Instrument Serif"'),
      document.fonts.load('italic 400 100px "Instrument Serif"'),
      document.fonts.load('700 40px "JetBrains Mono"'),
    ]),
    new Promise((resolve) => setTimeout(resolve, 3500)),
  ]);

function heroCenter() {
  const box = document.querySelector(".hero-title").getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
}

async function main() {
  renderContent();
  root.classList.toggle("motion", motion);
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";

  const scroll = initScroll({ motion });
  const sound = initSound();
  if (motion) initCursor({ onHover: () => sound.tick() });

  let world = null;
  initTheatre({
    beforeOpen: (link) => world?.focusPortal(Number(link.dataset.portal)),
    onOpen: () => {
      scroll.stop();
      world?.setPaused(true);
    },
    onClose: () => {
      scroll.start();
      world?.setPaused(false);
      world?.releasePortal();
    },
  });

  // Reduced motion or no WebGL: the static page is complete as it stands.
  // ?static forces this version, for testing.
  const forceStatic = new URLSearchParams(window.location.search).has("static");
  if (!motion || forceStatic || !hasWebGL()) {
    root.classList.add("no-gl");
    playHeroIntro();
    return;
  }

  let seen = false;
  try {
    seen = sessionStorage.getItem("intro") === "1";
  } catch {
    /* storage may be blocked; show the intro */
  }
  window.scrollTo(0, 0);
  const intro = seen ? null : createIntro();
  scroll.stop();
  intro?.show();
  const track = (promise, weight) => (intro ? intro.track(promise, weight) : promise);

  try {
    const module = track(import("./gl/world.js"), 35);
    await track(fontsReady(), 25);
    const { createWorld } = await module;
    // The canvas must be visible before the world measures the page.
    root.classList.add("gl-on");
    world = await track(
      createWorld({
        canvas: document.getElementById("world"),
        teamRange: () => scroll.teamRange(),
      }),
      30,
    );
    scroll.enableGallery();
    world.measure();
    if (import.meta.env.DEV) Object.assign(window, { __world: world, __scroll: scroll });
    gsap.ticker.add(() => world.tick());
  } catch (error) {
    console.error("WebGL scene failed to start; using the static page.", error);
    root.classList.remove("gl-on");
    root.classList.add("no-gl");
    world = null;
  }

  await intro?.done(heroCenter());
  try {
    sessionStorage.setItem("intro", "1");
  } catch {
    /* ignore */
  }
  scroll.start();
  world?.start();
  playHeroIntro();
}

main();
