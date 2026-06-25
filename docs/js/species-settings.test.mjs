import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(
  new URL("./species-settings.js", import.meta.url),
  "utf8"
);
const settings = await import(
  `data:text/javascript;charset=utf-8,${encodeURIComponent(source)}`
);

test("calculates the minimum species needed for each grid", () => {
  assert.equal(settings.getRequiredSpecies(5, false), 25);
  assert.equal(settings.getRequiredSpecies(5, true), 24);
  assert.equal(settings.getRequiredSpecies(9, false), 81);
});

test("defaults to a three to one pool for normal grids", () => {
  assert.equal(settings.getSpeciesPoolSettings({ gridSize: 5 }).value, 75);
  assert.equal(settings.getSpeciesPoolSettings({ gridSize: 9 }).value, 243);
});

test("caps the default at the available species count", () => {
  const pool = settings.getSpeciesPoolSettings({
    gridSize: 9,
    availableSpecies: 120,
  });

  assert.equal(pool.min, 81);
  assert.equal(pool.max, 120);
  assert.equal(pool.value, 120);
  assert.equal(pool.hasEnoughSpecies, true);
});

test("reports an impossible grid when availability is below the minimum", () => {
  const pool = settings.getSpeciesPoolSettings({
    gridSize: 9,
    availableSpecies: 70,
  });

  assert.equal(pool.requiredSpecies, 81);
  assert.equal(pool.value, 70);
  assert.equal(pool.hasEnoughSpecies, false);
});

test("detects when the selected cutoff is rarely observed", () => {
  const species = [
    { observationCount: 8 },
    { observationCount: 5 },
    { observationCount: 4 },
  ];

  assert.equal(settings.getRarelyObservedCutoff(species, 2), null);
  assert.deepEqual(settings.getRarelyObservedCutoff(species, 3), {
    poolSize: 3,
    availablePoolSize: 3,
    observationCount: 4,
    threshold: 5,
  });
});

test("checks the last available species when the requested pool is short", () => {
  const species = [
    { observationCount: 8 },
    { observationCount: 1 },
  ];

  assert.deepEqual(settings.getRarelyObservedCutoff(species, 4), {
    poolSize: 4,
    availablePoolSize: 2,
    observationCount: 1,
    threshold: 5,
  });
});
