const EARTH_RADIUS_KM = 6371.0088;
const CIRCLE_SEGMENTS = 72;
const COORD_PRECISION = 6;
const RADIUS_PRECISION = 3;

export function createPlaceScope(place) {
  const placeId = Number(place?.id);

  if (!Number.isInteger(placeId) || placeId <= 0) {
    throw new Error("Invalid place");
  }

  return {
    kind: "place",
    placeId,
    label: place.displayName || `Place ${placeId}`,
  };
}

export function createRectangleScope(bounds) {
  const north = roundCoord(Math.max(bounds.north, bounds.south));
  const south = roundCoord(Math.min(bounds.north, bounds.south));
  const east = roundCoord(Math.max(bounds.east, bounds.west));
  const west = roundCoord(Math.min(bounds.east, bounds.west));

  if (north === south || east === west) {
    throw new Error("Rectangle must cover an area");
  }

  return {
    kind: "rectangle",
    label: "Custom rectangle boundary",
    bounds: { north, east, south, west },
    queryParams: {
      nelat: north,
      nelng: east,
      swlat: south,
      swlng: west,
    },
    geojson: rectangleToGeojson({ north, east, south, west }),
  };
}

export function createCircleScope(circle) {
  const lat = roundCoord(circle.lat);
  const lng = roundCoord(circle.lng);
  const radiusKm = roundRadius(circle.radiusKm);

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(radiusKm)) {
    throw new Error("Invalid circle");
  }

  if (radiusKm <= 0) {
    throw new Error("Circle must cover an area");
  }

  return {
    kind: "circle",
    label: "Custom circle boundary",
    center: { lat, lng },
    radiusKm,
    queryParams: {
      lat,
      lng,
      radius: radiusKm,
    },
    geojson: circleToGeojson({ lat, lng, radiusKm }),
  };
}

export function normalizeLocationScope(locationScope) {
  if (locationScope && typeof locationScope === "object") {
    return locationScope;
  }

  const placeId = Number(locationScope);
  if (Number.isInteger(placeId) && placeId > 0) {
    return {
      kind: "place",
      placeId,
      label: `Place ${placeId}`,
    };
  }

  throw new Error("Location is required");
}

export function appendLocationParams(params, locationScope) {
  const scope = normalizeLocationScope(locationScope);

  if (scope.kind === "place") {
    params.set("place_id", String(scope.placeId));
    return params;
  }

  if (scope.kind === "rectangle" || scope.kind === "circle") {
    for (const [key, value] of Object.entries(scope.queryParams || {})) {
      params.set(key, String(value));
    }
    return params;
  }

  throw new Error("Unsupported location");
}

export function getLocationCacheKey(locationScope) {
  const scope = normalizeLocationScope(locationScope);

  if (scope.kind === "place") {
    return `place:${scope.placeId}`;
  }

  const params = Object.entries(scope.queryParams || {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  return `${scope.kind}:${params}`;
}

export function getLocationScopeSummary(locationScope) {
  const scope = normalizeLocationScope(locationScope);

  if (scope.kind === "place") {
    return `Place ID ${scope.placeId}`;
  }

  if (scope.kind === "rectangle") {
    return "Custom rectangle boundary";
  }

  if (scope.kind === "circle") {
    return `Custom circle boundary. ${formatRadius(scope.radiusKm)} radius.`;
  }

  return "Custom boundary";
}

function rectangleToGeojson(bounds) {
  const { north, east, south, west } = bounds;

  return {
    type: "Feature",
    properties: { shape: "rectangle" },
    geometry: {
      type: "Polygon",
      coordinates: [[
        [west, south],
        [west, north],
        [east, north],
        [east, south],
        [west, south],
      ]],
    },
  };
}

function circleToGeojson(circle) {
  const coordinates = [];

  for (let i = 0; i <= CIRCLE_SEGMENTS; i += 1) {
    const bearing = (360 * i) / CIRCLE_SEGMENTS;
    const point = destinationPoint(circle.lat, circle.lng, bearing, circle.radiusKm);
    coordinates.push([roundCoord(point.lng), roundCoord(point.lat)]);
  }

  return {
    type: "Feature",
    properties: {
      shape: "circle",
      radiusKm: circle.radiusKm,
    },
    geometry: {
      type: "Polygon",
      coordinates: [coordinates],
    },
  };
}

function destinationPoint(lat, lng, bearingDegrees, distanceKm) {
  const angularDistance = distanceKm / EARTH_RADIUS_KM;
  const bearing = toRadians(bearingDegrees);
  const lat1 = toRadians(lat);
  const lng1 = toRadians(lng);

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance) +
    Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing)
  );
  const lng2 = lng1 + Math.atan2(
    Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1),
    Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2)
  );

  return {
    lat: toDegrees(lat2),
    lng: normalizeLng(toDegrees(lng2)),
  };
}

function normalizeLng(lng) {
  return ((((lng + 180) % 360) + 360) % 360) - 180;
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function toDegrees(value) {
  return (value * 180) / Math.PI;
}

function roundCoord(value) {
  return Number(Number(value).toFixed(COORD_PRECISION));
}

function roundRadius(value) {
  return Number(Number(value).toFixed(RADIUS_PRECISION));
}

function formatRadius(radiusKm) {
  if (radiusKm >= 10) return `${Math.round(radiusKm)} km`;
  if (radiusKm >= 1) return `${radiusKm.toFixed(1)} km`;
  return `${Math.round(radiusKm * 1000)} m`;
}
