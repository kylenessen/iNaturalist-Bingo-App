"""Configuration constants and settings for the iNaturalist Bingo App."""

from __future__ import annotations

from reportlab.lib.units import inch

# Photo licensing constants
ALLOWED_LICENSES = {
    "cc0",
    "cc-by",
    "cc-by-nc",
    "cc-by-sa",
    "cc-by-nc-sa",
}

# Species rank levels: species (10) through variety (15)
SPECIES_RANK_LEVELS = set(range(10, 16))

# Page layout constants for PDF rendering
PAGE_WIDTH = 8.5 * inch
PAGE_HEIGHT = 11 * inch
MARGIN_SIZE = 0.5 * inch  # Uniform margins on all sides
TITLE_BLOCK_HEIGHT = 0.78 * inch
USABLE_WIDTH = PAGE_WIDTH - (2 * MARGIN_SIZE)
USABLE_HEIGHT = PAGE_HEIGHT - (2 * MARGIN_SIZE)
GRID_AREA_HEIGHT = USABLE_HEIGHT - TITLE_BLOCK_HEIGHT

# Text and padding scale by grid density. Cell width and height are derived
# from the shared printable area so every square card fills the page similarly.
GRID_CELL_STYLES = {
    3: {"padding": 4, "text_size": 10},
    5: {"padding": 3, "text_size": 8},
    7: {"padding": 2, "text_size": 7},
    9: {"padding": 1, "text_size": 6},
}

# API settings
API_TIMEOUT = 10  # seconds
CACHE_TTL = 60 * 60 * 12  # 12 hours in seconds
