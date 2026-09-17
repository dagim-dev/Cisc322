# CISC 322 Group Project Site

Static site for Software Architecture course deliverables: reports, slides, and presentation videos.

## View locally

Open `index.html` in a browser, or run a simple server:

```bash
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.

## Add real content

1. **Put files in `assets/`** (suggested names):
   - `a1-report.pdf`, `a1-slides.pdf` (or `.pptx` link externally)
   - `a2-report.pdf`, …
   - Videos: `.mp4` in `assets/` or use YouTube/Vimeo URLs

2. **Update links in `index.html`** — for each assignment card, change the `href` on the three buttons:

   ```html
   <a class="btn btn--primary" href="assets/a1-report.pdf">Report (PDF)</a>
   ```

   Remove `data-status="pending"` and `aria-disabled="true"` when the link is real.

3. **Optional embed** — uncomment the `<details>` block under an assignment card and set the `iframe` `src` to your PDF path.

4. **Customize copy** — edit the hero group name (`Null Pointers`), assignment titles, and description lines in `index.html`.

## Structure

- `index.html` — page content
- `styles.css` — layout and Queen's-inspired blue/gold theme
- `assets/` — PDFs, slides, and media files
