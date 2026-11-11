// All site content lives here. To publish a new assignment, drop its files in
// public/assets/ and fill in the matching entry below. Leave a field as null
// while the file does not exist yet and the page shows it as pending.

export const site = {
  group: "TheZucks",
  course: "CISC 322",
  eyebrow: "CISC 322 · Software Architecture · Fall 2026",
  lead: "Course deliverables for our software architecture group project: reports, slides, and presentation recordings in one place.",
  footer: "Queen's University · CISC 322 · 2026",
};

// role: "leader", "presenter" or null
export const team = [
  { name: "Dagim", role: "presenter" },
  { name: "Armaan", role: "leader" },
  { name: "Arnav", role: null },
  { name: "Avaneesh", role: null },
  { name: "Ibraheem", role: null },
  { name: "Rahul", role: "presenter" },
];

// tint colours the assignment's chapter of the 3D world.
// teaser: a short silent loop shown on the floating screen (optional).
// poster: a still used when there is no teaser and on the static page (optional).
export const assignments = [
  {
    id: "assignment-1",
    badge: "A1",
    title: "Conceptual Architecture",
    summary:
      "The conceptual architecture of WezTerm, the GPU-accelerated terminal emulator written in Rust: its major subsystems, how they work together, and the architectural styles behind them.",
    tint: "#ffb35c",
    report: "assets/a1-report.pdf",
    slides: { href: "assets/a1-slides.pptx", label: "Slides" },
    video: "assets/a1-video.mp4",
    teaser: "assets/a1-teaser.mp4",
    poster: "assets/a1-poster.jpg",
  },
  {
    id: "assignment-2",
    badge: "A2",
    title: "Concrete Architecture",
    summary: "The architecture recovered from WezTerm's source code. Files go live here once the deliverable is submitted.",
    tint: "#5fe0d0",
    report: null,
    slides: null,
    video: null,
    teaser: null,
    poster: null,
  },
  {
    id: "assignment-3",
    badge: "A3",
    title: "Architectural Enhancement",
    summary: "A proposed enhancement to WezTerm and its effect on the architecture. Files go live here once the deliverable is submitted.",
    tint: "#a98bff",
    report: null,
    slides: null,
    video: null,
    teaser: null,
    poster: null,
  },
];

export const isLive = (item) => Boolean(item.report || item.slides || item.video);
