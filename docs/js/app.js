/**
 * Main application module.
 * Wires up events, manages state, renders bingo card previews.
 */

import { searchPlaces, fetchSpeciesPool, fetchPlaceDetails } from "./api.js";
import { generateCards } from "./bingo.js";
import { generatePdf } from "./pdf.js";
import { hasBoundaryGeometry, initPlaceMap } from "./place-map.js";
import { ICONIC_TAXA, MONTH_NAMES, DEBOUNCE_MS } from "./config.js";
import {
  RARE_OBSERVATION_THRESHOLD,
  getRarelyObservedCutoff,
  getSpeciesPoolSettings,
} from "./species-settings.js";

// ---- State ----
const state = {
  placeId: null,
  placeName: "",
  generatedPlaceName: "",
  cards: [],       // Array of grids
  gridSize: 5,
  currentCard: 0,
  speciesAvailability: null,
  speciesSettingsRequestId: 0,
  rareWarningRequestId: 0,
  placeBoundaryRequestId: 0,
  selectedPlace: null,
  options: { photoOn: true, commonOn: true, sciOn: true },
};

// ---- DOM references ----
const $ = (sel) => document.querySelector(sel);
const placeInput = $("#place-input");
const placeDropdown = $("#place-dropdown");
const placeIdInput = $("#place-id");
const placeDisplay = $("#place-display");
const placeMapPanel = $("#place-map-panel");
const placeMapEl = $("#place-map");
const placeMapStatus = $("#place-map-status");
const placeMapFit = $("#place-map-fit");
const taxaEnabled = $("#taxa-filter-enabled");
const taxaWrapper = $("#taxa-select-wrapper");
const taxaCheckboxes = $("#taxa-checkboxes");
const monthEnabled = $("#month-filter-enabled");
const monthWrapper = $("#month-select-wrapper");
const monthCheckboxes = $("#month-checkboxes");
const gridSizeControl = $("#grid-size");
const topNSlider = $("#top-n");
const topNValue = $("#top-n-value");
const topNInput = $("#top-n-input");
const topNBounds = $("#top-n-bounds");
const topNWarning = $("#top-n-warning");
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
const placeMap = initPlaceMap({
  panelEl: placeMapPanel,
  mapEl: placeMapEl,
  statusEl: placeMapStatus,
  fitButton: placeMapFit,
});

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

let docTitleDefault = docTitleInput.value;

function setDocTitleDefault(title) {
  if (!title) return;

  const shouldUseDefault =
    docTitleInput.value === docTitleDefault || docTitleInput.value.trim() === "";

  docTitleDefault = title;

  if (shouldUseDefault) {
    docTitleInput.value = title;
  }
}

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

function getSelectedFilters() {
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

  return { selectedMonths, selectedIconicTaxa };
}

function getSelectedGridSize() {
  return Number(gridSizeControl.querySelector("input:checked")?.value || 5);
}

function getCurrentSpeciesPoolSettings(value = null) {
  return getSpeciesPoolSettings({
    gridSize: getSelectedGridSize(),
    freeSquare: freeSquareCheck.checked,
    availableSpecies: state.speciesAvailability?.totalAvailable ?? null,
    value,
  });
}

function setTopNWarning(message) {
  topNWarning.textContent = message;
  topNWarning.classList.remove("hidden");
}

function hideTopNWarning() {
  topNWarning.textContent = "";
  topNWarning.classList.add("hidden");
}

function renderSpeciesPoolBounds(settings) {
  if (!settings.hasEnoughSpecies) {
    topNBounds.textContent =
      `${settings.availableSpecies} species observed. ` +
      `${settings.requiredSpecies} needed for this card.`;
    return;
  }

  if (settings.availableSpecies === null) {
    topNBounds.textContent = `${settings.min} minimum`;
    return;
  }

  topNBounds.textContent = `${settings.min} to ${settings.max} species available`;
}

function renderRareSpeciesWarning(species, value) {
  const cutoff = getRarelyObservedCutoff(species, value);

  if (!cutoff) {
    hideTopNWarning();
    return;
  }

  setTopNWarning(
    `This pool reaches species with fewer than ` +
    `${RARE_OBSERVATION_THRESHOLD} observations here.`
  );
}

function getEffectiveAvailableSpecies(speciesPool, requestedCount) {
  const reportedTotal = Number(speciesPool.totalAvailable || 0);
  const fetchedTotal = speciesPool.species.length;

  if (requestedCount >= reportedTotal && fetchedTotal < reportedTotal) {
    return fetchedTotal;
  }

  return reportedTotal;
}

function syncSpeciesPoolControls(value = null, options = {}) {
  const { checkRare = true } = options;
  const settings = getCurrentSpeciesPoolSettings(value);
  const controlValue = String(settings.value);
  const min = String(settings.min);
  const max = String(settings.max);

  topNSlider.min = min;
  topNSlider.max = max;
  topNSlider.step = "1";
  topNSlider.disabled = !settings.hasEnoughSpecies;
  topNSlider.value = controlValue;

  topNInput.min = min;
  topNInput.max = max;
  topNInput.step = "1";
  topNInput.disabled = !settings.hasEnoughSpecies;
  topNInput.value = controlValue;

  topNValue.textContent = controlValue;
  renderSpeciesPoolBounds(settings);

  if (!settings.hasEnoughSpecies) {
    setTopNWarning(
      `Choose a smaller grid or broader filters. ` +
      `This card needs ${settings.requiredSpecies} species.`
    );
  } else if (!state.placeId) {
    hideTopNWarning();
  } else if (checkRare) {
    debouncedRefreshRareSpeciesWarning();
  }

  return settings;
}

async function refreshRareSpeciesWarning() {
  const settings = getCurrentSpeciesPoolSettings(topNInput.value);

  if (!state.placeId || !settings.hasEnoughSpecies) {
    return;
  }

  const requestId = ++state.rareWarningRequestId;
  const { selectedMonths, selectedIconicTaxa } = getSelectedFilters();

  try {
    const speciesPool = await fetchSpeciesPool(
      state.placeId,
      settings.value,
      selectedMonths,
      selectedIconicTaxa
    );
    const species = speciesPool.species;

    if (requestId !== state.rareWarningRequestId) return;

    const effectiveAvailableSpecies = getEffectiveAvailableSpecies(
      speciesPool,
      settings.value
    );
    if (effectiveAvailableSpecies !== state.speciesAvailability?.totalAvailable) {
      state.speciesAvailability = { totalAvailable: effectiveAvailableSpecies };
      const updatedSettings = syncSpeciesPoolControls(settings.value, {
        checkRare: false,
      });
      renderRareSpeciesWarning(species, updatedSettings.value);
      return;
    }

    renderRareSpeciesWarning(species, settings.value);
  } catch {
    if (requestId === state.rareWarningRequestId) hideTopNWarning();
  }
}

const debouncedRefreshRareSpeciesWarning = debounce(
  refreshRareSpeciesWarning,
  DEBOUNCE_MS
);

async function refreshSpeciesAvailability(options = {}) {
  const { resetToDefault = true } = options;
  state.rareWarningRequestId += 1;
  hideTopNWarning();

  if (!state.placeId) {
    state.speciesAvailability = null;
    syncSpeciesPoolControls(resetToDefault ? null : topNInput.value, {
      checkRare: false,
    });
    return;
  }

  const requestId = ++state.speciesSettingsRequestId;
  const { selectedMonths, selectedIconicTaxa } = getSelectedFilters();
  const defaultSettings = getSpeciesPoolSettings({
    gridSize: getSelectedGridSize(),
    freeSquare: freeSquareCheck.checked,
  });

  topNBounds.textContent = "Checking available species...";

  try {
    const pool = await fetchSpeciesPool(
      state.placeId,
      defaultSettings.defaultSpecies,
      selectedMonths,
      selectedIconicTaxa
    );

    if (requestId !== state.speciesSettingsRequestId) return;

    state.speciesAvailability = { totalAvailable: pool.totalAvailable };
    const settings = syncSpeciesPoolControls(
      resetToDefault ? null : topNInput.value,
      { checkRare: false }
    );

    if (settings.hasEnoughSpecies) {
      renderRareSpeciesWarning(pool.species, settings.value);
    }
  } catch {
    if (requestId !== state.speciesSettingsRequestId) return;

    state.speciesAvailability = null;
    syncSpeciesPoolControls(resetToDefault ? null : topNInput.value, {
      checkRare: false,
    });
    topNBounds.textContent = "Could not check available species";
    hideTopNWarning();
  }
}

const debouncedRefreshSpeciesAvailability = debounce(
  () => refreshSpeciesAvailability({ resetToDefault: true }),
  DEBOUNCE_MS
);

// ---- Populate filter checkboxes ----
function initFilters() {
  // Taxa checkboxes
  for (const [key, label] of Object.entries(ICONIC_TAXA)) {
    const lbl = document.createElement("label");
    const text = document.createElement("span");
    const cb = document.createElement("input");
    lbl.className = "checkbox-chip";
    cb.type = "checkbox";
    cb.value = key;
    cb.name = "iconic-taxa";
    text.textContent = label;
    lbl.appendChild(cb);
    lbl.appendChild(text);
    taxaCheckboxes.appendChild(lbl);
  }

  // Month checkboxes
  MONTH_NAMES.forEach((name, i) => {
    const lbl = document.createElement("label");
    const text = document.createElement("span");
    const cb = document.createElement("input");
    lbl.className = "checkbox-chip";
    cb.type = "checkbox";
    cb.value = String(i + 1);
    cb.name = "month";
    text.textContent = name;
    lbl.appendChild(cb);
    lbl.appendChild(text);
    monthCheckboxes.appendChild(lbl);
  });
}

// ---- Place Type-Ahead ----
let dropdownIndex = -1;
let dropdownPlaces = [];

function setSelectedPlace(place) {
  state.placeId = place.id;
  state.placeName = place.displayName;
  state.selectedPlace = place;
  placeInput.value = place.displayName;
  placeIdInput.value = place.id;
  placeDisplay.textContent = `Place ID: ${place.id}`;
}

function clearSelectedPlace() {
  state.placeId = null;
  state.placeName = "";
  state.selectedPlace = null;
  state.speciesAvailability = null;
  state.placeBoundaryRequestId += 1;
  placeIdInput.value = "";
  placeDisplay.textContent = "";
  placeMap.clear();
}

async function refreshPlaceBoundaryPreview(place) {
  const requestId = ++state.placeBoundaryRequestId;
  let previewPlace = place;

  placeMap.showLoading(previewPlace);

  try {
    if (!hasBoundaryGeometry(previewPlace)) {
      previewPlace = await fetchPlaceDetails(previewPlace.id);
    }

    if (requestId !== state.placeBoundaryRequestId) return;

    state.selectedPlace = previewPlace;
    placeMap.showPlace(previewPlace);
  } catch {
    if (requestId === state.placeBoundaryRequestId) {
      placeMap.showUnavailable(previewPlace);
    }
  }
}

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
  dropdownPlaces = results;

  if (results.length === 0) {
    placeDropdown.classList.add("hidden");
    return;
  }

  results.forEach((place, index) => {
    const li = document.createElement("li");
    li.textContent = place.displayName;
    li.dataset.id = place.id;
    li.dataset.index = String(index);
    li.addEventListener("mousedown", (e) => {
      e.preventDefault();
      selectPlace(place);
    });
    placeDropdown.appendChild(li);
  });

  placeDropdown.classList.remove("hidden");
}

function selectPlace(place) {
  setSelectedPlace(place);
  placeDropdown.classList.add("hidden");

  if (state.cards.length === 0) {
    setDocTitleDefault(place.displayName);
  }

  refreshPlaceBoundaryPreview(place);
  refreshSpeciesAvailability({ resetToDefault: true });
}

placeInput.addEventListener("input", (e) => {
  if (!state.placeId || e.target.value === state.placeName) return;

  clearSelectedPlace();
  syncSpeciesPoolControls(null, { checkRare: false });
});

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
    selectPlace(dropdownPlaces[Number(li.dataset.index)] || {
      id: Number(li.dataset.id),
      displayName: li.textContent,
    });
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
  debouncedRefreshSpeciesAvailability();
});

monthEnabled.addEventListener("change", () => {
  monthWrapper.classList.toggle("hidden", !monthEnabled.checked);
  debouncedRefreshSpeciesAvailability();
});

taxaCheckboxes.addEventListener("change", debouncedRefreshSpeciesAvailability);
monthCheckboxes.addEventListener("change", debouncedRefreshSpeciesAvailability);

// ---- Species pool controls ----
topNSlider.addEventListener("input", () => {
  syncSpeciesPoolControls(topNSlider.value);
});

topNInput.addEventListener("input", () => {
  if (topNInput.value === "") return;

  const rawValue = Number(topNInput.value);
  if (!Number.isFinite(rawValue)) return;

  const settings = getCurrentSpeciesPoolSettings(rawValue);
  const roundedValue = String(Math.round(rawValue));
  topNValue.textContent = roundedValue;

  if (rawValue >= settings.min && rawValue <= settings.max) {
    topNSlider.value = roundedValue;
    debouncedRefreshRareSpeciesWarning();
  }
});

topNInput.addEventListener("change", () => {
  syncSpeciesPoolControls(topNInput.value);
});

gridSizeControl.addEventListener("change", () => {
  syncSpeciesPoolControls(null);
});

freeSquareCheck.addEventListener("change", () => {
  syncSpeciesPoolControls(null);
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
  let placeTitle = state.placeName || rawPlace;

  if (!placeId && rawPlace) {
    // If user typed a numeric ID directly
    if (/^\d+$/.test(rawPlace)) {
      placeId = Number(rawPlace);
      try {
        const directPlace = await fetchPlaceDetails(placeId);
        setSelectedPlace(directPlace);
        refreshPlaceBoundaryPreview(directPlace);
        placeTitle = directPlace.displayName;
      } catch {
        const directPlace = { id: placeId, displayName: `Place ${placeId}` };
        setSelectedPlace(directPlace);
        placeMap.showUnavailable(directPlace);
        placeTitle = directPlace.displayName;
      }
    } else {
      showError("Please select a place from the dropdown suggestions.");
      return;
    }
  }

  if (!placeId) {
    showError("Please enter a place name or ID.");
    return;
  }

  const gridSize = getSelectedGridSize();
  const requestedSpeciesSettings = syncSpeciesPoolControls(topNInput.value, {
    checkRare: false,
  });
  const topN = requestedSpeciesSettings.value;
  const numCards = Number(numCardsInput.value);
  const seedVal = Number(seedInput.value);
  const baseSeed = seedVal !== 0 ? seedVal : null;
  const freeSquare = freeSquareCheck.checked;
  const { selectedMonths, selectedIconicTaxa } = getSelectedFilters();

  // Disable button during generation
  generateBtn.disabled = true;
  generateBtn.textContent = "Generating…";
  previewSection.classList.add("hidden");

  try {
    showStatus("Fetching species list from iNaturalist…");

    const speciesPool = await fetchSpeciesPool(
      placeId,
      topN,
      selectedMonths,
      selectedIconicTaxa
    );
    const species = speciesPool.species;
    state.speciesAvailability = {
      totalAvailable: getEffectiveAvailableSpecies(speciesPool, topN),
    };
    const availableSpeciesSettings = syncSpeciesPoolControls(topN, {
      checkRare: false,
    });

    if (!species || species.length === 0) {
      showError("No species found for this place with the selected filters.");
      return;
    }

    const cellsNeeded = gridSize * gridSize - (freeSquare ? 1 : 0);
    if (species.length < cellsNeeded) {
      showError(
        `This place has ${species.length} species with the selected filters. ` +
        `A ${gridSize}×${gridSize} card needs ${cellsNeeded}.`
      );
      return;
    }

    renderRareSpeciesWarning(species, availableSpeciesSettings.value);

    showStatus("Generating bingo cards…");
    const cards = generateCards(
      species.slice(0, availableSpeciesSettings.value),
      numCards,
      gridSize,
      freeSquare,
      baseSeed
    );

    state.cards = cards;
    state.gridSize = gridSize;
    state.currentCard = 0;
    state.options.photoOn = photoOnCheck.checked;
    state.options.commonOn = commonOnCheck.checked;
    state.options.sciOn = sciOnCheck.checked;
    state.generatedPlaceName = placeTitle;
    setDocTitleDefault(placeTitle);

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
    const title = docTitleInput.value || state.generatedPlaceName || "iNaturalist Bingo";
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
syncSpeciesPoolControls(null, { checkRare: false });
