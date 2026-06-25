import assert from "node:assert/strict";

import {
  buildMetadataFooter,
  formatMetadataDate,
} from "../docs/js/metadata.js";

const createdAt = new Date(2026, 5, 24, 9, 7);

assert.equal(formatMetadataDate(createdAt), "2026-06-24 09:07");

assert.equal(
  buildMetadataFooter({
    createdAt,
    placeName: "Yosemite National Park",
    placeId: 123,
    gridSize: 5,
    numCards: 10,
    speciesPoolSize: 75,
    freeSquare: true,
    selectedMonths: [1, 5],
    selectedIconicTaxa: ["Aves", "Fungi"],
    baseSeed: 42,
  }),
  "Created 2026-06-24 09:07 | Place Yosemite National Park (ID 123) | Grid 5 x 5 | Cards 10 | Species pool 75 | Free square on | Filters months January, May, categories Birds, Fungi | Seed 42"
);

assert.equal(
  buildMetadataFooter({
    createdAt,
    placeName: "Place 7",
    placeId: 7,
    gridSize: 3,
    numCards: 1,
    speciesPoolSize: 25,
    freeSquare: false,
    selectedMonths: null,
    selectedIconicTaxa: null,
    baseSeed: null,
  }),
  "Created 2026-06-24 09:07 | Place Place 7 (ID 7) | Grid 3 x 3 | Cards 1 | Species pool 25 | Free square off | Filters none"
);
