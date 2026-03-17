# Migration Plan: Client-Side Bingo App on GitHub Pages

## Overview

Migrate the existing Streamlit/Python app to a fully client-side HTML/CSS/JS application. Primary motivations:

1. **Type-ahead place search** — the #1 user pain point
2. **Live card preview** before downloading
3. **Faster generation** — parallel image loading in the browser
4. **Free hosting** on GitHub Pages (static files, no server)

---

## Tech Stack

- **Vanilla JS** with ES modules — no framework, no build tools, no npm
- **CSS Grid** for bingo card layouts
- **CSS `object-fit: cover`** for center-cropping images (replaces Pillow processing)
- **jsPDF + html2canvas** (vendored) for client-side PDF generation
- **GitHub Pages** serving from `docs/` folder

---

## Project Structure

```
docs/
  index.html              Single-page app
  css/
    styles.css            Layout, form, cards, type-ahead, responsive
  js/
    app.js                Event wiring, state management, DOM rendering
    api.js                iNaturalist API calls (place search + species fetch)
    bingo.js              Seeded PRNG + grid generation
    pdf.js                html2canvas capture → jsPDF pages
    config.js             Constants (scaling, taxa, licenses, months)
  lib/
    jspdf.umd.min.js      Vendored (no CDN dependency)
    html2canvas.min.js     Vendored (no CDN dependency)
```

---

## Feature Mapping: Python → JavaScript

| Current (Python/Streamlit) | New (JS/Browser) | Notes |
|---|---|---|
| `inaturalist_client.py` `lookup_place_id()` | `api.js` `searchPlaces()` | Returns multiple results for type-ahead (not just first match). Uses `/places/autocomplete?per_page=10`. |
| `inaturalist_client.py` `fetch_top_species()` | `api.js` `fetchTopSpecies()` | Same API endpoint and params. In-memory cache replaces `@st.cache_data`. |
| `bingo_generator.py` `_build_grid()` | `bingo.js` `buildGrid()` | Seedable PRNG (mulberry32) + Fisher-Yates shuffle. Same seed = same cards, but not cross-compatible with Python output. |
| `models.py` `Species` dataclass | Plain JS objects `{ taxonId, commonName, scientificName, imageUrl }` | No class needed. |
| `config.py` grid scaling constants | `config.js` `GRID_SCALING` | Converted to CSS-friendly units for preview; inch-based for PDF. |
| `image_processor.py` center crop (Pillow) | CSS `object-fit: cover` on `<img>` | No JS image processing needed. html2canvas captures the cropped result for PDF. |
| `pdf_renderer.py` (ReportLab) | `pdf.js` (html2canvas + jsPDF) | Capture each card at 2x resolution, assemble into letter-size PDF pages. |
| `ui.py` Streamlit form | `index.html` + `app.js` | Native HTML form elements. Type-ahead is a custom input + dropdown. |
| `@st.cache_data` 12h TTL | In-memory `Map` cache | Session-scoped. Keyed on `placeId-topN-months-taxa`. |

---

## Component Details

### Type-Ahead Place Search
- `<input>` with `input` event listener, debounced 300ms
- Calls `/v1/places/autocomplete?q=...&per_page=10`
- Dropdown: absolutely positioned `<ul>` below input
- Keyboard navigation: arrow keys, Enter to select, Escape to close
- Selecting a place stores `{ id, displayName }` in app state
- Clicking outside closes the dropdown

### Live Preview
- Cards render as CSS Grid elements with real `<img>` tags
- Browser loads all images in parallel (major speed improvement)
- Paginated: show one card at a time with prev/next navigation
- All toggle controls (photo, common name, scientific name) re-render immediately
- Loading skeleton while images load

### PDF Generation
- Render each card in a hidden container sized to letter proportions (8.5" × 11")
- html2canvas captures at 2x resolution (192 effective DPI)
- jsPDF assembles captured images into pages
- Tradeoff: text is rasterized (not selectable), acceptable for printed bingo cards

### Seedable Randomization
- Mulberry32 PRNG (~6 lines of code)
- Fisher-Yates shuffle using the seeded PRNG
- Deterministic: same seed always produces same cards
- Will not match Python's Mersenne Twister output (not needed)

---

## UI Controls (all carried over from current app)

- **Place search** — type-ahead with autocomplete (replaces text input)
- **Grid size** — 3×3, 5×5, 7×7, 9×9
- **Species pool size** — slider, 10–100, default 25
- **Number of cards** — 1–100, default 10
- **Random seed** — optional, for reproducibility
- **Free center square** — checkbox
- **Display toggles** — photo, common name, scientific name
- **Document title** — text input, default "Bingo: Field Trip Edition"
- **Filter by category** — checkbox + multi-select (iconic taxa)
- **Filter by months** — checkbox + multi-select

---

## Implementation Phases

### Phase 1: Skeleton + Place Search
- Create `index.html` with complete form layout
- Create `styles.css` with form and layout styles
- Create `config.js` with all constants ported from Python
- Implement `searchPlaces()` in `api.js`
- Wire up debounced type-ahead with dropdown in `app.js`
- **Deliverable:** Working place search with type-ahead suggestions

### Phase 2: Species Fetching + Card Generation
- Implement `fetchTopSpecies()` in `api.js` with response caching
- Port grid generation to `bingo.js` with seedable PRNG
- Wire generate button: validate inputs → fetch species → generate grids
- Add loading states and error messages
- **Deliverable:** Cards generated in memory from API data

### Phase 3: Live Preview
- Implement card rendering as CSS Grid in `app.js`
- Dynamic sizing based on grid dimensions
- `object-fit: cover` for center-cropped images
- Paginated card navigation (prev/next)
- Toggle handlers for photo/common name/scientific name
- **Deliverable:** Visual preview of all cards in browser

### Phase 4: PDF Download
- Vendor jsPDF and html2canvas into `lib/`
- Implement `pdf.js`: render each card at letter-size proportions, capture at 2x, assemble PDF
- Progress indicator during generation
- **Deliverable:** Downloadable PDF matching preview

### Phase 5: Polish
- Responsive design for mobile/tablet
- Loading spinners and skeleton states
- Error states (no results, network errors, insufficient species)
- GitHub Pages deployment config
- Update README with new usage instructions

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| html2canvas font/style quirks | PDF may not match preview exactly | Test all grid sizes; use simple CSS that html2canvas handles well |
| Large card counts (100 × 9×9 = 8100 images) | Slow preview/PDF generation | Paginated preview; only render visible card; batch PDF generation with progress bar |
| iNaturalist image CORS | html2canvas can't capture cross-origin images | Use `html2canvas({ useCORS: true })`; iNat CDN appears to serve appropriate headers |
| iNaturalist API rate limits | Requests may be throttled | App makes only 2 API calls per generation; image loading hits a separate CDN |
| No offline capability | App requires internet | Same as current Streamlit version; not a regression |

---

## Browser Compatibility

ES modules, CSS Grid, `object-fit`, `fetch` — all supported in browsers from ~2018+. No IE11 concern for a nature education tool.
