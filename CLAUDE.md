# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- **Run the application**: `streamlit run main.py`
- **Install dependencies**: `uv sync`
- **Run tests**: `pytest`
- **Format code**: `black .`
- **Lint code**: `flake8`
- **Type checking**: `mypy main.py`

## Development Workflow

When implementing new features or bug fixes:

1. **Create a new branch** for the feature/fix (e.g., `feature/add-species-filter` or `fix/pdf-layout-bug`)
2. **Make commits automatically** during development using your judgment - commit logical units of work as you progress
3. **Run linting and type checking** before each commit to ensure code quality
4. **When the task is complete**, prompt the user to test the changes
5. **After user acceptance**, create a pull request back to the main branch

## Architecture

This is a Streamlit web application that generates bingo cards from iNaturalist observation data. The application:

1. **Data Fetching**: Uses the iNaturalist API via `pyinaturalist` to fetch research-grade species observations for a given place
2. **Grid Generation**: Creates randomized bingo grids from the species pool, with optional "FREE" center square for 5×5 cards
3. **PDF Generation**: Uses ReportLab to render multiple bingo cards into a single PDF with images, common names, and scientific names
4. **Caching**: Implements Streamlit's `@st.cache_data` decorator for API responses with 12-hour TTL

### Key Components

- `fetch_top_species()`: Cached function that retrieves species data from iNaturalist API, filtering by rank level (species through variety) and photo licenses
- `_build_grid()`: Generates randomized bingo card layouts with deterministic seeding
- `render_pdf()`: Creates PDF documents using ReportLab Platypus, with dynamic page orientation based on card size and photo inclusion
- `_lookup_place_id()`: Converts place names to iNaturalist place IDs using autocomplete API

### Configuration

- **Species filtering**: Only includes species-level taxa (rank levels 10-15) with allowed Creative Commons licenses
- **Photo handling**: Downloads and scales images proportionally within 1.4 inch constraints
- **PDF layout**: Landscape orientation for 5×5 cards with photos, portrait otherwise