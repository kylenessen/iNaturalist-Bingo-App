import assert from "node:assert/strict";
import test from "node:test";

import {
  appendLocationParams,
  createCircleScope,
  createPlaceScope,
  createRectangleScope,
  getLocationCacheKey,
  getLocationScopeSummary,
} from "./location-scope.js";

test("creates place scopes for iNaturalist place IDs", () => {
  const scope = createPlaceScope({ id: 123, displayName: "Mount Tamalpais" });
  const params = new URLSearchParams();

  appendLocationParams(params, scope);

  assert.equal(scope.kind, "place");
  assert.equal(scope.label, "Mount Tamalpais");
  assert.equal(params.get("place_id"), "123");
  assert.equal(getLocationCacheKey(scope), "place:123");
});

test("creates rectangle scopes from map bounds", () => {
  const scope = createRectangleScope({
    north: 38.2,
    east: -121.9,
    south: 37.7,
    west: -122.6,
  });
  const params = new URLSearchParams();

  appendLocationParams(params, scope);

  assert.equal(scope.kind, "rectangle");
  assert.equal(params.get("nelat"), "38.2");
  assert.equal(params.get("nelng"), "-121.9");
  assert.equal(params.get("swlat"), "37.7");
  assert.equal(params.get("swlng"), "-122.6");
  assert.equal(scope.geojson.geometry.type, "Polygon");
  assert.deepEqual(scope.geojson.geometry.coordinates[0][0], [-122.6, 37.7]);
});

test("creates circle scopes from center and radius", () => {
  const scope = createCircleScope({
    lat: 37.76,
    lng: -122.45,
    radiusKm: 2.4567,
  });
  const params = new URLSearchParams();

  appendLocationParams(params, scope);

  assert.equal(scope.kind, "circle");
  assert.equal(params.get("lat"), "37.76");
  assert.equal(params.get("lng"), "-122.45");
  assert.equal(params.get("radius"), "2.457");
  assert.equal(scope.geojson.geometry.type, "Polygon");
  assert.equal(scope.geojson.geometry.coordinates[0].length, 73);
  assert.equal(getLocationScopeSummary(scope), "Custom circle boundary. 2.5 km radius.");
});
