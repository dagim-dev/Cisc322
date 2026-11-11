# TheZucks — Redesign v2: "Phosphor"

## Context

`redesign/webgl-showcase` (commit 43812d7) rebuilt the site as a dark WebGL page. It works, but it doesn't feel immersive yet. After looking at it running locally:

- **It looks like a UI with a backdrop behind it, not a world you move through.** The tab bar, the mux window frame, the pane grid and the card panels are flat HTML on top. The canvas mostly shows a synthwave grid floor, drifting dust and outline rectangles.
- **The colour is one flat navy** (`#060b16` with `#11335d` glows). There's no atmosphere, no light, and no change in mood from section to section.
- **The architecture graph and its legend** (Multiplexer core, procedural call, configuration injection, pub-sub edges) read like a diagram from the report, not like art. v2 removes them.
- The hero glyph word is the strongest moment, but it's small, framed and static once it has assembled.

**Goal:** a cinematic, scroll-driven world with one continuous camera journey, rich light and colour, and big editorial type. The content stays exactly the same: group name, six members with their roles, and three assignments (only A1 is live: report, slides and video). Keep everything that already works: Vite, Netlify, `content.js`, the theatre overlay, reduced-motion and no-WebGL fallbacks, and quality tiers.

## Creative direction

**"Phosphor": light made of characters.** WezTerm draws text with the GPU. We keep that DNA only as a material: everything glowing in the world is made of tiny luminous glyphs. There's no terminal chrome and no diagrams.

| | v1 (now) | v2 |
|---|---|---|
| Palette | flat navy plus gold | Ink black `#040406` → deep aubergine and teal fog. Warm phosphor amber `#ffb35c` and gold `#e8c468` are the light. One cool iridescent accent (cyan → violet) for interaction only. Colour shifts per chapter. |
| Type | Space Grotesk / Fraunces / Inter / Mono, all mid-size | Huge editorial display (**Instrument Serif** italic plus **Inter Tight** at 12–18vw) and small **JetBrains Mono** captions. Type is part of the composition and overlaps the 3D. |
| Space | grid floor, outline frames | Volumetric fog, light shafts, depth of field and real parallax. No grid floor. |
| Chrome | tab bar, progress rail, mux window, cards | Minimal: wordmark top-left, chapter index top-right (`01 — 04`), custom cursor. Content floats in the world without boxes. |
| Motion | camera lerps between keyframes | One continuous spline camera path. Chapters are joined by shader transitions (glyph dissolve, light wipe), not by plain scrolling. |

## The journey (4 chapters + intro)

**0. Intro (preloader, about 1.5 s, skippable)**
A real load-progress counter (`000 → 100`) in mono type. At 100 the screen is black and a single glyph flickers on in the centre. That glyph becomes the first particle of the hero. This replaces the terminal boot log.

**1. Hero: "TheZucks" as living light**
- About 120k–260k GPU particles (GPGPU via three's `GPUComputationRenderer`, count set by tier). Each is a tiny glyph sprite, and together they form the group name, sampled from the display font.
- The particles flow with curl noise. The cursor stirs them like ink in water, leaving a velocity trail that settles back.
- Warm amber core, cool rim light and heavy bloom. A slow breathing shimmer: random glyphs re-roll characters.
- Small captions in mono: "CISC 322 · Software Architecture · Fall 2026" and the lead line.
- **On scroll:** the word melts into a river of particles that pours toward the camera, and we dive through it.

**2. Tunnel transition → Team**
- The particle river wraps into a long glyph tunnel (rings of characters rushing past, speed tied to scroll velocity, motion-stretched sprites). This is a short warp, about 100vh.
- It exits into a dark, foggy hall with **six tall glass monoliths**: refractive slabs with dispersion that bend the light and particles behind them. Each member's name is set huge in Instrument Serif and floats in front of their slab.
- **Desktop:** the section pins and scroll moves the camera sideways past the six slabs (horizontal gallery, about 300vh). The active slab catches a light shaft. Role shows as a small mono caption (`group leader`, `presenter`) and a coloured light tint: gold for the presenters, cool for the leader. Hover makes the slab turn slightly toward the cursor, and the refraction shifts.
- **Phones:** no pin. Slabs stack vertically and each name reveals as it scrolls in.

**3. Assignments: three portals**
Each assignment is a full-screen chapter built around a **floating curved screen** in the fog.
- **A1 (live):** the screen plays a short, silent, low-res loop cut from the A1 video (generated once with ffmpeg, about 1–2 MB WebM/MP4) with a soft glow spill onto the fog. The title "Conceptual Architecture" runs huge across the screen. Three actions sit beneath as minimal underlined links with magnetic hover: **Watch** (theatre, full video), **Read report** (theatre PDF), **Slides**. Clicking Watch makes the screen fly forward and fill the viewport before the theatre opens.
- **A2 and A3 (pending):** the same screen, but dark frosted glass with slow static noise and a mono caption `transmission pending`. A soft glyph rain falls behind it. When a deliverable is added to `content.js`, it automatically gets the live treatment (it needs a `teaser` file, or it falls back to a poster still).
- Transitions between portals use a noise-dissolve wipe. Each portal has its own tint: A1 amber, A2 teal, A3 violet.

**4. Outro**
The camera pulls up and out. All particles from the journey drift back together into a small, calm version of the wordmark. Footer: "Queen's University · 2026" in mono, plus a "back to top" link. Clicking it rewinds the camera journey in fast-forward.

**Ambient across all chapters:** film grain, a subtle vignette, a little chromatic fringe at the screen edges, and depth of field focused on the current subject. An optional ambient sound toggle (off by default, a quiet drone plus soft ticks on hover) is in the polish phase and can be cut.

## What gets removed

- `src/gl/graph.js` and the projected label layer (`#labels`), `architecture` in `content.js`, the edge legend, the "Multiplexer" wording in the A1 summary styling.
- The mux window, panes, tab bar, progress rail, terminal boot log, grid floor and outline frames.
- The Fraunces and Space Grotesk fonts.

## Code plan

Keep the shape of the current code (an HTML-first DOM plus one fixed canvas behind it) and rebuild the scenes.

**Keep / adapt**
- `src/content.js`: keep `site`, `team`, `assignments`. Delete `architecture`. Add an optional `teaser` (loop video) and `poster` (still) to each assignment, and a `tint` per assignment.
- `src/theatre.js`: keep as is. Add a "fly-in" hook so the WebGL screen can animate before `showModal`.
- `src/main.js`: keep the orchestration (reduced-motion and WebGL checks, lazy `import()` of the world, session-skip of the intro). Swap `boot.js` for the new `intro.js` counter.
- `src/gl/world.js`: keep the renderer setup, `pickTier()` and tier auto-downgrade, `measure()` from DOM positions, pause logic and the render loop. Replace keyframe lerping with a `CatmullRomCurve3` camera path whose progress comes from scroll (anchors still measured from DOM sections). Replace dust, floor and frames with the new scene modules.
- `src/scroll.js`: keep Lenis, SplitText reveals, and `IntersectionObserver` for the active chapter (now driving the `01 — 04` index instead of tabs). Add the ScrollTrigger pin for the team gallery (desktop only, via `gsap.matchMedia`).
- `src/gl/glyphs.js`: reuse `buildAtlas()` and `sampleWord()` as the glyph texture and target-point source for the particle system.

**New modules (`src/gl/`)**
- `particles.js`: GPGPU position/velocity simulation (curl noise, target attraction, pointer stir, scroll-driven "pour" and "tunnel" modes), rendered as glyph-atlas point sprites.
- `tunnel.js`: instanced ring of glyph quads, velocity-stretched.
- `monoliths.js`: six slabs with a custom refraction shader (sample a half-res render target of the scene behind, RGB-split dispersion, fresnel rim), plus light shafts as additive cones.
- `portal.js`: curved screen mesh (bent plane), `VideoTexture` for the teaser or a frosted-static shader for pending, plus glow spill.
- `atmosphere.js`: fog volume (raymarched low-res noise or layered sprites by tier), background gradient sphere whose colours are tweened per chapter.
- `transitions.js`: full-screen noise-dissolve pass used between chapters.
- `post.js`: postprocessing pipeline (bloom, depth of field, grain, vignette, chromatic aberration), configured per tier. This moves out of `world.js`.

**DOM / CSS**
- `index.html`: new structure (`hero`, `team` with six `<li>`, `assignments` with three `<article>`, `outro`). Remove the tabbar, rail, mux, labels and boot. Add the intro, chapter index and cursor elements. Real headings, links and buttons stay in the DOM for accessibility. Names and titles are real text, positioned to sit over their 3D objects.
- `src/styles.css`: rewrite with new tokens in `@theme` (palette, Instrument Serif / Inter Tight / JetBrains Mono, fluid type scale with `clamp()`). Use `mix-blend-mode: difference` on the huge headings where they overlap bright 3D. Redesign the static fallback (gradient atmosphere plus large type) so reduced-motion and no-WebGL still look intentional.
- `src/cursor.js` (new): dot plus ring cursor with magnetic pull on links. Fine pointer only.

**Assets**
- `public/assets/a1-teaser.mp4` (and `.webm`): about 8–10 s, 960px, no audio, made with `ffmpeg` from `a1-video.mp4`. `a1-poster.webp` is a still frame. Both are small, and the 20 MB full video still loads only in the theatre.
- Fonts via Google Fonts: Instrument Serif, Inter Tight, JetBrains Mono.

**Dependencies**
No new ones are required (three, postprocessing, gsap, lenis are already installed). `GPUComputationRenderer` ships with `three/examples/jsm`.

## Performance and accessibility guardrails

- Tiers: **high** (260k particles, DOF, half-res refraction, raymarched fog), **medium** (120k, no DOF, sprite fog), **low** (40k, no post, no refraction: slabs become frosted planes). Auto-downgrade stays.
- The teaser video plays only while its portal is on screen. The render loop pauses when the tab is hidden or the theatre is open.
- Initial JS stays under 250 KB gzipped. The world chunk is lazy-loaded after first paint.
- Reduced motion and no-WebGL get a designed static page: a gradient atmosphere, huge type, a poster image for A1, and no pin.
- All text is in the DOM, the canvas is `aria-hidden`, focus is visible and contrast is AA against the darkest overlaps.

## Phases (each one deployable)

1. **Strip and re-skin:** remove the graph, legend, mux, tabbar and boot. New tokens, fonts, HTML structure and static fallback. Generate the teaser and poster with ffmpeg. Update `content.js`.
2. **World foundation:** spline camera rig, atmosphere and per-chapter colour, post pipeline per tier, intro counter.
3. **Hero particles:** GPGPU glyph particles forming the name, pointer stir, pour-on-scroll.
4. **Tunnel and team:** glyph tunnel, glass monoliths with refraction, pinned horizontal gallery (desktop) and stacked layout (mobile).
5. **Portals:** curved screens, A1 teaser texture, pending static, dissolve transitions, fly-in to theatre.
6. **Polish:** cursor, magnetic links, outro regather, optional sound toggle, tuning.
7. **QA:** phones, Safari and Firefox, reduced motion, no-WebGL, Lighthouse on the Netlify branch preview. Update `README.md` and replace `docs/REDESIGN_PLAN.md` with this plan.

## Verification

- `npm run dev` (launch config `site-dev`) and drive it in the browser pane. Scroll the full journey at desktop size, then with `resize_window` mobile, and check the console for errors.
- `?tier=low|medium|high` to check each quality tier. Use a frame-time readout (temporary, dev only) to confirm about 60 fps on high and that auto-downgrade triggers.
- Emulate `prefers-reduced-motion` and disable WebGL to confirm the static page is complete and all three A1 links work.
- `npm run build && npm run preview` to confirm the production bundle, chunk sizes and that `/assets/a1-*.{pdf,pptx,mp4}` URLs still resolve.
- Keyboard pass: tab through every link, open and close the theatre with Esc, and check that focus stays visible.
- Push the branch and check the Netlify branch-deploy preview before anything merges to `main`.

## What was built, and where it differs from the plan

All phases are implemented on `redesign/webgl-showcase`. The previous design ("Inside the Terminal": tab bar, mux panes, architecture graph) is replaced entirely.

- **Depth of field is done inside the particle shaders, not as a post pass.** The particles and dust are additive and write no depth, so a depth-based blur pass would have blurred the hero name. Instead, every point grows softer and dimmer the further it is from the camera's focus distance.
- **Fog is layered noise cards, not raymarched.** They are cheaper and look the same at this density. The count scales by tier.
- **Particle counts are 147k / 65k / 26k** (high / medium / low), not 260k. Brightness is normalised so every tier looks equally lit.
- **The teaser is MP4 only** (200 KB, 11 s montage of the A1 video). The WebM came out larger. **The poster is a JPEG**, because the local ffmpeg has no WebP encoder.
- **The chapter dissolve** runs as a post-processing effect at the tunnel exit and between the portals. It is light (peak about 40% of cells), so headings stay readable.
- **Glass refraction** renders the scene behind the slabs into a half-resolution target, only while the slabs are in front of the camera.
- `?static` was added to force the version without WebGL, for testing.

Not yet done: testing on real phones and in Safari and Firefox, a Lighthouse run against the Netlify branch preview, and a team review of the look before merging to `main`.
