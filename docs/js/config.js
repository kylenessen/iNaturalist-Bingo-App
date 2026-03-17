/**
 * Configuration constants for the iNaturalist Bingo App.
 * Ported from Python config.py
 */

// Species rank levels: species (10) through variety (15)
export const SPECIES_RANK_LEVELS = new Set([10, 11, 12, 13, 14, 15]);

// Grid scaling factors by grid size (CSS-friendly units for preview, inch-based for PDF)
export const GRID_SCALING = {
  3: { cellSize: 2.3, photoSize: 1.8, padding: 4, textSize: 10 },
  5: { cellSize: 1.4, photoSize: 1.1, padding: 3, textSize: 8 },
  7: { cellSize: 1.0, photoSize: 0.8, padding: 2, textSize: 7 },
  9: { cellSize: 0.8, photoSize: 0.6, padding: 1, textSize: 6 },
};

// Page layout constants (inches)
export const PAGE = {
  width: 8.5,
  height: 11,
  margin: 0.5,
};

// Iconic taxa mapping
export const ICONIC_TAXA = {
  Aves: "Birds",
  Mammalia: "Mammals",
  Plantae: "Plants",
  Insecta: "Insects",
  Reptilia: "Reptiles",
  Amphibia: "Amphibians",
  Actinopterygii: "Ray-finned Fish",
  Mollusca: "Mollusks",
  Arachnida: "Spiders & Arachnids",
  Fungi: "Fungi",
};

// Month names
export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// API settings
export const API_BASE = "https://api.inaturalist.org/v1";
export const DEBOUNCE_MS = 300;
