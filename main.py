"""iNaturalist Bingo Card Generator - Main Application Entry Point.

A Streamlit application to generate bingo cards from iNaturalist observation
data.

MVP features implemented:
- Fetch top‑N research‑grade species (incl. sub‑species/varieties) for a
  given iNaturalist place
- Build 3 × 3 or 5 × 5 bingo grids, with optional centre "Free" square
- Render multiple cards into a single PDF using ReportLab Platypus
- Deliver PDF via st.download_button

Future work (ignored for MVP):
- Instructor branding / logos
- Attribution legend page
- Editable DOCX output
- Custom species lists
"""

from __future__ import annotations

from ui import BingoApp


def main() -> None:
    """Main application entry point."""
    app = BingoApp()
    app.run()


if __name__ == "__main__":
    main()
