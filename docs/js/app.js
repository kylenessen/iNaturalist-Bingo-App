/**
 * Main application module.
 * Wires up events, manages state, renders bingo card previews.
 */

import { searchPlaces, fetchTopSpecies } from "./api.js";
import { generateCards } from "./bingo.js";
import { generatePdf } from "./pdf.js";
import { ICONIC_TAXA, MONTH_NAMES, DEBOUNCE_MS } from "./config.js";

// ---- State ----
const state = {
  placeId: null,
  placeName: "",
  cards: [],       // Array of grids
  gridSize: 5,
  currentCard: 0,
  options: { photoOn: true, commonOn: true, sciOn: true },
};

// ---- DOM references ----
const $ = (sel) => document.querySelector(sel);
const placeInput = $("#place-input");
const placeDropdown = $("#place-dropdown");
const placeIdInput = $("#place-id");
const placeDisplay = $("#place-display");
const taxaEnabled = $("#taxa-filter-enabled");
const taxaWrapper = $("#taxa-select-wrapper");
const taxaCheckboxes = $("#taxa-checkboxes");
const monthEnabled = $("#month-filter-enabled");
const monthWrapper = $("#month-select-wrapper");
const monthCheckboxes = $("#month-checkboxes");
const gridSizeSelect = $("#grid-size");
const topNSlider = $("#top-n");
const topNValue = $("#top-n-value");
const numCardsInput = $("#num-cards");
const seedInput = $("#seed");
const freeSquareCheck = $("#free-square");
const photoOnCheck = $("#photo-on");
const commonOnCheck = $("#common-on");
const sciOnCheck = $("#sci-on");
const docTitleInput = $("#doc-title");
const generateBtn = $("#generate-btn");
const form = $("#bingo-form");
const statusEl = $("#status");
const errorEl = $("#error");
const previewSection = $("#preview-section");
const cardContainer = $("#card-container");
const prevBtn = $("#prev-card");
const nextBtn = $("#next-card");
const cardCounter = $("#card-counter");
const downloadBtn = $("#download-pdf");

// ---- Helpers ----
function showStatus(msg) {
  statusEl.textContent = msg;
  statusEl.classList.remove("hidden");
  errorEl.classList.add("hidden");
}

function showError(msg) {
  errorEl.textContent = msg;
  errorEl.classList.remove("hidden");
  statusEl.classList.add("hidden");
}

function hideMessages() {
  statusEl.classList.add("hidden");
  errorEl.classList.add("hidden");
}

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

// ---- Populate filter checkboxes ----
function initFilters() {
  // Taxa checkboxes
  for (const [key, label] of Object.entries(ICONIC_TAXA)) {
    const lbl = document.createElement("label");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = key;
    cb.name = "iconic-taxa";
    lbl.appendChild(cb);
    lbl.appendChild(document.createTextNode(" " + label));
    taxaCheckboxes.appendChild(lbl);
  }

  // Month checkboxes
  MONTH_NAMES.forEach((name, i) => {
    const lbl = document.createElement("label");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = String(i + 1);
    cb.name = "month";
    lbl.appendChild(cb);
    lbl.appendChild(document.createTextNode(" " + name));
    monthCheckboxes.appendChild(lbl);
  });
}

// ---- Place Type-Ahead ----
let dropdownIndex = -1;

async function handlePlaceInput(query) {
  if (!query || query.trim().length < 2) {
    placeDropdown.classList.add("hidden");
    return;
  }

  try {
    const results = await searchPlaces(query);
    renderDropdown(results);
  } catch {
    placeDropdown.classList.add("hidden");
  }
}

function renderDropdown(results) {
  placeDropdown.innerHTML = "";
  dropdownIndex = -1;

  if (results.length === 0) {
    placeDropdown.classList.add("hidden");
    return;
  }

  results.forEach((place) => {
    const li = document.createElement("li");
    li.textContent = place.displayName;
    li.dataset.id = place.id;
    li.addEventListener("mousedown", (e) => {
      e.preventDefault();
      selectPlace(place);
    });
    placeDropdown.appendChild(li);
  });

  placeDropdown.classList.remove("hidden");
}

function selectPlace(place) {
  state.placeId = place.id;
  state.placeName = place.displayName;
  placeInput.value = place.displayName;
  placeIdInput.value = place.id;
  placeDisplay.textContent = `Place ID: ${place.id}`;
  placeDropdown.classList.add("hidden");
}

placeInput.addEventListener("input", debounce((e) => handlePlaceInput(e.target.value), DEBOUNCE_MS));

placeInput.addEventListener("keydown", (e) => {
  const items = placeDropdown.querySelectorAll("li");
  if (!items.length) return;

  if (e.key === "ArrowDown") {
    e.preventDefault();
    dropdownIndex = Math.min(dropdownIndex + 1, items.length - 1);
    updateDropdownHighlight(items);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    dropdownIndex = Math.max(dropdownIndex - 1, 0);
    updateDropdownHighlight(items);
  } else if (e.key === "Enter" && dropdownIndex >= 0) {
    e.preventDefault();
    const li = items[dropdownIndex];
    selectPlace({ id: Number(li.dataset.id), displayName: li.textContent });
  } else if (e.key === "Escape") {
    placeDropdown.classList.add("hidden");
  }
});

function updateDropdownHighlight(items) {
  items.forEach((li, i) => li.classList.toggle("active", i === dropdownIndex));
}

placeInput.addEventListener("blur", () => {
  setTimeout(() => placeDropdown.classList.add("hidden"), 150);
});

// ---- Filter toggles ----
taxaEnabled.addEventListener("change", () => {
  taxaWrapper.classList.toggle("hidden", !taxaEnabled.checked);
});

monthEnabled.addEventListener("change", () => {
  monthWrapper.classList.toggle("hidden", !monthEnabled.checked);
});

// ---- Slider value display ----
topNSlider.addEventListener("input", () => {
  topNValue.textContent = topNSlider.value;
});

// ---- Display toggle handlers (re-render preview) ----
function onDisplayToggle() {
  state.options.photoOn = photoOnCheck.checked;
  state.options.commonOn = commonOnCheck.checked;
  state.options.sciOn = sciOnCheck.checked;
  if (state.cards.length > 0) renderCurrentCard();
}

photoOnCheck.addEventListener("change", onDisplayToggle);
commonOnCheck.addEventListener("change", onDisplayToggle);
sciOnCheck.addEventListener("change", onDisplayToggle);

// ---- Card Preview Rendering ----
function renderCurrentCard() {
  const grid = state.cards[state.currentCard];
  if (!grid) return;

  cardContainer.innerHTML = "";

  const cardEl = document.createElement("div");
  cardEl.className = `bingo-card grid-${state.gridSize}`;

  for (let r = 0; r < state.gridSize; r++) {
    for (let c = 0; c < state.gridSize; c++) {
      const cellData = grid[r][c];
      const cell = document.createElement("div");
      cell.className = "bingo-cell";

      if (cellData === "FREE") {
        cell.classList.add("free-cell");
        cell.textContent = "FREE";
      } else {
        if (state.options.photoOn && cellData.imageUrl) {
          const img = document.createElement("img");
          img.src = cellData.imageUrl;
          img.alt = cellData.commonName || cellData.scientificName;
          img.loading = "lazy";
          img.classList.add("loading");
          img.addEventListener("load", () => img.classList.remove("loading"));
          img.addEventListener("error", () => {
            img.style.display = "none";
          });
          cell.appendChild(img);
        }
        if (state.options.commonOn && cellData.commonName) {
          const span = document.createElement("span");
          span.className = "common-name";
          span.textContent = cellData.commonName;
          cell.appendChild(span);
        }
        if (state.options.sciOn && cellData.scientificName) {
          const span = document.createElement("span");
          span.className = "sci-name";
          span.textContent = cellData.scientificName;
          cell.appendChild(span);
        }
      }

      cardEl.appendChild(cell);
    }
  }

  cardContainer.appendChild(cardEl);
  updateNav();
}

function updateNav() {
  const total = state.cards.length;
  const idx = state.currentCard;
  cardCounter.textContent = `Card ${idx + 1} of ${total}`;
  prevBtn.disabled = idx === 0;
  nextBtn.disabled = idx >= total - 1;
}

prevBtn.addEventListener("click", () => {
  if (state.currentCard > 0) {
    state.currentCard--;
    renderCurrentCard();
  }
});

nextBtn.addEventListener("click", () => {
  if (state.currentCard < state.cards.length - 1) {
    state.currentCard++;
    renderCurrentCard();
  }
});

// ---- Form Submission ----
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideMessages();

  // Resolve place ID
  let placeId = state.placeId;
  const rawPlace = placeInput.value.trim();

  if (!placeId && rawPlace) {
    // If user typed a numeric ID directly
    if (/^\d+$/.test(rawPlace)) {
      placeId = Number(rawPlace);
    } else {
      showError("Please select a place from the dropdown suggestions.");
      return;
    }
  }

  if (!placeId) {
    showError("Please enter a place name or ID.");
    return;
  }

  const gridSize = Number(gridSizeSelect.value);
  const topN = Number(topNSlider.value);
  const numCards = Number(numCardsInput.value);
  const seedVal = Number(seedInput.value);
  const baseSeed = seedVal !== 0 ? seedVal : null;
  const freeSquare = freeSquareCheck.checked;

  // Gather filters
  let selectedMonths = null;
  if (monthEnabled.checked) {
    selectedMonths = Array.from(monthCheckboxes.querySelectorAll("input:checked")).map(
      (cb) => Number(cb.value)
    );
    if (selectedMonths.length === 0) selectedMonths = null;
  }

  let selectedIconicTaxa = null;
  if (taxaEnabled.checked) {
    selectedIconicTaxa = Array.from(taxaCheckboxes.querySelectorAll("input:checked")).map(
      (cb) => cb.value
    );
    if (selectedIconicTaxa.length === 0) selectedIconicTaxa = null;
  }

  // Disable button during generation
  generateBtn.disabled = true;
  generateBtn.textContent = "Generating…";
  previewSection.classList.add("hidden");

  try {
    showStatus("Fetching species list from iNaturalist…");

    const species = await fetchTopSpecies(placeId, topN, selectedMonths, selectedIconicTaxa);

    if (!species || species.length === 0) {
      showError("No species found for this place with the selected filters.");
      return;
    }

    const cellsNeeded = gridSize * gridSize - (freeSquare ? 1 : 0);
    if (species.length < cellsNeeded) {
      showError(
        `Not enough species (${species.length}) to fill a ${gridSize}×${gridSize} card ` +
        `(need ${cellsNeeded}). Try increasing the species pool size or using a smaller grid.`
      );
      return;
    }

    showStatus("Generating bingo cards…");
    const cards = generateCards(species, numCards, gridSize, freeSquare, baseSeed);

    state.cards = cards;
    state.gridSize = gridSize;
    state.currentCard = 0;
    state.options.photoOn = photoOnCheck.checked;
    state.options.commonOn = commonOnCheck.checked;
    state.options.sciOn = sciOnCheck.checked;

    renderCurrentCard();
    previewSection.classList.remove("hidden");
    hideMessages();
    showStatus("Done! Preview your cards below, then download as PDF.");
  } catch (err) {
    showError("Error: " + err.message);
  } finally {
    generateBtn.disabled = false;
    generateBtn.textContent = "Generate";
  }
});

// ---- PDF Download ----
downloadBtn.addEventListener("click", async () => {
  if (state.cards.length === 0) return;

  downloadBtn.disabled = true;
  downloadBtn.textContent = "Generating PDF…";

  try {
    const title = docTitleInput.value || "Bingo: Field Trip Edition";
    const blob = await generatePdf(
      state.cards,
      state.gridSize,
      state.options,
      title,
      (current, total) => {
        downloadBtn.textContent = `Generating PDF… (${current}/${total})`;
      }
    );

    // Trigger download
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "inat_bingo_cards.pdf";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    showError("PDF generation failed: " + err.message);
  } finally {
    downloadBtn.disabled = false;
    downloadBtn.textContent = "Download PDF";
  }
});

// ---- Init ----
initFilters();
