"""Deprecated Streamlit entry point for iNaturalist Bingo."""

from __future__ import annotations

import streamlit as st

STATIC_APP_URL = "https://kylenessen.github.io/iNaturalist-Bingo-App/"
LOCAL_STATIC_APP_URL = "http://127.0.0.1:8765"


def main() -> None:
    """Show a migration notice for users who open the old Streamlit app."""
    st.set_page_config(page_title="iNaturalist Bingo has moved")
    st.title("iNaturalist Bingo has moved")
    st.write(
        "The Streamlit version is deprecated. The current app is a "
        "client-side JavaScript app that runs from the static site."
    )
    st.link_button("Open the current app", STATIC_APP_URL)
    st.caption(
        "For local development, run the static app from the docs folder and "
        f"open {LOCAL_STATIC_APP_URL}."
    )


if __name__ == "__main__":
    main()
