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
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.styles import ParagraphStyle

from config import CELL_PADDING, PHOTO_SIZE, API_TIMEOUT, GRID_SCALING, USABLE_HEIGHT
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

        # Use portrait orientation for all sizes - dynamic scaling handles fit
        grid_size = cards[0].size if cards else 5
        pagesize = portrait(letter)

        doc = SimpleDocTemplate(
            buffer,
            pagesize=pagesize,
            leftMargin=0.5 * inch,
            rightMargin=0.5 * inch,
            topMargin=0.5 * inch,
            bottomMargin=0.5 * inch,
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
        # Get dynamic scaling for this grid size
        scaling = GRID_SCALING.get(card.size, GRID_SCALING[5])
        cell_size = scaling["cell_size"]
        padding = scaling["padding"]
        
        tbl_data: List[List] = []

        for row in card.grid:
            tbl_row = []
            for cell in row:
                if cell == "FREE":
                    # Create centered style for FREE text
                    free_style = ParagraphStyle(
                        'CenteredFree',
                        parent=self.styles["Heading2"],
                        alignment=TA_CENTER,
                    )
                    p = Paragraph("FREE", free_style)
                    tbl_row.append(p)
                    continue

                if isinstance(cell, Species):
                    flow = self._create_cell_content(cell, photo_on, common_on, sci_on, card.size)
                    tbl_row.append(flow)
                else:
                    tbl_row.append([])

            tbl_data.append(tbl_row)

        # Set cell sizes - uniform width, dynamic height
        col_widths = [cell_size] * card.size
        row_heights = self._calculate_dynamic_row_heights(card, photo_on, common_on, sci_on, card.size)

        table = Table(tbl_data, colWidths=col_widths, rowHeights=row_heights, repeatRows=0, hAlign="CENTER")
        table.setStyle(
            TableStyle(
                [
                    ("GRID", (0, 0), (-1, -1), 0.75, colors.grey),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                    ("LEFTPADDING", (0, 0), (-1, -1), padding),
                    ("RIGHTPADDING", (0, 0), (-1, -1), padding),
                    ("TOPPADDING", (0, 0), (-1, -1), padding),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), padding),
                ]
            )
        )

        return table

    def _calculate_text_height(self, species: Species, common_on: bool, sci_on: bool, text_size: int, cell_width: float) -> float:
        """Calculate required height for species text content."""
        if not (common_on or sci_on):
            return 0
        
        # Build text content same as in _create_cell_content
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
        
        if not name_parts:
            return 0
        
        # Create the same style as used in _create_cell_content
        compact_style = ParagraphStyle(
            'CompactText',
            parent=self.styles["BodyText"],
            fontSize=text_size,
            leading=text_size + 1,
            alignment=TA_CENTER,
            spaceAfter=0,
            spaceBefore=0,
        )
        
        # Create paragraph and measure it
        text_content = "<br/>".join(name_parts)
        p = Paragraph(text_content, compact_style)
        
        # Calculate required height for the given width
        # Use wrap method to get required dimensions
        w, h = p.wrap(cell_width, 200)  # 200 is max height for calculation
        return h

    def _calculate_dynamic_row_heights(self, card: BingoCard, photo_on: bool, common_on: bool, sci_on: bool, grid_size: int) -> List[float]:
        """Calculate dynamic row heights based on content."""
        scaling = GRID_SCALING.get(grid_size, GRID_SCALING[5])
        cell_size = scaling["cell_size"]
        photo_size = scaling["photo_size"]
        text_size = scaling["text_size"]
        padding = scaling["padding"]
        
        # Calculate available width for text (cell width minus padding)
        text_width = cell_size - (2 * padding)
        
        row_heights = []
        
        for row in card.grid:
            max_height_in_row = cell_size  # Start with minimum cell size
            
            for cell in row:
                if cell == "FREE":
                    # FREE cells just need space for the heading
                    continue
                elif isinstance(cell, Species):
                    # Calculate required height for this species
                    text_height = self._calculate_text_height(cell, common_on, sci_on, text_size, text_width)
                    
                    # Total height = photo height + text height + padding
                    total_height = photo_size + text_height + (2 * padding)
                    if photo_on and text_height > 0:
                        total_height += 4  # Small gap between photo and text
                    
                    max_height_in_row = max(max_height_in_row, total_height)
            
            row_heights.append(max_height_in_row)
        
        # Check if total height exceeds page limit
        total_height = sum(row_heights)
        title_space = 0.7 * inch  # Approximate space for title and spacing
        available_height = USABLE_HEIGHT - title_space
        
        if total_height > available_height:
            # Scale down proportionally to fit on page
            scale_factor = available_height / total_height
            row_heights = [h * scale_factor for h in row_heights]
        
        return row_heights

    def _create_cell_content(
        self,
        species: Species,
        photo_on: bool,
        common_on: bool,
        sci_on: bool,
        grid_size: int,
    ) -> List:
        """Create the content for a single bingo card cell."""
        # Get dynamic scaling for this grid size
        scaling = GRID_SCALING.get(grid_size, GRID_SCALING[5])
        photo_size = scaling["photo_size"]
        text_size = scaling["text_size"]
        
        flow = []

        # Add photo if enabled and available
        if photo_on and species.image_url:
            try:
                # Download the image
                img_bytes = requests.get(
                    species.image_url, timeout=self.timeout
                ).content
                
                # Process image (center crop to square)
                cropped_bytes = process_image_for_bingo(img_bytes)
                
                # Create ReportLab Image object
                img = Image(io.BytesIO(cropped_bytes))
                img._restrictSize(photo_size, photo_size)
                flow.append(img)
            except Exception:
                pass  # Skip image if download or processing fails

        # Add names with compact styling
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
            # Create a compact text style for smaller grids
            compact_style = ParagraphStyle(
                'CompactText',
                parent=self.styles["BodyText"],
                fontSize=text_size,
                leading=text_size + 1,
                alignment=TA_CENTER,
                spaceAfter=0,
                spaceBefore=0,
            )
            text_content = "<br/>".join(name_parts)
            flow.append(Paragraph(text_content, compact_style))

        return flow
