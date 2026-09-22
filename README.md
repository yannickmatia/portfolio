# Yannick Matia portfolio

A multi-page personal portfolio for Yannick Matia, a Brooklyn-based marketing operations practitioner and creative writer. The site introduces his areas of expertise, published writing, personal perspective, and ways to connect.

## Build

The site is built with semantic HTML and CSS and hosted through GitHub Pages. It intentionally uses no off-the-shelf theme, framework, or browser-side JavaScript. A small Node script and scheduled GitHub workflow refresh the Writing page from Yannick's Substack RSS feed.

The primary pages are:

- `index.html` for the homepage
- `work.html` for professional expertise
- `writing.html` for published writing
- `about.html` for Yannick's biography and personal interests
- `style.css` for the shared visual system and responsive behavior

## Editing the site

Edit page copy directly in the corresponding HTML file. Shared colors, typography, spacing, layouts, and interactions live in `style.css`. Images are stored under `assets/`.

The Writing page is refreshed automatically each day. Its featured article and optional custom summaries are controlled in `content/writing.json`. Run `node scripts/update-writing.mjs` to preview an RSS update locally, then review `writing.html`.

Changes published to the configured GitHub Pages branch update the live site. Preview edited HTML locally before committing, and preserve the voice and visual principles documented in `DESIGN-BRIEF.md`.
