"""iNaturalist API client for fetching species data."""

from __future__ import annotations

from typing import List

import requests
import streamlit as st

from config import (
    ALLOWED_LICENSES,
    SPECIES_RANK_LEVELS,
    API_TIMEOUT,
    CACHE_TTL,
)
from models import Species


class INaturalistClient:
    """Client for interacting with the iNaturalist API."""

    def __init__(self) -> None:
        """Initialize the API client."""
        self.timeout = API_TIMEOUT

    def lookup_place_id(self, place_query: str) -> int | None:
        """Return an iNaturalist place_id for the given text query.

        Uses the /places/autocomplete endpoint.
        """
        try:
            resp = requests.get(
                "https://api.inaturalist.org/v1/places/autocomplete",
                params={"q": place_query, "per_page": 1},
                timeout=self.timeout,
            )
            resp.raise_for_status()
            results = resp.json().get("results", [])
            return results[0]["id"] if results else None
        except requests.RequestException:
            return None

    @st.cache_data(show_spinner=False, ttl=CACHE_TTL)
    def fetch_top_species(
        _self,
        place_id: int,
        top_n: int,
        selected_months: List[int] | None = None,
    ) -> List[Species]:
        """Return a list of top‑N species for the given place.

        Filters to research‑grade observations at species level or below,
        and to allowed photo licenses. Optionally filters by months.

        Args:
            place_id: iNaturalist place ID
            top_n: Number of top species to return
            selected_months: List of month numbers (1-12) to filter by,
                or None for all months
        """
        try:
            # Use species_counts endpoint for proper geographic aggregation
            params = {
                "place_id": place_id,
                "verifiable": "true",
                "quality_grade": "research",
                "geo": "true",  # Ensure observations are within place boundaries
                "per_page": min(
                    top_n * 3, 500
                ),  # Get extra to account for filtering
            }

            # Add month filtering if specified
            if selected_months:
                params["month"] = ",".join(map(str, selected_months))

            resp = requests.get(
                "https://api.inaturalist.org/v1/observations/species_counts",
                params=params,
                timeout=_self.timeout,
            )
            resp.raise_for_status()
            results = resp.json().get("results", [])
        except requests.RequestException:
            return []

        species: List[Species] = []

        for result in results:
            if len(species) >= top_n:
                break

            if "taxon" not in result or result["taxon"] is None:
                continue

            taxon_data = result["taxon"]
            rank_level = taxon_data.get("rank_level")
            if not rank_level or rank_level not in SPECIES_RANK_LEVELS:
                continue

            default_photo = taxon_data.get("default_photo") or {}
            license_code = default_photo.get("license_code")
            if license_code and license_code.lower() not in ALLOWED_LICENSES:
                continue

            image_url = default_photo.get("square_url") or default_photo.get("medium_url", "")
            common_name = taxon_data.get("preferred_common_name") or ""
            scientific_name = taxon_data.get("name") or ""

            species.append(
                Species(
                    taxon_id=taxon_data["id"],
                    common_name=common_name,
                    scientific_name=scientific_name,
                    image_url=image_url,
                )
            )

        return species[:top_n]
