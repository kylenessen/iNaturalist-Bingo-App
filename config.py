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

# PDF rendering constants
CELL_PADDING = 4  # pts
PHOTO_SIZE = 1.4 * inch  # will be scaled proportionally

# Page layout constants for dynamic scaling
PAGE_WIDTH = 8.5 * inch
PAGE_HEIGHT = 11 * inch
MARGIN_SIZE = 1 * inch
USABLE_WIDTH = PAGE_WIDTH - (2 * MARGIN_SIZE)  # 6.5 inches
USABLE_HEIGHT = PAGE_HEIGHT - (2 * MARGIN_SIZE) - (0.5 * inch)  # 8.5 inches (minus title space)

# Dynamic scaling factors by grid size
# Square images are 75x75px, so we can make them fill most of the cell
GRID_SCALING = {
    3: {"cell_size": 2.0 * inch, "photo_size": 1.6 * inch, "padding": 4, "text_size": 10},
    5: {"cell_size": 1.2 * inch, "photo_size": 1.0 * inch, "padding": 3, "text_size": 8},
    7: {"cell_size": 0.85 * inch, "photo_size": 0.7 * inch, "padding": 2, "text_size": 7},
    9: {"cell_size": 0.65 * inch, "photo_size": 0.55 * inch, "padding": 1, "text_size": 6},
}

# API settings
API_TIMEOUT = 10  # seconds
CACHE_TTL = 60 * 60 * 12  # 12 hours in seconds
