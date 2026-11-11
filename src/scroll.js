// Smooth scrolling, scroll-triggered text reveals, the active tab and the
// progress rail. With reduced motion only the tab and rail logic runs.
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import Lenis from "lenis";

gsap.registerPlugin(ScrollTrigger, SplitText);

export function initScroll({ motion }) {
  let lenis = null;

  if (motion) {
    lenis = new Lenis({ anchors: true, lerp: 0.11 });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
    initReveals();
    initTilt();
  }

  initTabs();
  initRail();

  const footer = document.querySelector(".footer");
  new IntersectionObserver(
    ([entry]) => entry.isIntersecting && footer.classList.add("is-in"),
    { threshold: 0.5 },
  ).observe(footer);

  return {
    stop: () => lenis?.stop(),
    start: () => lenis?.start(),
  };
}

function initReveals() {
  for (const node of document.querySelectorAll("[data-reveal], .card")) {
    gsap.from(node, {
      y: 28,
      autoAlpha: 0,
      duration: 0.8,
      ease: "power3.out",
      scrollTrigger: { trigger: node, start: "top 86%" },
    });
  }

  for (const node of document.querySelectorAll("[data-split]")) {
    SplitText.create(node, {
      type: "lines",
      mask: "lines",
      autoSplit: true,
      onSplit: (self) =>
        gsap.from(self.lines, {
          yPercent: 110,
          duration: 0.8,
          ease: "power3.out",
          stagger: 0.06,
          scrollTrigger: { trigger: node, start: "top 88%" },
        }),
    });
  }

  // One window splitting into panes, the way a multiplexer does.
  const mux = document.querySelector("[data-mux]");
  if (mux) {
    const timeline = gsap.timeline({
      defaults: { ease: "power3.out" },
      scrollTrigger: { trigger: mux, start: "top 78%" },
    });
    timeline
      .from(mux, { autoAlpha: 0, y: 36, scale: 0.97, duration: 0.7 })
      .from(
        mux.querySelectorAll(".pane"),
        { clipPath: "inset(0 100% 0 0)", duration: 0.65, stagger: 0.07 },
        "-=0.3",
      )
      .from(mux.querySelector(".mux-status"), { autoAlpha: 0, duration: 0.4 }, "-=0.2");
  }

  gsap.from(".hero-eyebrow, .hero-lead, .hero-hint", {
    autoAlpha: 0,
    y: 16,
    duration: 0.9,
    ease: "power3.out",
    stagger: 0.12,
    delay: 0.2,
    paused: true,
    id: "hero-intro",
  });
}

export function playHeroIntro() {
  gsap.getById("hero-intro")?.play();
}

// Panes lean toward the pointer on devices that have one.
function initTilt() {
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  for (const pane of document.querySelectorAll(".pane")) {
    pane.addEventListener("pointermove", (event) => {
      const box = pane.getBoundingClientRect();
      const x = (event.clientX - box.left) / box.width - 0.5;
      const y = (event.clientY - box.top) / box.height - 0.5;
      pane.style.setProperty("--ry", `${(x * 9).toFixed(2)}deg`);
      pane.style.setProperty("--rx", `${(-y * 9).toFixed(2)}deg`);
    });
    pane.addEventListener("pointerleave", () => {
      pane.style.setProperty("--ry", "0deg");
      pane.style.setProperty("--rx", "0deg");
    });
  }
}

function initTabs() {
  const tabs = new Map(
    [...document.querySelectorAll(".tabs a")].map((link) => [link.dataset.tab, link]),
  );
  const visible = new Set();
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.add(entry.target.id);
        else visible.delete(entry.target.id);
      }
      for (const [id, link] of tabs) {
        const active = visible.has(id);
        link.classList.toggle("is-active", active);
        if (active) link.setAttribute("aria-current", "true");
        else link.removeAttribute("aria-current");
      }
    },
    { rootMargin: "-45% 0px -45% 0px" },
  );
  for (const id of tabs.keys()) {
    const target = document.getElementById(id);
    if (target) observer.observe(target);
  }
}

function initRail() {
  const fill = document.querySelector(".rail-fill");
  if (!fill) return;
  const update = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    fill.style.transform = `scaleY(${max > 0 ? Math.min(1, window.scrollY / max) : 0})`;
  };
  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
  update();
}
