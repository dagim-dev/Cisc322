# CISC 322 Group Project Site

**Live site: [cisc322.netlify.app](https://cisc322.netlify.app)**

The home for TheZucks' deliverables in CISC 322 (Software Architecture) at Queen's University, Fall 2026. Our project studies the architecture of **[WezTerm](https://github.com/wezterm/wezterm)**, the GPU-accelerated terminal emulator written in Rust. This site collects each assignment's report, slides, and presentation video in one place.

Instead of a plain list of files, the site is a scroll-driven 3D journey called "Phosphor". It is built from light made of terminal glyphs, using the same glyph-atlas technique WezTerm uses to draw text on the GPU.

## Deliverables

| | Assignment | Status |
| --- | --- | --- |
| A1 | **Conceptual Architecture**: WezTerm's major subsystems, how they work together, and the architectural styles behind them | Report, slides, and video live |
| A2 | **Concrete Architecture**: the architecture recovered from WezTerm's source code | Report, slides, and video live |
| A3 | **Architectural Enhancement**: a proposed enhancement and its effect on the architecture | Coming soon |

## Team

Dagim (presenter) · Armaan (group leader) · Arnav · Avaneesh · Ibraheem · Rahul (presenter)

## Built with

- **Three.js** for the WebGL world, with **postprocessing** for effects
- **GSAP** and **Lenis** for scroll-driven animation and smooth scrolling
- **Tailwind CSS v4** for styling
- **Vite** for the build, deployed on **Netlify**

## Features

- Scroll-driven camera path through a chapter per assignment, each with its own colour
- The group name rendered as GPU particles, plus glass slabs, a glyph tunnel, and floating video screens
- In-page overlay for watching videos and reading reports
- Automatic graphics quality tiers, and a static fallback page when "reduce motion" is on or WebGL isn't available
- All content driven from one file, so teammates can publish deliverables without touching HTML or 3D code

## Run locally

Requires Node 22 or newer.

```bash
npm install
```

```bash
npm run dev
```

Then visit `http://localhost:8080`. To check the production build instead:

```bash
npm run build
```

```bash
npm run preview
```

## Deploy

Netlify builds every push using `netlify.toml`: it runs `npm run build` and publishes `dist/`. Pushes to `main` update the live site.

## Add or change content

All content lives in `src/content.js`. Nobody needs to edit HTML or the 3D code.

1. **Put files in `public/assets/`**, for example `a2-report.pdf`, `a2-slides.pptx`, `a2-video.mp4`. Files there are served at `/assets/...`.
2. **Fill in the assignment's entry** in `src/content.js`:

   ```js
   report: "assets/a2-report.pdf",
   slides: { href: "assets/a2-slides.pptx", label: "Slides (PPTX)" },
   video: "assets/a2-video.mp4",
   ```

   A field left as `null` is left out, and an assignment with no files shows as "transmission pending".
   Optional extras: `teaser` (a short silent loop for the floating screen), `poster` (a still for the static page) and `tint` (the chapter's colour).
   A teaser can be cut from the full video with ffmpeg, for example:

   ```bash
   ffmpeg -ss 30 -t 10 -i public/assets/a2-video.mp4 -vf scale=960:-2,fps=24 -an -crf 30 public/assets/a2-teaser.mp4
   ```
3. **Team members and roles** are the `team` list in the same file.

## Structure

- `index.html`: page skeleton
- `src/content.js`: all text, team and assignment links
- `src/styles.css`: design tokens and styles (Tailwind v4)
- `src/main.js`: start-up, covering content, the intro counter, and loading the WebGL world
- `src/dom.js`: builds the team panels and assignment stations from the content file
- `src/scroll.js`: smooth scrolling (Lenis), text reveals and the pinned team gallery (GSAP)
- `src/intro.js`, `src/theatre.js`, `src/cursor.js`, `src/sound.js`: loading counter; video and report overlay; custom cursor; optional ambient sound
- `src/gl/`: the Three.js world
  - `world.js`: camera path, chapters, quality tiers
  - `glyphs.js`: the terminal-glyph texture atlas shared across the world
  - `particles.js`: the name as GPU particles
  - `tunnel.js`, `monoliths.js` (glass slabs), `portal.js` (assignment screens), `atmosphere.js` (sky, dust, fog)
  - `post.js` and `transitions.js`: effects
- `public/assets/`: PDFs, slides, and media files
- `docs/REDESIGN_PLAN.md`: the design plan this site was built from

## Behaviour worth knowing

- With "reduce motion" switched on in the operating system, or without WebGL, the page shows a static version with the same content.
- The loading counter plays once per browser tab session.
- Add `?tier=low`, `?tier=medium` or `?tier=high` to the URL to force a graphics quality level when testing, or `?static` to see the version without WebGL.
