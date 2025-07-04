"""Bingo card generation logic."""

from __future__ import annotations

import random
from typing import List

from models import Species, BingoCard, BingoGrid, BingoCell


class BingoGenerator:
    """Generator for creating bingo cards from species data."""

    def __init__(self, species_pool: List[Species]) -> None:
        """Initialize the generator with a species pool."""
        self.species_pool = species_pool

    def generate_card(
        self, grid_size: int, free_square: bool = False, seed: int | None = None
    ) -> BingoCard:
        """Generate a single bingo card with the specified parameters."""
        if grid_size**2 > len(self.species_pool) + (1 if free_square else 0):
            raise ValueError("Not enough species to fill the requested card size")

        grid = self._build_grid(grid_size, free_square, seed)
        return BingoCard(
            grid=grid, size=grid_size, has_free_square=free_square, seed=seed
        )

    def generate_cards(
        self,
        num_cards: int,
        grid_size: int,
        free_square: bool = False,
        base_seed: int | None = None,
    ) -> List[BingoCard]:
        """Generate multiple bingo cards with different randomization."""
        cards = []
        for i in range(num_cards):
            card_seed = base_seed + i if base_seed is not None else None
            card = self.generate_card(grid_size, free_square, card_seed)
            cards.append(card)
        return cards

    def _build_grid(
        self, grid_size: int, free_square: bool, seed: int | None
    ) -> BingoGrid:
        """Build a grid_size×grid_size matrix for the bingo card."""
        rnd = random.Random(seed)
        shuffled = self.species_pool.copy()
        rnd.shuffle(shuffled)

        needed = grid_size**2 - (1 if free_square and grid_size == 5 else 0)
        cells = shuffled[:needed]

        grid: BingoGrid = []
        idx = 0

        for r in range(grid_size):
            row: List[BingoCell] = []
            for c in range(grid_size):
                if free_square and grid_size == 5 and r == c == grid_size // 2:
                    row.append("FREE")
                else:
                    row.append(cells[idx])
                    idx += 1
            grid.append(row)

        return grid
