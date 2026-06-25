"""Streamlit redirect for the old iNaturalist Bingo link."""

from __future__ import annotations

import streamlit as st

STATIC_APP_URL = "https://kylenessen.github.io/iNaturalist-Bingo-App/"

BUTTON_STYLES = """
<style>
.main .block-container {
    max-width: 860px;
    padding-top: 8rem;
}

.migration-message {
    font-size: 1.25rem;
    line-height: 1.6;
    margin: 1.25rem 0 2rem;
}

.current-app-action {
    display: flex;
    justify-content: center;
    width: 100%;
}

.current-app-button {
    align-items: center;
    background: #ff4b4b;
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-radius: 0.75rem;
    color: #ffffff !important;
    display: inline-flex;
    font-size: 1.4rem;
    font-weight: 800;
    justify-content: center;
    min-height: 4.5rem;
    padding: 1rem 2.5rem;
    text-align: center;
    text-decoration: none !important;
    width: min(100%, 34rem);
}

.current-app-button:hover {
    background: #ff6b6b;
    color: #ffffff !important;
    text-decoration: none !important;
}

@media (max-width: 640px) {
    .main .block-container {
        padding-top: 4rem;
    }

    .current-app-button {
        font-size: 1.2rem;
        min-height: 4rem;
        padding: 0.95rem 1.25rem;
    }
}
</style>
"""


def main() -> None:
    """Show a migration notice for users who open the old Streamlit app."""
    st.set_page_config(page_title="iNaturalist Bingo has moved")
    st.markdown(BUTTON_STYLES, unsafe_allow_html=True)
    st.title("iNaturalist Bingo has moved")
    st.markdown(
        """
        <p class="migration-message">
            The Streamlit app has moved. Please click the button below to go
            to the current version.
        </p>
        """,
        unsafe_allow_html=True,
    )
    st.markdown(
        f"""
        <div class="current-app-action">
            <a
                class="current-app-button"
                href="{STATIC_APP_URL}"
                target="_self"
            >
                Open the current app
            </a>
        </div>
        """,
        unsafe_allow_html=True,
    )


if __name__ == "__main__":
    main()
