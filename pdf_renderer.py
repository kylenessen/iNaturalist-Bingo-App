"""PDF rendering functionality for bingo cards."""

from __future__ import annotations

import io
from typing import List

import requests
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, landscape, portrait
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import (
    Image,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.lib.units import inch

from config import CELL_PADDING, PHOTO_SIZE, API_TIMEOUT
from models import BingoCard, Species


class PDFRenderer:
    """Renders bingo cards to PDF format."""

    def __init__(self) -> None:
        """Initialize the PDF renderer."""
        self.styles = getSampleStyleSheet()
        self.timeout = API_TIMEOUT

    def render_cards(
        self,
        cards: List[BingoCard],
        photo_on: bool = True,
        common_on: bool = True,
        sci_on: bool = True,
        title: str = "Bingo Cards",
    ) -> bytes:
        """Render multiple bingo cards to a PDF document."""
        buffer = io.BytesIO()

        # Page orientation: landscape for 5×5 with photos, else portrait
        grid_size = cards[0].size if cards else 5
        pagesize = (
            landscape(letter)
            if grid_size == 5 and photo_on
            else portrait(letter)
        )

        doc = SimpleDocTemplate(
            buffer,
            pagesize=pagesize,
            leftMargin=inch,
            rightMargin=inch,
            topMargin=inch,
            bottomMargin=inch,
        )

        elements = []

        for card_idx, card in enumerate(cards):
            if card_idx > 0:
                elements.append(PageBreak())

            elements.append(Paragraph(title, self.styles["Title"]))
            elements.append(Spacer(1, 0.2 * inch))

            table = self._create_card_table(card, photo_on, common_on, sci_on)
            elements.append(table)

        doc.build(elements)
        return buffer.getvalue()

    def _create_card_table(
        self,
        card: BingoCard,
        photo_on: bool,
        common_on: bool,
        sci_on: bool,
    ) -> Table:
        """Create a table representation of a bingo card."""
        tbl_data: List[List] = []

        for row in card.grid:
            tbl_row = []
            for cell in row:
                if cell == "FREE":
                    p = Paragraph("FREE", self.styles["Heading2"])
                    tbl_row.append(p)
                    continue

                if isinstance(cell, Species):
                    flow = self._create_cell_content(
                        cell, photo_on, common_on, sci_on
                    )
                    tbl_row.append(flow)
                else:
                    tbl_row.append([])

            tbl_data.append(tbl_row)

        table = Table(tbl_data, repeatRows=0, hAlign="CENTER")
        table.setStyle(
            TableStyle(
                [
                    ("GRID", (0, 0), (-1, -1), 0.75, colors.grey),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("LEFTPADDING", (0, 0), (-1, -1), CELL_PADDING),
                    ("RIGHTPADDING", (0, 0), (-1, -1), CELL_PADDING),
                    ("TOPPADDING", (0, 0), (-1, -1), CELL_PADDING),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), CELL_PADDING),
                ]
            )
        )

        return table

    def _create_cell_content(
        self,
        species: Species,
        photo_on: bool,
        common_on: bool,
        sci_on: bool,
    ) -> List:
        """Create the content for a single bingo card cell."""
        flow = []

        # Add photo if enabled and available
        if photo_on and species.image_url:
            try:
                img_bytes = requests.get(
                    species.image_url, timeout=self.timeout
                ).content
                img = Image(io.BytesIO(img_bytes))
                img._restrictSize(PHOTO_SIZE, PHOTO_SIZE)
                flow.append(img)
            except Exception:
                pass  # Skip image if download fails

        # Add names
        name_parts = []
        if common_on and species.common_name:
            name_parts.append(species.common_name)
        if sci_on and species.scientific_name:
            sci_html = (
                f"<i>{species.scientific_name}</i>"
                if common_on
                else species.scientific_name
            )
            name_parts.append(sci_html)

        if name_parts:
            flow.append(
                Paragraph("<br/>".join(name_parts), self.styles["BodyText"])
            )

        return flow
