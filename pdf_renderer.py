"""PDF rendering functionality for bingo cards."""

from __future__ import annotations

import io
from typing import List

import requests
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, portrait
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    Image,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from config import (
    API_TIMEOUT,
    GRID_AREA_HEIGHT,
    GRID_CELL_STYLES,
    MARGIN_SIZE,
    USABLE_WIDTH,
)
from models import BingoCard, Species
from image_processor import process_image_for_bingo


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

        # Use portrait orientation for all sizes.
        # Rectangular cells fill the page.
        pagesize = portrait(letter)

        doc = SimpleDocTemplate(
            buffer,
            pagesize=pagesize,
            leftMargin=MARGIN_SIZE,
            rightMargin=MARGIN_SIZE,
            topMargin=MARGIN_SIZE,
            bottomMargin=MARGIN_SIZE,
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
        layout = self._get_card_layout(card.size)
        padding = layout["padding"]

        tbl_data: List[List] = []
        free_cells = []

        for row_idx, row in enumerate(card.grid):
            tbl_row = []
            for col_idx, cell in enumerate(row):
                if cell == "FREE":
                    free_style = ParagraphStyle(
                        "CenteredFree",
                        parent=self.styles["Heading2"],
                        alignment=TA_CENTER,
                    )
                    p = Paragraph("FREE", free_style)
                    tbl_row.append(p)
                    free_cells.append((col_idx, row_idx))
                    continue

                if isinstance(cell, Species):
                    flow = self._create_cell_content(
                        cell, photo_on, common_on, sci_on, layout
                    )
                    tbl_row.append(flow)
                else:
                    tbl_row.append([])

            tbl_data.append(tbl_row)

        col_widths = [layout["cell_width"]] * card.size
        row_heights = [layout["cell_height"]] * card.size

        table = Table(
            tbl_data,
            colWidths=col_widths,
            rowHeights=row_heights,
            repeatRows=0,
            hAlign="CENTER",
        )
        style_commands = [
            ("GRID", (0, 0), (-1, -1), 0.75, colors.grey),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("LEFTPADDING", (0, 0), (-1, -1), padding),
            ("RIGHTPADDING", (0, 0), (-1, -1), padding),
            ("TOPPADDING", (0, 0), (-1, -1), padding),
            ("BOTTOMPADDING", (0, 0), (-1, -1), padding),
        ]
        free_cell_styles = []
        for cell in free_cells:
            free_cell_styles.append(("VALIGN", cell, cell, "MIDDLE"))
        style_commands.extend(free_cell_styles)
        table.setStyle(TableStyle(style_commands))

        return table

    def _get_card_layout(self, grid_size: int) -> dict[str, float]:
        """Return page-derived cell dimensions and type settings."""
        style = GRID_CELL_STYLES.get(grid_size, GRID_CELL_STYLES[5])
        cell_width = USABLE_WIDTH / grid_size
        cell_height = GRID_AREA_HEIGHT / grid_size
        gap = max(2, min(4, cell_width * 0.02))

        return {
            "cell_width": cell_width,
            "cell_height": cell_height,
            "padding": style["padding"],
            "text_size": style["text_size"],
            "gap": gap,
        }

    def _build_name_parts(
        self, species: Species, common_on: bool, sci_on: bool
    ) -> List[str]:
        """Build the enabled common and scientific name fragments."""
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

        return name_parts

    def _create_text_style(self, text_size: float) -> ParagraphStyle:
        """Create the compact species label style."""
        return ParagraphStyle(
            f"CompactText{text_size}",
            parent=self.styles["BodyText"],
            fontSize=text_size,
            leading=text_size + 1,
            alignment=TA_CENTER,
            spaceAfter=0,
            spaceBefore=0,
        )

    def _calculate_text_height(
        self,
        species: Species,
        common_on: bool,
        sci_on: bool,
        text_size: float,
        cell_width: float,
    ) -> float:
        """Calculate required height for species text content."""
        name_parts = self._build_name_parts(species, common_on, sci_on)
        if not name_parts:
            return 0

        compact_style = self._create_text_style(text_size)
        text_content = "<br/>".join(name_parts)
        p = Paragraph(text_content, compact_style)

        _, h = p.wrap(cell_width, 200)
        return float(h)

    def _calculate_photo_size(
        self,
        species: Species,
        common_on: bool,
        sci_on: bool,
        layout: dict[str, float],
    ) -> float:
        """Calculate the largest square photo that leaves room for labels."""
        padding = layout["padding"]
        content_width = max(0, layout["cell_width"] - (2 * padding))
        content_height = max(0, layout["cell_height"] - (2 * padding))
        text_height = self._calculate_text_height(
            species,
            common_on,
            sci_on,
            layout["text_size"],
            content_width,
        )
        gap = layout["gap"] if text_height > 0 else 0

        return max(0, min(content_width, content_height - text_height - gap))

    def _create_cell_content(
        self,
        species: Species,
        photo_on: bool,
        common_on: bool,
        sci_on: bool,
        layout: dict[str, float],
    ) -> List:
        """Create the content for a single bingo card cell."""
        flow = []
        name_parts = self._build_name_parts(species, common_on, sci_on)
        text_content = "<br/>".join(name_parts)
        compact_style = self._create_text_style(layout["text_size"])
        image_added = False

        if photo_on and species.image_url:
            photo_size = self._calculate_photo_size(
                species=species,
                common_on=common_on,
                sci_on=sci_on,
                layout=layout,
            )
            try:
                img_bytes = requests.get(
                    species.image_url, timeout=self.timeout
                ).content
                cropped_bytes = process_image_for_bingo(img_bytes)

                img = Image(io.BytesIO(cropped_bytes))
                if photo_size > 0:
                    img.drawWidth = photo_size
                    img.drawHeight = photo_size
                    img.hAlign = "CENTER"
                    flow.append(img)
                    image_added = True
            except Exception:
                pass

        if name_parts:
            if image_added:
                flow.append(Spacer(1, layout["gap"]))
            flow.append(Paragraph(text_content, compact_style))

        return flow
