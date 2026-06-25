/**
 * iNaturalist API client.
 * Handles place search (type-ahead) and species fetching.
 */

import { API_BASE, SPECIES_RANK_LEVELS } from "./config.js";
import {
  appendLocationParams,
  getLocationCacheKey,
  normalizeLocationScope,
} from "./location-scope.js";

// In-memory cache keyed on request params
const cache = new Map();
const placeCache = new Map();
const MAX_SPECIES_PAGE_SIZE = 500;

function buildFilterKeys(selectedMonths, selectedIconicTaxa) {
  const monthKey = selectedMonths
    ? [...selectedMonths].sort((a, b) => a - b).join(",")
    : "";
  const taxaKey = selectedIconicTaxa
    ? [...selectedIconicTaxa].sort().join(",")
    : "";

  return { monthKey, taxaKey };
}

function buildSpeciesParams({
  locationScope,
  selectedMonths,
  selectedIconicTaxa,
  page,
  perPage,
}) {
  const params = new URLSearchParams({
    verifiable: "true",
    quality_grade: "research",
    geo: "true",
    page: String(page),
    per_page: String(perPage),
  });

  if (selectedMonths && selectedMonths.length > 0) {
    params.set("month", selectedMonths.join(","));
  }
  if (selectedIconicTaxa && selectedIconicTaxa.length > 0) {
    params.set("iconic_taxa", selectedIconicTaxa.join(","));
  }

  appendLocationParams(params, locationScope);
  return params;
}

function getTotalResults(data) {
  const total = Number(data.total_results || 0);
  return Number.isFinite(total) ? total : 0;
}

/**
 * Search places via iNaturalist autocomplete endpoint.
 * Returns place results with display names and boundary geometry when available.
 */
export async function searchPlaces(query) {
  if (!query || query.trim().length < 2) return [];

  const url = `${API_BASE}/places/autocomplete?q=${encodeURIComponent(query.trim())}&per_page=10`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Place search failed: ${resp.status}`);

  const data = await resp.json();
  return (data.results || []).map(formatPlace);
}

/**
 * Fetch place details by ID. Used when a numeric ID is entered directly or a
 * search result does not include geometry.
 */
export async function fetchPlaceDetails(placeId) {
  const id = Number(placeId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("Invalid place ID");
  }

  if (placeCache.has(id)) return placeCache.get(id);

  const url = `${API_BASE}/places/${id}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Place fetch failed: ${resp.status}`);

  const data = await resp.json();
  const result = data.results?.[0];
  if (!result) throw new Error("Place not found");

  const place = formatPlace(result);
  placeCache.set(id, place);
  return place;
}

function formatPlace(r) {
  return {
    id: r.id,
    displayName: r.display_name || r.name,
    geometryGeojson: r.geometry_geojson || null,
    boundingBoxGeojson: r.bounding_box_geojson || null,
    location: r.location || null,
    bboxArea: r.bbox_area ?? null,
  };
}

/**
 * Fetch species metadata for a place.
 * Returns { species, totalAvailable }.
 */
export async function fetchSpeciesPool(
  locationScope,
  topN,
  selectedMonths,
  selectedIconicTaxa
) {
  const normalizedLocationScope = normalizeLocationScope(locationScope);
  const requestedCount = Math.max(0, Math.floor(Number(topN) || 0));
  const { monthKey, taxaKey } = buildFilterKeys(selectedMonths, selectedIconicTaxa);
  const locationKey = getLocationCacheKey(normalizedLocationScope);
  const cacheKey = `${locationKey}-${requestedCount}-${monthKey}-${taxaKey}`;

  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const species = [];
  const pageSize = Math.max(
    1,
    Math.min(Math.max(requestedCount, 1), MAX_SPECIES_PAGE_SIZE)
  );
  let totalAvailable = 0;
  let page = 1;
  let hasMore = true;

  while (hasMore && (species.length < requestedCount || page === 1)) {
    const params = buildSpeciesParams({
      locationScope: normalizedLocationScope,
      selectedMonths,
      selectedIconicTaxa,
      page,
      perPage: pageSize,
    });

    const url = `${API_BASE}/observations/species_counts?${params}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Species fetch failed: ${resp.status}`);

    const data = await resp.json();
    const results = data.results || [];

    if (page === 1) {
      totalAvailable = getTotalResults(data);
    }

    for (const result of results) {
      if (species.length >= requestedCount) break;

      const taxon = result.taxon;
      if (!taxon) continue;

      const rankLevel = Number(taxon.rank_level);
      if (!rankLevel || !SPECIES_RANK_LEVELS.has(rankLevel)) continue;

      const defaultPhoto = taxon.default_photo || {};
      species.push({
        taxonId: taxon.id,
        commonName: taxon.preferred_common_name || "",
        scientificName: taxon.name || "",
        imageUrl: defaultPhoto.medium_url || "",
        observationCount: Number(result.count || 0),
      });
    }

    hasMore = results.length === pageSize && page * pageSize < totalAvailable;
    page += 1;
  }

  const payload = {
    species: species.slice(0, requestedCount),
    totalAvailable,
  };

  cache.set(cacheKey, payload);
  return payload;
}

/**
 * Fetch top-N species for a place.
 * Returns array of { taxonId, commonName, scientificName, imageUrl }.
 */
export async function fetchTopSpecies(placeId, topN, selectedMonths, selectedIconicTaxa) {
  const { species } = await fetchSpeciesPool(
    placeId,
    topN,
    selectedMonths,
    selectedIconicTaxa
  );
  return species;
}
