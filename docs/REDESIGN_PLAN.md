# TheZucks — WebGL Showcase Refactor Plan

Branch: `redesign/webgl-showcase` · Deploy: Netlify from GitHub (must keep working)

## 1. Where the site is today

- One static page: `index.html` (hero, team of six, three assignment cards) and `styles.css` (light Queen's blue/gold theme, Fraunces + Inter).
- No JavaScript, no build step, no `netlify.toml`. Netlify publishes the repo root.
- Real content exists only for A1 (report PDF 0.6 MB, slides PPTX 4 MB, video MP4 20 MB). A2 and A3 are placeholders.
- Teammates update content by hand-editing `index.html`.

## 2. Creative direction: "Inside the Terminal"

The project studies WezTerm, a GPU-accelerated terminal multiplexer. The site becomes that subject: the visitor boots into a GPU-rendered terminal world and scrolls through it. Every visual idea comes from the material, so it reads as a concept and not as decoration.

| Element | Direction |
|---|---|
| Mood | Dark, deep-space terminal. Glowing glyphs, scanlines kept subtle, real depth. |
| Colour | Near-black navy `#060b16` base, Queen's blue `#11335d` as mid-tone, Queen's gold `#b89c4e` → brighter `#e8c468` as the single accent, a cool cyan `#6fd3ff` reserved for "live signal" only. |
| Type | Display: Space Grotesk (or keep Fraunces for the group name only). UI and labels: JetBrains Mono. Body: Inter. |
| Motion | Slow camera, fast glyphs. Camera moves ease over 1–1.5 s; text and UI respond in 150–400 ms. Nothing loops loudly. |
| Signature | Everything is built from terminal cells: text assembles from glyph particles, the team are multiplexer panes, the architecture is a live 3D graph. |

## 3. Layout: one fixed canvas, five scenes

A single full-viewport WebGL canvas sits fixed behind the page. Real HTML content scrolls on top of it. Scroll position drives the camera along a path, so the DOM stays the source of truth for content, links and accessibility.

### Scene 0 — Boot sequence (loader)
- Terminal boot log types out line by line; the progress figure is the real asset-load progress.
- Ends on a blinking prompt: `$ ./thezucks --start`. Scroll, click or Enter begins.
- Skipped on repeat visits in the same session and under reduced motion.

### Scene 1 — Hero
- "TheZucks" forms from several thousand instanced glyph cells that fly in and settle into the letterforms; idle state has a slow shimmer of characters changing.
- Pointer moves a soft light and parallaxes the glyph field; cells near the cursor scatter and return.
- Eyebrow line and lead paragraph remain HTML, revealed by split-line animation.
- On scroll the letters break apart and stream forward as the camera flies through them.

### Scene 2 — Team as multiplexer panes
- Six floating panes arranged like a split terminal layout in 3D, one per member, each with a title bar, a name in large mono type and a status line.
- Leader pane carries a blue status line, the two presenter panes a gold one; the "Group leader / Presenters" pills become a legend in a status bar under the layout.
- Scroll in: panes split off from one full-screen pane, the way a multiplexer splits. Hover or focus: the pane comes forward, tilts toward the pointer and its border lights up.
- On phones this becomes a vertical stack of HTML cards with the canvas as background only.

### Scene 3 — Assignments as architecture
The section pins while the visitor scrolls through three "stations".

- **A1 Conceptual Architecture:** a 3D graph of the eight subsystems orbiting a central Multiplexer core. Solid edges show client–server links; travelling pulses show implicit-invocation events. Hovering a node labels it and highlights its dependencies. The A1 card (title, summary, Report / Slides / Video actions) sits beside it as HTML.
- **A2 Concrete Architecture:** the same graph shown as a dim wireframe with "awaiting signal" static. When A2 content is added it lights up.
- **A3 Architectural Enhancement:** a ghost node attaching to the graph, same locked treatment.
- **Media theatre:** Video and Report open in a full-screen overlay; the canvas dims, blurs and stops rendering while it is open. Download links stay plain links.

Subsystem names and edges will be taken from the A1 report, not invented.

### Scene 4 — Footer
- Camera pulls back until the whole world is a single terminal window. Footer text types as the last line, ending in `$ exit` with a blinking cursor.

### Navigation
- Slim fixed top bar styled as a tab bar (`team`, `a1`, `a2`, `a3`), active tab follows scroll.
- A thin progress rail on the right edge shows scene position on desktop.

## 4. Animation triggers

| Trigger | Element | Behaviour | Timing |
|---|---|---|---|
| Page load | Boot log, then hero glyphs | Type-on, then glyph assembly | 1.8 s boot (skippable), 1.4 s assembly |
| Scroll scrub | Camera path | Position and look-at tied to scroll progress | Scrubbed, 0.6 s smoothing |
| Scroll scrub | Hero glyphs | Dissolve into a forward stream | First 100 vh |
| Section enter | Headings and paragraphs | Split lines rise and fade in | 0.7 s, 60 ms stagger |
| Section enter | Team panes | One pane splits into six | 1.2 s, scrubbed on desktop |
| Pin | Assignments | Section pinned for about 300 vh, three stations | Snaps to nearest station |
| Hover / focus | Pane, graph node, button | Tilt, glow, label, magnetic pull on buttons | 150–250 ms |
| Pointer move | Light, parallax, glyph scatter | Continuous, damped | Lerp factor about 0.08 |
| Click | Video / Report | Theatre overlay opens, canvas dims and pauses | 0.5 s |
| Idle 8 s | Graph | Slow auto-orbit and ambient event pulses | Loop |
| Tab hidden or canvas off-screen | Render loop | Paused | Immediate |
| Reduced motion | Everything | No scrub, pin or particles; static frame and simple fades | — |

## 5. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Build | **Vite** (vanilla JS, ES modules) | Fast, tiny config, outputs static files Netlify can host as-is. |
| 3D | **Three.js** directly, no React | One page with one canvas; React Three Fiber would add a framework for no gain. |
| Shaders / effects | Custom GLSL plus **postprocessing** (pmndrs) | Bloom, subtle chromatic aberration, vignette and grain in one merged pass. |
| Scroll and timelines | **GSAP + ScrollTrigger + SplitText** | Best tool for scrubbed, pinned, camera-linked sequences; now free. |
| Smooth scroll | **Lenis** | Inertia scroll that keeps native scrolling and works with ScrollTrigger. |
| Styling | **Tailwind CSS v4** (`@tailwindcss/vite`) with tokens as CSS variables | Fast layout work and one source for colour, type and spacing. |
| 3D text | Glyph atlas with instanced quads; **troika-three-text** for node labels | Thousands of cells in one draw call. |
| Device tiers | **detect-gpu** | Picks high / medium / low quality before the scene starts. |
| Micro-interactions | GSAP as well | **Motion** is a fine library, but two animation engines on one page is avoidable weight. |

## 6. Netlify: keeping deploys working

1. Add `netlify.toml` in the same commit that adds Vite: build command `npm run build`, publish directory `dist`, pinned Node version.
2. Move `assets/` to `public/assets/` so the existing URLs (`/assets/a1-report.pdf` and so on) do not change.
3. Add long-cache headers for hashed JS/CSS; keep media on default caching.
4. Push the branch and enable branch deploys for it in Netlify, so every step is checked on a real preview URL.
5. Merge to `main` only after the preview build is green and the three A1 links work. Production stays on the current site until then.
6. `serve.py` is replaced by `npm run dev` / `npm run preview`; the README is rewritten to match.

## 7. Content workflow for the team

Assignment and team data move into one file, `src/content.js`. Adding A2 means dropping files in `public/assets/` and filling in one object; nobody edits markup or shaders. The page HTML and the 3D scene both read from that file.

## 8. Performance and accessibility

- **Budgets:** initial JS under 250 KB gzipped, text visible in under 2 s on a mid-range laptop, 60 fps on desktop and at least 30 fps on a recent phone.
- Three.js and the scene load as a separate chunk after the HTML has painted.
- Pixel ratio capped at 2 (1.5 on the medium tier); post-processing off on the low tier; particle counts scale by tier.
- The render loop stops when the tab is hidden, the canvas is off-screen or the theatre is open.
- The 20 MB video is never preloaded; it only loads when the theatre opens.
- All content is real HTML: headings, links and buttons work with keyboard and screen readers; the canvas is `aria-hidden`.
- `prefers-reduced-motion` and "no WebGL" both get a designed static version, not a broken page.
- Text contrast meets WCAG AA against the dark background; focus rings are visible everywhere.

## 9. Phases

| Phase | Outcome | Deployable? |
|---|---|---|
| 0. Tooling | Vite, Tailwind, `netlify.toml`, assets moved, current design unchanged, preview deploy green | Yes |
| 1. Design system and DOM | Dark theme, new type, new HTML layout for all sections, content in `content.js`, Lenis and text reveals | Yes, a strong site even with no WebGL |
| 2. WebGL foundation | Canvas, renderer, quality tiers, scroll-driven camera rig, hero glyph scene | Yes |
| 3. Core scenes | Team panes, A1 architecture graph, A2/A3 locked states, pinned assignments section | Yes |
| 4. Polish | Boot loader, post-processing, media theatre, footer pull-back, cursor and hover details | Yes |
| 5. QA and launch | Phone and tablet pass, reduced-motion and no-WebGL pass, Lighthouse, cross-browser, merge to `main` | Launch |

## 10. Risks

| Risk | Mitigation |
|---|---|
| Build step breaks the live site | `netlify.toml` lands with Vite; nothing merges before a green preview. |
| Weak phones and laptops | GPU tiers, capped pixel ratio, HTML-first layout on small screens. |
| Scroll effects hurt usability | Native scroll kept, one pinned section only, snapping is gentle, reduced-motion path. |
| Markers want the files fast | Report, slides and video stay one click from the top via the tab bar. |
| Graph misrepresents the architecture | Nodes and edges are transcribed from the A1 report and reviewed by the team. |

## 11. Open decisions

1. Dark theme throughout, or keep a light variant? The plan assumes dark only.
2. Keep Fraunces for the group name, or go fully Space Grotesk + JetBrains Mono?
3. Subsystem list and dependencies for the A1 graph need to be confirmed against the report.
