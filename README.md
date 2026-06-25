# iNaturalist Bingo App

A client-side web app for generating printable bingo cards from iNaturalist
observation data. The current app lives in `docs/` and runs as static HTML,
CSS, and JavaScript. It can be hosted directly on GitHub Pages.

Live app after GitHub Pages is enabled:

https://kylenessen.github.io/iNaturalist-Bingo-App/

The old Streamlit app is deprecated. Running `streamlit run main.py` now shows
a migration notice that points users to the static app.

## Features

- Real species data from the public iNaturalist API.
- Grid sizes of 3x3, 5x5, 7x7, and 9x9.
- Optional photos, common names, scientific names, and center FREE square.
- Category and month filters for focused field trips.
- Client-side PDF generation with `html2canvas` and `jsPDF`.
- No API keys and no backend server.

## Local Development

Serve the static app from the `docs/` folder.

```bash
uv run python -m http.server 8765 --directory docs
```

Then open:

http://127.0.0.1:8765

The app has no build step. Edit files under `docs/`, then refresh the browser.

## GitHub Pages

The app is designed to be served from the repository `docs/` folder.

In GitHub, open the repository settings. Go to Pages. Set the source to deploy
from a branch. Choose the primary branch, then choose the `/docs` folder.

After GitHub Pages finishes publishing, the app should be available at:

https://kylenessen.github.io/iNaturalist-Bingo-App/

## Project Structure

- `docs/index.html` contains the static app shell.
- `docs/css/styles.css` contains app and PDF capture styles.
- `docs/js/app.js` wires the UI together.
- `docs/js/api.js` talks to the iNaturalist API.
- `docs/js/species-settings.js` calculates species pool defaults and warnings.
- `docs/js/bingo.js` builds deterministic bingo grids.
- `docs/js/pdf.js` renders PDF pages in the browser.
- `docs/lib/` contains vendored browser PDF dependencies.
- `main.py` is only a deprecation notice for old Streamlit users.

The remaining Python modules are legacy support code from the original app.
They are no longer the primary product surface.

## Checks

```bash
node --check docs/js/app.js
node --check docs/js/api.js
node --check docs/js/bingo.js
node --check docs/js/config.js
node --check docs/js/pdf.js
node --check docs/js/species-settings.js
node --test docs/js/species-settings.test.mjs
node tests/pdf-layout.test.mjs
uv run black main.py ui.py config.py pdf_renderer.py
uv run flake8 main.py ui.py config.py pdf_renderer.py
```

## License

This project is released under the MIT License.

## Acknowledgments

Thanks to iNaturalist and its community for the observation data that makes
this app useful for nature education and field trips.
