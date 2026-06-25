/**
 * iNaturalist API client.
 * Handles place search (type-ahead) and species fetching.
 */

import { API_BASE, SPECIES_RANK_LEVELS } from "./config.js";

// In-memory cache keyed on request params
const cache = new Map();
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
  placeId,
  selectedMonths,
  selectedIconicTaxa,
  page,
  perPage,
}) {
  const params = new URLSearchParams({
    place_id: placeId,
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

  return params;
}

function getTotalResults(data) {
  const total = Number(data.total_results || 0);
  return Number.isFinite(total) ? total : 0;
}

/**
 * Search places via iNaturalist autocomplete endpoint.
 * Returns an array of { id, displayName } objects.
 */
export async function searchPlaces(query) {
  if (!query || query.trim().length < 2) return [];

  const url = `${API_BASE}/places/autocomplete?q=${encodeURIComponent(query.trim())}&per_page=10`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Place search failed: ${resp.status}`);

  const data = await resp.json();
  return (data.results || []).map((r) => ({
    id: r.id,
    displayName: r.display_name || r.name,
  }));
}

/**
 * Fetch species metadata for a place.
 * Returns { species, totalAvailable }.
 */
export async function fetchSpeciesPool(placeId, topN, selectedMonths, selectedIconicTaxa) {
  const requestedCount = Math.max(0, Math.floor(Number(topN) || 0));
  const { monthKey, taxaKey } = buildFilterKeys(selectedMonths, selectedIconicTaxa);
  const cacheKey = `${placeId}-${requestedCount}-${monthKey}-${taxaKey}`;

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
      placeId,
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
