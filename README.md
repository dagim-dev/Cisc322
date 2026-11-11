# CISC 322 Group Project Site

Site for TheZucks' Software Architecture course deliverables: reports, slides, and presentation videos. It is a scroll-driven WebGL journey ("Phosphor": light made of terminal glyphs, a nod to our project subject, WezTerm), built with Vite and deployed on Netlify.

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

- `index.html` — page skeleton
- `src/content.js` — all text, team and assignment links
- `src/styles.css` — design tokens and styles (Tailwind v4)
- `src/main.js` — start-up: content, intro counter, loading the WebGL world
- `src/dom.js` — builds the team panels and assignment stations from the content file
- `src/scroll.js` — smooth scrolling (Lenis), text reveals and the pinned team gallery (GSAP)
- `src/intro.js`, `src/theatre.js`, `src/cursor.js`, `src/sound.js` — loading counter; video and report overlay; custom cursor; optional ambient sound
- `src/gl/` — the Three.js world: `world.js` (camera path, chapters, quality tiers), `particles.js` (the name as GPU particles), `tunnel.js`, `monoliths.js` (glass slabs), `portal.js` (assignment screens), `atmosphere.js` (sky, dust, fog), `post.js` and `transitions.js` (effects)
- `public/assets/` — PDFs, slides, and media files
- `docs/REDESIGN_PLAN.md` — the design plan this site was built from

## Behaviour worth knowing

- With "reduce motion" switched on in the operating system, or without WebGL, the page shows a static version with the same content.
- The loading counter plays once per browser tab session.
- Add `?tier=low`, `?tier=medium` or `?tier=high` to the URL to force a graphics quality level when testing, or `?static` to see the version without WebGL.
