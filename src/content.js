// All site content lives here. To publish a new assignment, drop its files in
// public/assets/ and fill in the matching entry below. Leave a field as null
// while the file does not exist yet and the page shows it as pending.

export const site = {
  group: "TheZucks",
  course: "CISC 322",
  eyebrow: "Software Architecture · Fall 2026",
  lead: "Course deliverables for our software architecture group project: reports, slides, and presentation recordings in one place.",
  footer: "CISC 322 · Software Architecture · 2026",
  school: "Queen's University",
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

export const assignments = [
  {
    id: "assignment-1",
    badge: "A1",
    title: "Conceptual Architecture",
    summary:
      "Conceptual architecture of WezTerm, a GPU-accelerated terminal emulator and multiplexer written in Rust: eight subsystems centred on the Multiplexer, using client–server and implicit-invocation styles.",
    report: "assets/a1-report.pdf",
    slides: { href: "assets/a1-slides.pptx", label: "Slides (PPTX)" },
    video: "assets/a1-video.mp4",
  },
  {
    id: "assignment-2",
    badge: "A2",
    title: "Concrete Architecture",
    summary: "The architecture recovered from WezTerm's source code. Files go live here once the deliverable is submitted.",
    report: null,
    slides: null,
    video: null,
  },
  {
    id: "assignment-3",
    badge: "A3",
    title: "Architectural Enhancement",
    summary: "A proposed enhancement to WezTerm and its effect on the architecture. Files go live here once the deliverable is submitted.",
    report: null,
    slides: null,
    video: null,
  },
];

// The A1 conceptual architecture, transcribed from section 3 of the report.
// pos is the node's place in the 3D graph (x right, y up, z toward the viewer).
export const architecture = {
  nodes: [
    { id: "entry", label: "Entry / CLI / Bootstrap", hint: "wezterm", pos: [-3.4, 2.6, 0.4] },
    { id: "gui", label: "GUI & GPU Rendering", hint: "window · wezterm-gui", pos: [0, 3.3, -0.6] },
    { id: "font", label: "Font & Text Shaping", hint: "wezterm-font", pos: [3.4, 2.6, 0.4] },
    { id: "config", label: "Configuration & Lua", hint: "config", pos: [-4.2, -0.2, -0.8] },
    { id: "mux", label: "Multiplexer (Mux)", hint: "mux", pos: [0, 0, 0], core: true },
    { id: "term", label: "Terminal Emulation Core", hint: "term", pos: [3.7, -0.3, 0.8] },
    { id: "pty", label: "PTY & Process", hint: "pty", pos: [2.2, -3.0, -0.4] },
    { id: "cs", label: "Client–Server Layer", hint: "codec · wezterm-client", pos: [-2.2, -3.0, 0.6] },
  ],
  // kind: "call" (procedural call), "config" (read-only configuration
  // injection) or "pubsub" (publish–subscribe notification)
  edges: [
    { from: "entry", to: "config", kind: "call" },
    { from: "entry", to: "gui", kind: "call" },
    { from: "entry", to: "mux", kind: "call" },
    { from: "entry", to: "cs", kind: "call" },
    { from: "gui", to: "config", kind: "call" },
    { from: "gui", to: "font", kind: "call" },
    { from: "gui", to: "mux", kind: "call" },
    { from: "config", to: "mux", kind: "call" },
    { from: "mux", to: "term", kind: "call" },
    { from: "mux", to: "pty", kind: "call" },
    { from: "term", to: "pty", kind: "call" },
    { from: "mux", to: "cs", kind: "call" },
    { from: "cs", to: "mux", kind: "call" },
    { from: "config", to: "gui", kind: "config" },
    { from: "config", to: "font", kind: "config" },
    { from: "config", to: "term", kind: "config" },
    { from: "mux", to: "gui", kind: "pubsub" },
  ],
};
