# CISC 322 Group Project Site

Site for TheZucks' Software Architecture course deliverables: reports, slides, and presentation videos. It is a scroll-driven WebGL page themed on our project subject, WezTerm, built with Vite and deployed on Netlify.

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

   A field left as `null` shows as a disabled button, and an assignment with no files shows as "awaiting signal".
3. **Team members and roles** are the `team` list in the same file.
4. **The architecture graph** beside A1 is the `architecture` object: `nodes` are the subsystems and `edges` are the dependencies from section 3 of the A1 report.

## Structure

- `index.html` — page skeleton
- `src/content.js` — all text, team, assignment links and the architecture graph data
- `src/styles.css` — design tokens and styles (Tailwind v4)
- `src/main.js` — start-up: content, boot sequence, loading the WebGL scene
- `src/dom.js` — builds the team panes and assignment cards from the content file
- `src/scroll.js` — smooth scrolling (Lenis) and scroll animations (GSAP)
- `src/boot.js`, `src/theatre.js` — loading sequence; video and report overlay
- `src/gl/` — the Three.js scene: `world.js` (camera, quality tiers, effects), `glyphs.js` (hero title), `graph.js` (architecture graph)
- `public/assets/` — PDFs, slides, and media files
- `docs/REDESIGN_PLAN.md` — the design plan this site was built from

## Behaviour worth knowing

- With "reduce motion" switched on in the operating system, or without WebGL, the page shows a static version with the same content.
- The loading sequence plays once per browser tab session.
- Add `?tier=low`, `?tier=medium` or `?tier=high` to the URL to force a graphics quality level when testing.
