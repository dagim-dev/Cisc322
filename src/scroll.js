// Smooth scrolling, text reveals, the chapter index and the pinned team
// gallery. With reduced motion only the chapter index runs.
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import Lenis from "lenis";

gsap.registerPlugin(ScrollTrigger, SplitText);

export const GALLERY_QUERY = "(min-width: 900px) and (min-aspect-ratio: 1/1)";

const docTop = (el) => el.getBoundingClientRect().top + window.scrollY;

export function initScroll({ motion }) {
  let lenis = null;
  let gallery = null;

  if (motion) {
    lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9 });
    lenis.on("scroll", ScrollTrigger.update);
    // Pinning adds spacing to the page; Lenis must re-read the scroll limit.
    ScrollTrigger.addEventListener("refresh", () => lenis.resize());
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
    initReveals();
  }

  initChapters();
  initAnchors(() => lenis);

  // Pinned horizontal gallery for the team (desktop, WebGL on).
  function enableGallery() {
    const mm = gsap.matchMedia();
    mm.add(GALLERY_QUERY, () => {
      const root = document.documentElement;
      const section = document.getElementById("team");
      const track = section.querySelector("[data-team-track]");
      root.classList.add("is-gallery");
      const distance = () => track.scrollWidth - window.innerWidth;
      const tween = gsap.to(track, {
        x: () => -distance(),
        ease: "none",
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: () => `+=${distance()}`,
          pin: true,
          scrub: true,
          invalidateOnRefresh: true,
        },
      });
      gallery = tween.scrollTrigger;
      ScrollTrigger.refresh();
      return () => {
        gallery = null;
        root.classList.remove("is-gallery");
      };
    });
  }

  // Where the team section starts and ends in scroll terms, for the camera.
  function teamRange() {
    if (gallery) return { start: gallery.start, end: gallery.end, pinned: true };
    const team = document.getElementById("team");
    const vh = window.innerHeight;
    const top = docTop(team);
    return { start: top - vh * 0.35, end: top + team.offsetHeight - vh * 0.65, pinned: false };
  }

  return {
    stop: () => lenis?.stop(),
    start: () => lenis?.start(),
    enableGallery,
    teamRange,
    scrollTo: (target, options) => (lenis ? lenis.scrollTo(target, options) : window.scrollTo(0, 0)),
  };
}

function initReveals() {
  for (const node of document.querySelectorAll(".display:not(.hero-title):not(.outro-mark), .statement-line")) {
    SplitText.create(node, {
      type: "lines",
      mask: "lines",
      autoSplit: true,
      onSplit: (self) =>
        gsap.from(self.lines, {
          yPercent: 115,
          duration: 1.1,
          ease: "expo.out",
          stagger: 0.08,
          scrollTrigger: { trigger: node, start: "top 85%" },
        }),
    });
  }

  for (const node of document.querySelectorAll(
    ".eyebrow, .work-lede, .station-meta, .station-summary, .actions, .member-index, .member-role, .team-hint",
  )) {
    gsap.from(node, {
      y: 24,
      autoAlpha: 0,
      duration: 1,
      ease: "expo.out",
      scrollTrigger: { trigger: node, start: "top 90%" },
    });
  }

  gsap.from(".hero-eyebrow, .hero-lead, .hero-hint", {
    autoAlpha: 0,
    y: 18,
    duration: 1.2,
    ease: "expo.out",
    stagger: 0.12,
    delay: 0.9,
    paused: true,
    id: "hero-intro",
  });

  // The hero copy fades as the name pours toward the camera.
  gsap.to(".hero", {
    autoAlpha: 0,
    y: -60,
    ease: "none",
    scrollTrigger: { trigger: ".hero", start: "top top", end: "40% top", scrub: true },
  });
}

export function playHeroIntro() {
  gsap.getById("hero-intro")?.play();
}

function initChapters() {
  const links = new Map(
    [...document.querySelectorAll("[data-chapter]")].map((link) => [link.dataset.chapter, link]),
  );
  const visible = new Set();
  const order = [...links.keys()];
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.add(entry.target.id);
        else visible.delete(entry.target.id);
      }
      const current = order.filter((id) => visible.has(id)).pop();
      if (!current) return;
      for (const [id, link] of links) {
        const active = id === current;
        link.classList.toggle("is-active", active);
        if (active) link.setAttribute("aria-current", "true");
        else link.removeAttribute("aria-current");
      }
    },
    { rootMargin: "-48% 0px -48% 0px" },
  );
  for (const id of order) {
    const target = document.getElementById(id);
    if (target) observer.observe(target);
  }
}

// In-page links glide with Lenis; "back to top" rewinds the whole journey.
function initAnchors(getLenis) {
  document.addEventListener("click", (event) => {
    const link = event.target.closest('a[href^="#"]');
    if (!link || event.defaultPrevented) return;
    const id = link.getAttribute("href").slice(1);
    const target = id ? document.getElementById(id) : null;
    if (!target) return;
    const lenis = getLenis();
    if (!lenis) return;
    event.preventDefault();
    const top = id === "top" || link.hasAttribute("data-top");
    lenis.scrollTo(top ? 0 : target, {
      duration: top ? 2.6 : 1.8,
      easing: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    });
    history.replaceState(null, "", top ? location.pathname : `#${id}`);
  });
}
