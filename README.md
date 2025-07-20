# iNaturalist Bingo App

A Streamlit web application that generates educational bingo cards using real species observation data from iNaturalist. Create customizable PDF bingo cards featuring local wildlife species with photos, common names, and scientific names - perfect for nature education, field trips, and outdoor activities.

🌐 **Live App**: <https://inaturalist-bingo.streamlit.app/>

## Features

- **Real Species Data**: Fetches research-grade species observations from iNaturalist for any geographic location
- **Flexible Grid Sizes**: Support for 3×3, 5×5, 7×7, and 9×9 bingo card layouts
- **Customizable Content**: Toggle display of photos, common names, and scientific names independently
- **Batch Generation**: Create multiple unique cards (1-100) with different species combinations
- **Seasonal Filtering**: Filter species by specific months for seasonal activities
- **Professional PDFs**: Generate print-ready PDFs with optimized layouts and high-quality images
- **No API Keys Required**: Uses public iNaturalist API with no registration needed

## How It Works

1. **Find Your Location**: 
   - Go to [iNaturalist Places](https://www.inaturalist.org/places)
   - Search for your desired location (e.g., "California")
   - Copy the place ID from the URL (e.g., `california-us` from `https://www.inaturalist.org/places/california-us`)
   - Alternatively, you can try entering a place name directly and the app will attempt to find it
2. **Configure Your Cards**: Choose grid size, number of species, and display options
3. **Generate**: Create 1-100 unique bingo cards with different species combinations
4. **Download**: Get a PDF file ready for printing and use in the field

## Local Development

### Prerequisites

- Python 3.9 or higher

### Installation with uv (Recommended)

```bash
# Clone the repository
git clone https://github.com/yourusername/iNaturalist-Bingo-App.git
cd iNaturalist-Bingo-App

# Install dependencies
uv sync

# Run the application
streamlit run main.py
```

### Installation with pip

```bash
# Clone the repository
git clone https://github.com/yourusername/iNaturalist-Bingo-App.git
cd iNaturalist-Bingo-App

# Create a virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install streamlit requests pyinaturalist reportlab pillow

# Run the application
streamlit run main.py
```

### Development Commands

```bash
# Install development dependencies (uv only)
uv sync

# Run tests
pytest

# Format code
black .

# Lint code
flake8

# Type checking
mypy main.py
```

## Architecture

The application is built with a modular architecture:

- **`main.py`**: Application entry point
- **`ui.py`**: Streamlit user interface components
- **`inaturalist_client.py`**: iNaturalist API integration
- **`bingo_generator.py`**: Bingo card generation logic
- **`pdf_renderer.py`**: PDF creation using ReportLab
- **`image_processor.py`**: Image processing and optimization
- **`models.py`**: Data structures and type definitions
- **`config.py`**: Application configuration and settings

## Contributing

This project was built for personal use, but contributions are welcome! Feel free to:

- Fork the repository and make your own modifications
- Submit issues for bugs or feature requests
- Create pull requests for improvements

Please note that I built this for my own needs and make no promises about implementing requested features, but I'm happy to review contributions from the community.

## License

This project is released under the MIT License. You are free to copy, modify, distribute, and use this code for any purpose, commercial or non-commercial, with no restrictions.

## Acknowledgments

- **iNaturalist**: For providing the incredible species observation database and API
- **Streamlit**: For the excellent web app framework
- **ReportLab**: For PDF generation capabilities
- **The iNaturalist Community**: For contributing millions of species observations that make this app possible