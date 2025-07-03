"""iNaturalist API client for fetching species data."""

from __future__ import annotations

from typing import List

import requests
import streamlit as st
from pyinaturalist import get_observations

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
    def fetch_top_species(_self, place_id: int, top_n: int) -> List[Species]:
        """Return a list of top‑N species for the given place.

        Filters to research‑grade observations at species level or below,
        and to allowed photo licenses.
        """
        page = 1
        species: List[Species] = []

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
                # The API returns observations, and each observation has a
                # "taxon" field
                if "taxon" not in taxon or taxon["taxon"] is None:
                    continue

                taxon_data = taxon["taxon"]
                rank_level = taxon_data.get("rank_level")
                if not rank_level or rank_level not in SPECIES_RANK_LEVELS:
                    continue

                default_photo = taxon_data.get("default_photo") or {}
                license_code = default_photo.get("license_code")
                if (
                    license_code
                    and license_code.lower() not in ALLOWED_LICENSES
                ):
                    continue

                image_url = default_photo.get("medium_url", "")
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

                if len(species) >= top_n:
                    break

            page += 1

        return species[:top_n]
