# CLAUDE.md

This file provides guidance to Claude Code when working in this repository.

## Product Direction

The active product is the static client-side app in `docs/`. It is intended to
run on GitHub Pages from the repository `docs/` folder.

The Streamlit app is deprecated. Do not add new functionality to the Streamlit
path. `main.py` and `ui.py` should only point users to the static app.

## Development Commands

- Run the app: `uv run python -m http.server 8765 --directory docs`
- Open locally: `http://127.0.0.1:8765`
- Check JavaScript syntax: `node --check docs/js/app.js && node --check docs/js/api.js && node --check docs/js/bingo.js && node --check docs/js/config.js && node --check docs/js/pdf.js`
- Format touched Python: `uv run black main.py ui.py config.py pdf_renderer.py`
- Lint touched Python: `uv run flake8 main.py ui.py config.py pdf_renderer.py`
- Run tests: `uv run pytest`

## Development Workflow

When implementing new features or bug fixes:

1. Create a new branch for the feature or fix.
2. Make small atomic commits as work progresses.
3. Prefer the static app in `docs/` for all user-facing changes.
4. Run targeted checks before each commit.
5. Ask the user to test the static app before opening a pull request.

## Architecture

The static app is browser-only and does not require a backend.

- `docs/index.html` contains the app shell.
- `docs/css/styles.css` contains app and PDF capture styles.
- `docs/js/api.js` fetches places and observations from iNaturalist.
- `docs/js/bingo.js` builds deterministic bingo grids.
- `docs/js/app.js` manages UI state and preview rendering.
- `docs/js/pdf.js` captures PDF pages with `html2canvas` and assembles them
  with `jsPDF`.
- `docs/lib/` contains vendored browser dependencies.

The legacy Python modules remain in the repo, but they are no longer the main
product. Keep changes there small and compatibility-focused unless the user
explicitly asks for legacy work.

## GitHub Pages

The expected production URL is:

https://kylenessen.github.io/iNaturalist-Bingo-App/

In repository settings, configure Pages to deploy from the primary branch and
the `/docs` folder.
