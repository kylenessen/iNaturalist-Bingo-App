/**
 * Leaflet-powered preview and custom boundary drawing for place settings.
 */

import {
  createCircleScope,
  createRectangleScope,
} from "./location-scope.js";

const DEFAULT_CENTER = [20, 0];
const DEFAULT_ZOOM = 2;
const FIT_PADDING = [24, 24];
const MAX_FIT_ZOOM = 16;

const BOUNDARY_STYLE = {
  color: "#e74c3c",
  fillColor: "#e74c3c",
  fillOpacity: 0.18,
  opacity: 1,
  weight: 3,
};

const SEARCH_FOCUS_STYLE = {
  color: "#3498db",
  fillColor: "#3498db",
  fillOpacity: 0.08,
  opacity: 0.9,
  weight: 2,
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
  summaryLabelEl = null,
}) {
  let map = null;
  let boundaryLayer = null;
  let drawLayer = null;
  let searchFocusLayer = null;
  let currentBounds = null;
  let activeDrawTool = null;
  let drawStartLatLng = null;
  let drawingBoundary = null;
  let onBoundaryChange = () => {};

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
      scrollWheelZoom: true,
    });
    map.attributionControl.setPrefix("");
    L.control.layers({ Aerial: aerialLayer, Map: mapLayer }).addTo(map);

    return map;
  }

  function showLoading(place) {
    cancelActiveDraw(false);
    showPanel("Place boundary", "Loading boundary...");
    setMapVisible(false);
  }

  function showUnavailable(place, message = "Boundary preview unavailable.") {
    cancelActiveDraw(false);
    showPanel("Place boundary", message);
    clearBoundary();
    clearDrawLayer();
    clearSearchFocus();
    setMapVisible(false);
  }

  function showPlace(place) {
    const geometryFeature = getGeojsonFeature(place?.geometryGeojson);
    const feature = geometryFeature || getGeojsonFeature(place?.boundingBoxGeojson);

    if (!feature) {
      showUnavailable(place);
      return false;
    }

    cancelActiveDraw(false);
    showPanel("Place boundary", "");
    setMapVisible(true);

    const L = globalThis.L;
    const leafletMap = ensureMap();
    clearBoundary();
    clearDrawLayer();
    clearSearchFocus();

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

  function openDrawing(options = {}) {
    onBoundaryChange = options.onBoundaryChange || (() => {});
    drawingBoundary = null;
    cancelActiveDraw(false);
    clearBoundary();
    clearDrawLayer();
    clearSearchFocus();
    showPanel("Draw custom boundary", "Choose rectangle or circle.");
    setMapVisible(true);
    ensureMap();
    currentBounds = null;
    refreshSize({ fit: false });
    onBoundaryChange(null);
  }

  function startDrawTool(tool) {
    const leafletMap = ensureMap();

    if (tool !== "rectangle" && tool !== "circle") return;

    cancelActiveDraw(false);
    clearDrawLayer();
    clearSearchFocus();
    drawingBoundary = null;
    onBoundaryChange(null);
    activeDrawTool = tool;
    drawStartLatLng = null;
    mapEl.classList.add("is-drawing");
    leafletMap.dragging.disable();
    statusEl.textContent =
      tool === "rectangle"
        ? "Drag on the map to draw a rectangle."
        : "Drag on the map to set the circle radius.";
    leafletMap.once("mousedown", handleDrawStart);
  }

  function clearDrawing() {
    cancelActiveDraw(true);
    clearSearchFocus();
    drawingBoundary = null;
    statusEl.textContent = "Choose rectangle or circle.";
    onBoundaryChange(null);
  }

  function cancelDrawing() {
    cancelActiveDraw(true);
    clearSearchFocus();
    drawingBoundary = null;
    onBoundaryChange(null);
  }

  function showBoundary(locationScope) {
    cancelActiveDraw(false);
    clearBoundary();
    clearDrawLayer();
    clearSearchFocus();
    drawingBoundary = null;
    showPanel("Custom boundary", "");
    setMapVisible(true);

    const leafletMap = ensureMap();
    boundaryLayer = createLayerFromScope(locationScope).addTo(leafletMap);
    currentBounds = boundaryLayer.getBounds();
    fitBoundary();
    refreshSize();
    statusEl.textContent = "";
  }

  function focusPlace(place) {
    const leafletMap = ensureMap();
    const feature = getGeojsonFeature(place?.geometryGeojson) ||
      getGeojsonFeature(place?.boundingBoxGeojson);

    clearSearchFocus();

    if (feature) {
      const L = globalThis.L;
      searchFocusLayer = L.geoJSON(feature, {
        style: SEARCH_FOCUS_STYLE,
        interactive: false,
      }).addTo(leafletMap);
      const bounds = searchFocusLayer.getBounds();
      if (bounds.isValid()) {
        leafletMap.fitBounds(bounds, {
          maxZoom: MAX_FIT_ZOOM,
          padding: FIT_PADDING,
        });
      }
      statusEl.textContent = `Map centered on ${place.displayName}.`;
      return true;
    }

    const center = parsePlaceLocation(place?.location);
    if (center) {
      leafletMap.setView(center, Math.max(leafletMap.getZoom(), 11));
      statusEl.textContent = `Map centered on ${place.displayName}.`;
      return true;
    }

    statusEl.textContent = "Could not center the map on that place.";
    return false;
  }

  function clear() {
    cancelActiveDraw(true);
    clearBoundary();
    clearSearchFocus();
    statusEl.textContent = "";
    panelEl.open = false;
    panelEl.classList.add("hidden");
    setMapVisible(false);
  }

  function handleDrawStart(e) {
    if (!activeDrawTool) return;
    if (e.originalEvent?.button && e.originalEvent.button !== 0) return;

    const leafletMap = ensureMap();
    const L = globalThis.L;

    clearDrawLayer();
    drawStartLatLng = e.latlng;

    if (activeDrawTool === "rectangle") {
      drawLayer = L.rectangle([drawStartLatLng, drawStartLatLng], BOUNDARY_STYLE)
        .addTo(leafletMap);
    } else {
      drawLayer = L.circle(drawStartLatLng, {
        ...BOUNDARY_STYLE,
        radius: 1,
      }).addTo(leafletMap);
    }

    leafletMap.on("mousemove", handleDrawMove);
    leafletMap.once("mouseup", handleDrawEnd);
  }

  function handleDrawMove(e) {
    updateDrawLayer(e.latlng);
  }

  function handleDrawEnd(e) {
    const leafletMap = ensureMap();

    updateDrawLayer(e.latlng);
    leafletMap.off("mousemove", handleDrawMove);
    leafletMap.dragging.enable();
    mapEl.classList.remove("is-drawing");

    try {
      drawingBoundary = buildBoundaryFromDrawLayer();
      currentBounds = drawLayer.getBounds();
      statusEl.textContent =
        drawingBoundary.kind === "rectangle"
          ? "Rectangle boundary ready."
          : "Circle boundary ready.";
      onBoundaryChange(drawingBoundary);
    } catch {
      clearDrawLayer();
      drawingBoundary = null;
      statusEl.textContent = "Boundary was too small. Draw again.";
      onBoundaryChange(null);
    } finally {
      activeDrawTool = null;
      drawStartLatLng = null;
    }
  }

  function updateDrawLayer(latLng) {
    if (!drawLayer || !drawStartLatLng) return;

    if (activeDrawTool === "rectangle") {
      drawLayer.setBounds([drawStartLatLng, latLng]);
      return;
    }

    drawLayer.setRadius(drawStartLatLng.distanceTo(latLng));
  }

  function buildBoundaryFromDrawLayer() {
    if (!drawLayer || !activeDrawTool) {
      throw new Error("No boundary drawn");
    }

    if (activeDrawTool === "rectangle") {
      const bounds = drawLayer.getBounds();
      return createRectangleScope({
        north: bounds.getNorth(),
        east: bounds.getEast(),
        south: bounds.getSouth(),
        west: bounds.getWest(),
      });
    }

    const center = drawLayer.getLatLng();
    return createCircleScope({
      lat: center.lat,
      lng: center.lng,
      radiusKm: drawLayer.getRadius() / 1000,
    });
  }

  function cancelActiveDraw(clearLayer) {
    if (!map) return;

    map.off("mousedown", handleDrawStart);
    map.off("mousemove", handleDrawMove);
    map.off("mouseup", handleDrawEnd);
    map.dragging.enable();
    mapEl.classList.remove("is-drawing");
    activeDrawTool = null;
    drawStartLatLng = null;

    if (clearLayer) {
      clearDrawLayer();
    }
  }

  function createLayerFromScope(locationScope) {
    const L = globalThis.L;

    if (locationScope.kind === "circle") {
      return L.circle([locationScope.center.lat, locationScope.center.lng], {
        ...BOUNDARY_STYLE,
        radius: locationScope.radiusKm * 1000,
        interactive: false,
      });
    }

    return L.geoJSON(locationScope.geojson, {
      style: BOUNDARY_STYLE,
      interactive: false,
    });
  }

  function fitBoundary() {
    if (!map || !currentBounds?.isValid()) return;
    map.fitBounds(currentBounds, {
      maxZoom: MAX_FIT_ZOOM,
      padding: FIT_PADDING,
    });
  }

  function refreshSize(options = {}) {
    const { fit = true } = options;
    if (!map) return;
    requestAnimationFrame(() => {
      map.invalidateSize();
      if (fit) fitBoundary();
    });
  }

  function showPanel(label, status) {
    if (summaryLabelEl) summaryLabelEl.textContent = label;
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

  function clearDrawLayer() {
    if (drawLayer && map) {
      drawLayer.removeFrom(map);
    }
    drawLayer = null;
  }

  function clearSearchFocus() {
    if (searchFocusLayer && map) {
      searchFocusLayer.removeFrom(map);
    }
    searchFocusLayer = null;
  }

  function setMapVisible(visible) {
    mapEl.classList.toggle("hidden", !visible);
  }

  panelEl.addEventListener("toggle", () => {
    if (panelEl.open) refreshSize();
  });

  return {
    cancelDrawing,
    clear,
    clearDrawing,
    focusPlace,
    openDrawing,
    showBoundary,
    showLoading,
    showPlace,
    showUnavailable,
    startDrawTool,
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

function parsePlaceLocation(value) {
  if (!value || typeof value !== "string") return null;

  const [lat, lng] = value.split(",").map((part) => Number(part.trim()));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return [lat, lng];
}
