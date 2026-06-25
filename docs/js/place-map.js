/**
 * Leaflet-powered preview for selected iNaturalist place boundaries.
 */

const DEFAULT_CENTER = [20, 0];
const DEFAULT_ZOOM = 2;
const FIT_PADDING = [24, 24];
const MAX_FIT_ZOOM = 16;

const BOUNDARY_STYLE = {
  color: "#315f4c",
  fillColor: "#315f4c",
  fillOpacity: 0.18,
  opacity: 1,
  weight: 3,
};

export function hasBoundaryGeometry(place) {
  return Boolean(
    getGeojsonFeature(place?.geometryGeojson) ||
    getGeojsonFeature(place?.boundingBoxGeojson)
  );
}

export function initPlaceMap({
  panelEl,
  mapEl,
  statusEl,
  fitButton,
}) {
  let map = null;
  let boundaryLayer = null;
  let currentBounds = null;

  function ensureMap() {
    if (map) return map;

    const L = globalThis.L;
    if (!L) {
      throw new Error("Map library did not load");
    }

    const mapLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    });
    const aerialLayer = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        maxZoom: 19,
        attribution:
          "Tiles &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community",
      }
    );

    map = L.map(mapEl, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      layers: [aerialLayer],
      scrollWheelZoom: false,
    });
    map.attributionControl.setPrefix("");
    L.control.layers({ Aerial: aerialLayer, Map: mapLayer }).addTo(map);

    return map;
  }

  function showLoading(place) {
    showPanel(place, "Loading boundary...");
    setMapVisible(false);
  }

  function showUnavailable(place, message = "Boundary preview unavailable.") {
    showPanel(place, message);
    clearBoundary();
    setMapVisible(false);
  }

  function showPlace(place) {
    const geometryFeature = getGeojsonFeature(place?.geometryGeojson);
    const feature = geometryFeature || getGeojsonFeature(place?.boundingBoxGeojson);

    if (!feature) {
      showUnavailable(place);
      return false;
    }

    showPanel(place, "");
    setMapVisible(true);

    const L = globalThis.L;
    const leafletMap = ensureMap();
    clearBoundary();

    boundaryLayer = L.geoJSON(feature, {
      style: BOUNDARY_STYLE,
      interactive: false,
    }).addTo(leafletMap);

    currentBounds = boundaryLayer.getBounds();
    fitBoundary();
    refreshSize();
    statusEl.textContent = "";
    return true;
  }

  function clear() {
    clearBoundary();
    statusEl.textContent = "";
    panelEl.open = false;
    panelEl.classList.add("hidden");
    setMapVisible(false);
  }

  function fitBoundary() {
    if (!map || !currentBounds?.isValid()) return;
    map.fitBounds(currentBounds, {
      maxZoom: MAX_FIT_ZOOM,
      padding: FIT_PADDING,
    });
  }

  function refreshSize() {
    if (!map) return;
    requestAnimationFrame(() => {
      map.invalidateSize();
      fitBoundary();
    });
  }

  function showPanel(place, status) {
    statusEl.textContent = status;
    panelEl.classList.remove("hidden");
    panelEl.open = true;
  }

  function clearBoundary() {
    if (boundaryLayer && map) {
      boundaryLayer.removeFrom(map);
    }
    boundaryLayer = null;
    currentBounds = null;
  }

  function setMapVisible(visible) {
    mapEl.classList.toggle("hidden", !visible);
    fitButton.classList.toggle("hidden", !visible);
  }

  panelEl.addEventListener("toggle", () => {
    if (panelEl.open) refreshSize();
  });
  fitButton.addEventListener("click", fitBoundary);

  return {
    clear,
    showLoading,
    showPlace,
    showUnavailable,
  };
}

function getGeojsonFeature(value) {
  if (!value || typeof value !== "object") return null;

  if (value.type === "Feature") {
    return hasCoordinates(value.geometry?.coordinates) ? value : null;
  }

  if (value.type === "FeatureCollection") {
    return value.features?.some((feature) => getGeojsonFeature(feature)) ? value : null;
  }

  if (value.type && hasCoordinates(value.coordinates)) {
    return {
      type: "Feature",
      properties: {},
      geometry: value,
    };
  }

  return null;
}

function hasCoordinates(value) {
  if (!Array.isArray(value)) return false;
  if (value.length === 0) return false;
  if (typeof value[0] === "number") return value.length >= 2;
  return value.some(hasCoordinates);
}
