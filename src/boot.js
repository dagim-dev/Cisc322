// Terminal boot sequence shown while the WebGL scene loads. Each line is
// printed when the real step it names has finished.
const MIN_GAP = 170;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function createBoot() {
  const root = document.getElementById("boot");
  const log = root.querySelector(".boot-log");
  let skipped = false;
  let last = 0;
  let finish;
  const finished = new Promise((resolve) => (finish = resolve));

  const skip = () => {
    skipped = true;
    finish();
  };
  root.querySelector(".boot-skip").addEventListener("click", skip);
  const onKey = (event) => {
    if (event.key === "Enter" || event.key === "Escape" || event.key === " ") skip();
  };

  async function line(html, cls = "") {
    if (skipped) return;
    const gap = MIN_GAP - (performance.now() - last);
    if (gap > 0) await wait(gap);
    last = performance.now();
    const p = document.createElement("p");
    if (cls) p.className = cls;
    p.innerHTML = html;
    log.append(p);
  }

  return {
    get skipped() {
      return skipped;
    },
    finished,
    show() {
      root.hidden = false;
      document.documentElement.classList.add("is-booting");
      window.addEventListener("keydown", onKey);
      return line("thezucks@queensu:~$ ./thezucks --start", "cmd");
    },
    // Prints "[ ok ] label" once the given promise settles.
    async step(label, promise) {
      try {
        await promise;
        await line(`<span class="ok">[ ok ]</span> ${label}`);
      } catch {
        await line(`[skip] ${label}`);
      }
    },
    async done() {
      await line("ready.", "ready");
      if (!skipped) await wait(380);
      window.removeEventListener("keydown", onKey);
      root.classList.add("is-done");
      document.documentElement.classList.remove("is-booting");
      setTimeout(() => (root.hidden = true), 700);
      finish();
    },
  };
}
