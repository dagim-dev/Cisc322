# CISC 322 Group Project Site

Site for TheZucks' Software Architecture course deliverables: reports, slides, and presentation videos. Built with Vite and deployed on Netlify.

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

## Add real content

1. **Put files in `public/assets/`** (suggested names):
   - `a1-report.pdf`, `a1-slides.pdf` (or `.pptx`)
   - `a2-report.pdf`, …
   - Videos: `.mp4` in `public/assets/` or use YouTube/Vimeo URLs

   Files there are served at `/assets/...`, so links in the page stay `assets/a2-report.pdf`.

2. **Update links in `index.html`** — for each assignment card, change the `href` on the buttons:

   ```html
   <a class="btn btn--primary" href="assets/a2-report.pdf">Report (PDF)</a>
   ```

   Remove `data-status="pending"` and `aria-disabled="true"` when the link is real.

3. **Optional embed** — uncomment the `<details>` block under an assignment card and set the `iframe` `src` to your PDF path.

## Structure

- `index.html` — page content
- `src/styles.css` — stylesheet entry (Tailwind plus the current theme)
- `src/legacy.css` — the current Queen's-inspired blue/gold theme
- `src/main.js` — JavaScript entry
- `public/assets/` — PDFs, slides, and media files
- `docs/REDESIGN_PLAN.md` — plan for the WebGL redesign
