# inat_bingo_app.py
"""Streamlit application to generate bingo cards from iNaturalist observation data.

MVP features implemented:
- Fetch top‑N research‑grade species (incl. sub‑species/varieties) for a given iNaturalist place
- Build 3 × 3 or 5 × 5 bingo grids, with optional centre "Free" square
- Render multiple cards into a single PDF using ReportLab Platypus
- Deliver PDF via st.download_button

Future work (ignored for MVP):
- Instructor branding / logos
- Attribution legend page
- Editable DOCX output
- Custom species lists
"""

from __future__ import annotations

import io
import random
from typing import List, Tuple

import requests
import streamlit as st
from pyinaturalist import get_observations
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, landscape, portrait
from reportlab.lib.styles import getSampleStyleSheet
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

# -----------------------------------------------------------------------------
# Constants & helpers
# -----------------------------------------------------------------------------

ALLOWED_LICENSES = {
    "cc0",
    "cc-by",
    "cc-by-nc",
    "cc-by-sa",
    "cc-by-nc-sa",
}

SPECIES_RANK_LEVELS = set(range(10, 16))  # species (10) through variety (15)

CELL_PADDING = 4  # pts
PHOTO_SIZE = 1.4 * inch  # will be scaled proportionally

styles = getSampleStyleSheet()


def _lookup_place_id(place_query: str) -> int | None:
    """Return an iNaturalist place_id for the given text query using the /places/autocomplete endpoint."""
    resp = requests.get(
        "https://api.inaturalist.org/v1/places/autocomplete",
        params={"q": place_query, "per_page": 1},
        timeout=10,
    )
    results = resp.json().get("results", [])
    return results[0]["id"] if results else None


@st.cache_data(show_spinner=False, ttl=60 * 60 * 12)
def fetch_top_species(place_id: int, top_n: int) -> List[Tuple[int, str, str, str]]:
    """Return a list of top‑N species in (taxon_id, common_name, scientific_name, image_url) order.
    Filters to research‑grade observations at species level or below, and to allowed photo licenses."""
    page = 1
    species: List[Tuple[int, str, str, str]] = []
    while len(species) < top_n:
        resp = get_observations(
            params={
                "place_id": place_id,
                "verifiable": "true",
                "quality_grade": "research",
                "rank": "species",
                "page": page,
                "per_page": 200,
                "order_by": "observations_count",
            }
        )
        if not resp["results"]:
            break
        for taxon in resp["results"]:
            # The API returns observations, and each observation has a "taxon" field
            if "taxon" not in taxon or taxon["taxon"] is None:
                continue
            
            taxon_data = taxon["taxon"]
            rank_level = taxon_data.get("rank_level")
            if not rank_level or rank_level not in SPECIES_RANK_LEVELS:
                continue
            default_photo = taxon_data.get("default_photo") or {}
            license_code = default_photo.get("license_code")
            if license_code and license_code.lower() not in ALLOWED_LICENSES:
                continue
            image_url = default_photo.get("medium_url", "")
            common_name = taxon_data.get("preferred_common_name") or ""
            scientific_name = taxon_data.get("name")
            species.append((taxon_data["id"], common_name, scientific_name, image_url))
            if len(species) >= top_n:
                break
        page += 1
    return species[:top_n]


def _build_grid(species_list: List[Tuple[int, str, str, str]], grid_size: int, free_square: bool, seed: int | None) -> List[List[Tuple[int, str, str, str] | str]]:
    """Return a grid_size×grid_size matrix to feed to PDF renderer.
    If *free_square* is True and grid_size==5, the centre cell gets the string "FREE"."""
    rnd = random.Random(seed)
    shuffled = species_list.copy()
    rnd.shuffle(shuffled)
    needed = grid_size ** 2 - (1 if free_square and grid_size == 5 else 0)
    cells = shuffled[:needed]
    grid: List[List[Tuple[int, str, str, str] | str]] = []
    idx = 0
    for r in range(grid_size):
        row: List[Tuple[int, str, str, str] | str] = []
        for c in range(grid_size):
            if free_square and grid_size == 5 and r == c == grid_size // 2:
                row.append("FREE")
            else:
                row.append(cells[idx])
                idx += 1
        grid.append(row)
    return grid


def _make_cell(flowables: List, photo_on: bool, common_on: bool, sci_on: bool) -> List:
    """Utility to apply consistent table style."""
    return flowables  # stub for now; could enforce padding elsewhere


def render_pdf(
    cards: List[List[List[Tuple[int, str, str, str] | str]]],
    grid_size: int,
    photo_on: bool,
    common_on: bool,
    sci_on: bool,
    title: str,
) -> bytes:
    buffer = io.BytesIO()

    # Page orientation: landscape for 5×5 with photos, else portrait
    pagesize = landscape(letter) if grid_size == 5 and photo_on else portrait(letter)
    doc = SimpleDocTemplate(buffer, pagesize=pagesize, leftMargin=inch, rightMargin=inch, topMargin=inch, bottomMargin=inch)

    elements = []
    for card_idx, grid in enumerate(cards):
        if card_idx > 0:
            elements.append(PageBreak())
        elements.append(Paragraph(title, styles["Title"]))
        elements.append(Spacer(1, 0.2 * inch))

        tbl_data: List[List] = []
        for row in grid:
            tbl_row = []
            for cell in row:
                if cell == "FREE":
                    p = Paragraph("FREE", styles["Heading2"])
                    tbl_row.append(p)
                    continue
                taxon_id, common, sci, img_url = cell  # type: ignore
                flow: List = []
                if photo_on and img_url:
                    # Download image and scale proportionally within PHOTO_SIZE
                    try:
                        img_bytes = requests.get(img_url, timeout=10).content
                        img = Image(io.BytesIO(img_bytes))
                        img._restrictSize(PHOTO_SIZE, PHOTO_SIZE)
                        flow.append(img)
                    except Exception:
                        pass
                name_parts = []
                if common_on and common:
                    name_parts.append(common)
                if sci_on and sci:
                    sci_html = f"<i>{sci}</i>" if common_on else sci
                    name_parts.append(sci_html)
                if name_parts:
                    flow.append(Paragraph("<br/>".join(name_parts), styles["BodyText"]))
                tbl_row.append(flow)
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
        elements.append(table)

    doc.build(elements)
    return buffer.getvalue()


# -----------------------------------------------------------------------------
# Streamlit UI
# -----------------------------------------------------------------------------

def main() -> None:
    st.set_page_config(page_title="iNat Bingo Generator", page_icon="🦉", layout="centered")
    st.title("iNaturalist Bingo Card Generator")

    with st.form("controls"):
        place_query = st.text_input("iNaturalist place (name or ID)")
        grid_size = st.radio("Card size", options=[3, 5], format_func=lambda x: f"{x} × {x}")
        top_n = st.slider("Species pool size (Top‑N)", min_value=10, max_value=100, value=25, step=5)
        num_cards = st.number_input("Number of cards", min_value=1, max_value=100, value=10)
        seed = st.number_input("Random seed (optional)", value=0)
        free_square = st.checkbox("Include centre FREE square (5×5 only)")
        photo_on = st.checkbox("Display photo", value=True)
        common_on = st.checkbox("Display common name", value=True)
        sci_on = st.checkbox("Display scientific name", value=True)
        title = st.text_input("Document title", value="Bingo: Field Trip Edition")
        submitted = st.form_submit_button("Generate 🎉")

    if submitted:
        if not place_query:
            st.error("Please enter a place name or ID.")
            st.stop()
        place_id = int(place_query) if place_query.isdigit() else _lookup_place_id(place_query)
        if not place_id:
            st.error("Place not found on iNaturalist.")
            st.stop()

        with st.spinner("Fetching species list from iNaturalist…"):
            species_pool = fetch_top_species(place_id, top_n)
            if len(species_pool) < (grid_size ** 2):
                st.error("Not enough species observations to fill the requested card size.")
                st.stop()

        cards = []
        for i in range(int(num_cards)):
            card_grid = _build_grid(species_pool, grid_size, free_square, seed + i if seed else None)
            cards.append(card_grid)

        with st.spinner("Rendering PDF…"):
            pdf_bytes = render_pdf(cards, grid_size, photo_on, common_on, sci_on, title)
        st.success("Done!")
        st.download_button(
            label="Download bingo cards (PDF)",
            data=pdf_bytes,
            file_name="inat_bingo_cards.pdf",
            mime="application/pdf",
        )


if __name__ == "__main__":
    main()