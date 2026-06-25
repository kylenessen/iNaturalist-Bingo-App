import assert from "node:assert/strict";

import { getPdfFilename } from "../docs/js/pdf.js";

assert.equal(
  getPdfFilename("Yellowstone National Park"),
  "inat_bingo_cards_Yellowstone_National_Park.pdf"
);

assert.equal(
  getPdfFilename("Bingo: Field Trip / Spring, Birds & Blooms"),
  "inat_bingo_cards_Bingo_Field_Trip_Spring_Birds_Blooms.pdf"
);

assert.equal(getPdfFilename("   "), "inat_bingo_cards.pdf");

assert.equal(
  getPdfFilename("a".repeat(90)),
  `inat_bingo_cards_${"a".repeat(80)}.pdf`
);
