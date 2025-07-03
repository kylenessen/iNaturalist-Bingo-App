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

# API settings
API_TIMEOUT = 10  # seconds
CACHE_TTL = 60 * 60 * 12  # 12 hours in seconds
