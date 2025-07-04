"""Streamlit UI components for the iNaturalist Bingo App."""

from __future__ import annotations

from typing import Any, List

import streamlit as st

from bingo_generator import BingoGenerator
from inaturalist_client import INaturalistClient
from pdf_renderer import PDFRenderer


class BingoApp:
    """Main application class for the Streamlit UI."""

    def __init__(self) -> None:
        """Initialize the application."""
        self.client = INaturalistClient()
        self.renderer = PDFRenderer()

    def run(self) -> None:
        """Run the main application."""
        st.set_page_config(
            page_title="iNat Bingo Generator", page_icon="🦉", layout="centered"
        )
        st.title("iNaturalist Bingo Card Generator")

        # Get user input
        form_data = self._render_form()

        if form_data:
            self._process_form_data(form_data)

    def _render_form(self) -> dict | None:
        """Render the input form and return form data if submitted."""
        # Time filtering options (outside form for dynamic updates)
        st.subheader("Time Filtering")
        time_filter_enabled = st.checkbox("Filter by months", value=False)
        selected_months = []
        if time_filter_enabled:
            month_names = [
                "January",
                "February",
                "March",
                "April",
                "May",
                "June",
                "July",
                "August",
                "September",
                "October",
                "November",
                "December",
            ]
            selected_months = st.multiselect(
                "Select months to include",
                options=list(range(1, 13)),
                format_func=lambda x: month_names[x - 1],
                help="Species will be filtered to only include observations "
                "from these months",
            )

        with st.form("controls"):
            place_query = st.text_input("iNaturalist place (name or ID)")
            grid_size = st.radio(
                "Card size", options=[3, 5], format_func=lambda x: f"{x} × {x}"
            )
            top_n = st.slider(
                "Species pool size (Top‑N)",
                min_value=10,
                max_value=100,
                value=25,
                step=5,
            )
            num_cards = st.number_input(
                "Number of cards", min_value=1, max_value=100, value=10
            )
            seed = st.number_input("Random seed (optional)", value=0)
            free_square = st.checkbox("Include centre FREE square (5×5 only)")

            photo_on = st.checkbox("Display photo", value=True)
            common_on = st.checkbox("Display common name", value=True)
            sci_on = st.checkbox("Display scientific name", value=True)
            title = st.text_input(
                "Document title", value="Bingo: Field Trip Edition"
            )
            submitted = st.form_submit_button("Generate 🎉")

        if submitted:
            return {
                "place_query": place_query,
                "grid_size": grid_size,
                "top_n": top_n,
                "num_cards": int(num_cards),
                "seed": seed if seed else None,
                "free_square": free_square,
                "photo_on": photo_on,
                "common_on": common_on,
                "sci_on": sci_on,
                "title": title,
                "selected_months": (
                    selected_months if time_filter_enabled else None
                ),
            }

        return None

    def _process_form_data(self, form_data: dict) -> None:
        """Process the submitted form data and generate bingo cards."""
        # Validate place query
        if not form_data["place_query"]:
            st.error("Please enter a place name or ID.")
            return

        # Get place ID
        place_id = self._get_place_id(form_data["place_query"])
        if not place_id:
            st.error("Place not found on iNaturalist.")
            return

        # Fetch species data
        species_pool = self._fetch_species_data(
            place_id, form_data["top_n"], form_data["selected_months"]
        )
        if not species_pool:
            return

        # Validate species pool size
        if len(species_pool) < (form_data["grid_size"] ** 2):
            st.error(
                "Not enough species observations to fill the requested "
                "card size."
            )
            return

        # Generate cards
        cards = self._generate_cards(species_pool, form_data)

        # Render PDF
        pdf_bytes = self._render_pdf(cards, form_data)

        # Provide download
        st.success("Done!")
        st.download_button(
            label="Download bingo cards (PDF)",
            data=pdf_bytes,
            file_name="inat_bingo_cards.pdf",
            mime="application/pdf",
        )

    def _get_place_id(self, place_query: str) -> int | None:
        """Get the place ID from the query string."""
        if place_query.isdigit():
            return int(place_query)
        else:
            return self.client.lookup_place_id(place_query)

    def _fetch_species_data(
        self,
        place_id: int,
        top_n: int,
        selected_months: List[int] | None,
    ) -> List[Any] | None:
        """Fetch species data from iNaturalist."""
        with st.spinner("Fetching species list from iNaturalist…"):
            try:
                return self.client.fetch_top_species(
                    place_id, top_n, selected_months
                )
            except Exception as e:
                st.error(f"Error fetching species data: {e}")
                return None

    def _generate_cards(self, species_pool: List[Any], form_data: dict) -> List[Any]:
        """Generate bingo cards from species data."""
        generator = BingoGenerator(species_pool)
        return generator.generate_cards(
            num_cards=form_data["num_cards"],
            grid_size=form_data["grid_size"],
            free_square=form_data["free_square"],
            base_seed=form_data["seed"],
        )

    def _render_pdf(self, cards: List[Any], form_data: dict) -> bytes:
        """Render cards to PDF."""
        with st.spinner("Rendering PDF…"):
            return self.renderer.render_cards(
                cards=cards,
                photo_on=form_data["photo_on"],
                common_on=form_data["common_on"],
                sci_on=form_data["sci_on"],
                title=form_data["title"],
            )
