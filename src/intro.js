// Loading counter shown while the WebGL world loads. The number follows real
// progress; at 100 a single glyph flickers on where the hero name will form.
const GLYPHS = "01{}[]<>/\\|=+*#$%&@;:~^";
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function createIntro() {
  const root = document.getElementById("intro");
  const count = root.querySelector(".intro-count span");
  const glyph = root.querySelector(".intro-glyph");
  let target = 0;
  let shown = 0;
  let skipped = false;
  let raf = 0;
  let last = performance.now();

  const onKey = (event) => {
    if (["Enter", "Escape", " "].includes(event.key)) skip();
  };
  function skip() {
    skipped = true;
  }
  root.querySelector(".intro-skip").addEventListener("click", skip);

  function loop(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    // Never faster than about 1.4 s for the whole count, unless skipped.
    const speed = skipped ? 400 : 75;
    shown = Math.min(target, shown + speed * dt);
    count.textContent = String(Math.floor(shown)).padStart(3, "0");
    raf = requestAnimationFrame(loop);
  }

  return {
    show() {
      root.hidden = false;
      document.documentElement.classList.add("is-intro");
      window.addEventListener("keydown", onKey);
      raf = requestAnimationFrame(loop);
    },
    // Adds weight to the progress once the promise settles.
    async track(promise, weight) {
      try {
        return await promise;
      } finally {
        target = Math.min(100, target + weight);
      }
    },
    // Resolves once the counter reads 100 and the glyph has flickered.
    async done(origin) {
      target = 100;
      while (shown < 100) await wait(30);
      cancelAnimationFrame(raf);
      count.textContent = "100";
      window.removeEventListener("keydown", onKey);
      if (!skipped && origin) {
        glyph.textContent = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
        glyph.style.left = `${origin.x}px`;
        glyph.style.top = `${origin.y}px`;
        root.classList.add("is-glyph");
        await wait(720);
      }
      root.classList.add("is-done");
      document.documentElement.classList.remove("is-intro");
      setTimeout(() => (root.hidden = true), 950);
    },
  };
}
