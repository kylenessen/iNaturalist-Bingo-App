"""Deprecated Streamlit UI wrapper for iNaturalist Bingo."""

from __future__ import annotations

import streamlit as st

STATIC_APP_URL = "https://kylenessen.github.io/iNaturalist-Bingo-App/"
LOCAL_STATIC_APP_URL = "http://127.0.0.1:8765"


class BingoApp:
    """Compatibility wrapper for the deprecated Streamlit app."""

    def run(self) -> None:
        """Show a migration notice instead of the old generator UI."""
        st.set_page_config(page_title="iNaturalist Bingo has moved")
        st.title("iNaturalist Bingo has moved")
        st.write(
            "The Streamlit version is deprecated. The current app is a "
            "client-side JavaScript app served from GitHub Pages."
        )
        st.link_button("Open the current app", STATIC_APP_URL)
        st.caption(
            "For local development, run the static app from the docs folder "
            f"and open {LOCAL_STATIC_APP_URL}."
        )
