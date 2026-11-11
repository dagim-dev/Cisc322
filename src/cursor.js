// A dot-and-ring cursor, and a gentle magnetic pull on [data-magnetic] links.
// Only on devices with a fine pointer, and only with motion allowed.
import gsap from "gsap";

export function initCursor({ onHover } = {}) {
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  const root = document.documentElement;
  const cursor = document.querySelector(".cursor");
  const dot = cursor.querySelector(".cursor-dot");
  const ring = cursor.querySelector(".cursor-ring");
  root.classList.add("has-cursor");

  const pos = { x: -100, y: -100 };
  const ringPos = { x: -100, y: -100 };
  let hovering = null;

  window.addEventListener(
    "pointermove",
    (event) => {
      pos.x = event.clientX;
      pos.y = event.clientY;
      cursor.classList.remove("is-hidden");
      const link = event.target.closest?.("a, button");
      if (link !== hovering) {
        hovering = link;
        cursor.classList.toggle("is-link", Boolean(link));
        if (link) onHover?.();
      }
    },
    { passive: true },
  );
  document.addEventListener("pointerleave", () => cursor.classList.add("is-hidden"));

  gsap.ticker.add((time, delta) => {
    const k = 1 - Math.exp(-delta / 1000 * 14);
    ringPos.x += (pos.x - ringPos.x) * k;
    ringPos.y += (pos.y - ringPos.y) * k;
    dot.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
    ring.style.transform = `translate3d(${ringPos.x}px, ${ringPos.y}px, 0)`;
  });

  for (const node of document.querySelectorAll("[data-magnetic]")) {
    const toX = gsap.quickTo(node, "x", { duration: 0.6, ease: "expo.out" });
    const toY = gsap.quickTo(node, "y", { duration: 0.6, ease: "expo.out" });
    node.addEventListener("pointermove", (event) => {
      const box = node.getBoundingClientRect();
      toX((event.clientX - (box.left + box.width / 2)) * 0.28);
      toY((event.clientY - (box.top + box.height / 2)) * 0.4);
    });
    node.addEventListener("pointerleave", () => {
      toX(0);
      toY(0);
    });
  }
}
