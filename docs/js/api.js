/**
 * iNaturalist API client.
 * Handles place search (type-ahead) and species fetching.
 */

import { API_BASE, SPECIES_RANK_LEVELS } from "./config.js";

// In-memory cache keyed on request params
const cache = new Map();

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
 * Fetch top-N species for a place.
 * Returns array of { taxonId, commonName, scientificName, imageUrl }.
 */
export async function fetchTopSpecies(placeId, topN, selectedMonths, selectedIconicTaxa) {
  // Build cache key
  const monthKey = selectedMonths ? selectedMonths.sort((a, b) => a - b).join(",") : "";
  const taxaKey = selectedIconicTaxa ? selectedIconicTaxa.sort().join(",") : "";
  const cacheKey = `${placeId}-${topN}-${monthKey}-${taxaKey}`;

  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const params = new URLSearchParams({
    place_id: placeId,
    verifiable: "true",
    quality_grade: "research",
    geo: "true",
    per_page: String(Math.min(topN * 3, 500)),
  });

  if (selectedMonths && selectedMonths.length > 0) {
    params.set("month", selectedMonths.join(","));
  }
  if (selectedIconicTaxa && selectedIconicTaxa.length > 0) {
    params.set("iconic_taxa", selectedIconicTaxa.join(","));
  }

  const url = `${API_BASE}/observations/species_counts?${params}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Species fetch failed: ${resp.status}`);

  const data = await resp.json();
  const results = data.results || [];
  const species = [];

  for (const result of results) {
    if (species.length >= topN) break;

    const taxon = result.taxon;
    if (!taxon) continue;

    const rankLevel = taxon.rank_level;
    if (!rankLevel || !SPECIES_RANK_LEVELS.has(rankLevel)) continue;

    const defaultPhoto = taxon.default_photo || {};
    species.push({
      taxonId: taxon.id,
      commonName: taxon.preferred_common_name || "",
      scientificName: taxon.name || "",
      imageUrl: defaultPhoto.medium_url || "",
    });
  }

  cache.set(cacheKey, species);
  return species;
}
