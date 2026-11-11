import { renderContent } from "./dom.js";
import { initScroll, playHeroIntro } from "./scroll.js";
import { initTheatre } from "./theatre.js";
import { createBoot } from "./boot.js";

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
      document.fonts.load('700 100px "Fraunces"'),
      document.fonts.load('700 40px "JetBrains Mono"'),
    ]),
    new Promise((resolve) => setTimeout(resolve, 3500)),
  ]);

async function main() {
  renderContent();
  root.classList.toggle("motion", motion);

  const scroll = initScroll({ motion });
  let world = null;
  initTheatre({
    onOpen: () => {
      scroll.stop();
      world?.setPaused(true);
    },
    onClose: () => {
      scroll.start();
      world?.setPaused(false);
    },
  });

  // Reduced motion or no WebGL: the page is complete as it stands.
  if (!motion || !hasWebGL()) {
    root.classList.add("no-gl");
    playHeroIntro();
    return;
  }

  let seen = false;
  try {
    seen = sessionStorage.getItem("booted") === "1";
  } catch {
    /* storage may be blocked; show the boot sequence */
  }
  const boot = seen ? null : createBoot();
  if (boot) {
    scroll.stop();
    window.scrollTo(0, 0);
    boot.show();
  }

  try {
    const fonts = fontsReady();
    const module = import("./gl/world.js");
    await boot?.step("loading typefaces", fonts);
    await boot?.step("compiling shaders", module);
    const { createWorld } = await module;
    await fonts;
    const built = createWorld({
      canvas: document.getElementById("world"),
      labelLayer: document.getElementById("labels"),
    });
    await boot?.step("building glyph atlas", built);
    world = await built;
    await boot?.step("attaching mux · 6 panes", Promise.resolve());
    root.classList.add("gl-on");
  } catch (error) {
    console.error("WebGL scene failed to start; using the static page.", error);
    root.classList.add("no-gl");
  }

  await boot?.done();
  try {
    sessionStorage.setItem("booted", "1");
  } catch {
    /* ignore */
  }
  scroll.start();
  world?.start();
  playHeroIntro();
}

main();
