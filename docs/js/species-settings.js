/**
 * Species pool sizing rules.
 * Keep these functions pure so UI behavior and tests share the same math.
 */

export const SPECIES_POOL_RATIO = 3;
export const RARE_OBSERVATION_THRESHOLD = 5;
export const FALLBACK_SPECIES_MAX = 100;

function normalizeCount(value) {
  if (value === null || value === undefined || value === "") return null;

  const count = Math.floor(Number(value));
  if (!Number.isFinite(count)) return null;

  return Math.max(0, count);
}

export function getRequiredSpecies(gridSize, freeSquare = false) {
  const size = Math.max(0, Math.floor(Number(gridSize)));
  const cellCount = size * size;

  return Math.max(0, cellCount - (freeSquare ? 1 : 0));
}

export function getSpeciesPoolSettings({
  gridSize,
  freeSquare = false,
  availableSpecies = null,
  value = null,
} = {}) {
  const requiredSpecies = getRequiredSpecies(gridSize, freeSquare);
  const idealSpecies = requiredSpecies * SPECIES_POOL_RATIO;
  const knownAvailableSpecies = normalizeCount(availableSpecies);

  if (
    knownAvailableSpecies !== null &&
    knownAvailableSpecies < requiredSpecies
  ) {
    return {
      min: knownAvailableSpecies,
      max: knownAvailableSpecies,
      value: knownAvailableSpecies,
      requiredSpecies,
      idealSpecies,
      defaultSpecies: knownAvailableSpecies,
      availableSpecies: knownAvailableSpecies,
      hasEnoughSpecies: false,
    };
  }

  const max = knownAvailableSpecies === null
    ? Math.max(idealSpecies, FALLBACK_SPECIES_MAX)
    : knownAvailableSpecies;
  const defaultSpecies = knownAvailableSpecies === null
    ? idealSpecies
    : Math.min(idealSpecies, knownAvailableSpecies);
  const requestedSpecies = normalizeCount(value) ?? defaultSpecies;
  const clampedValue = Math.min(max, Math.max(requiredSpecies, requestedSpecies));

  return {
    min: requiredSpecies,
    max,
    value: clampedValue,
    requiredSpecies,
    idealSpecies,
    defaultSpecies,
    availableSpecies: knownAvailableSpecies,
    hasEnoughSpecies: true,
  };
}

export function getRarelyObservedCutoff(
  species,
  poolSize,
  threshold = RARE_OBSERVATION_THRESHOLD
) {
  const selectedSize = normalizeCount(poolSize);
  if (!Array.isArray(species) || selectedSize === null || selectedSize <= 0) {
    return null;
  }

  const cutoffIndex = Math.min(selectedSize, species.length) - 1;
  const cutoffSpecies = species[cutoffIndex];
  if (!cutoffSpecies) return null;

  const observationCount = normalizeCount(cutoffSpecies.observationCount);
  if (observationCount === null || observationCount >= threshold) {
    return null;
  }

  return {
    poolSize: selectedSize,
    availablePoolSize: cutoffIndex + 1,
    observationCount,
    threshold,
  };
}
