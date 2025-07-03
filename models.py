"""Data models for the iNaturalist Bingo App."""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Union


@dataclass
class Species:
    """Represents a species with its iNaturalist data."""

    taxon_id: int
    common_name: str
    scientific_name: str
    image_url: str

    @property
    def display_name(self) -> str:
        """Return the most appropriate display name for the species."""
        return self.common_name if self.common_name else self.scientific_name


# Type alias for bingo card cells (either a Species or "FREE" string)
BingoCell = Union[Species, str]

# Type alias for a bingo card grid
BingoGrid = List[List[BingoCell]]


@dataclass
class BingoCard:
    """Represents a bingo card with its grid and metadata."""

    grid: BingoGrid
    size: int
    has_free_square: bool
    seed: int | None = None

    def __post_init__(self) -> None:
        """Validate the card after initialization."""
        if len(self.grid) != self.size:
            raise ValueError(f"Grid must have {self.size} rows")
        for row in self.grid:
            if len(row) != self.size:
                raise ValueError(f"Each row must have {self.size} columns")
