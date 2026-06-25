import assert from "node:assert/strict";

import { getCellLayout } from "../docs/js/pdf.js";

const PDF_CELL_BORDER_PX = 2;
const LABEL_LINE_HEIGHT = 1.12;
const LABEL_LINES_PER_NAME = 2;

function requiredTwoLineLabelHeight(layout) {
  return (
    Math.ceil(layout.commonFontSize * LABEL_LINE_HEIGHT * LABEL_LINES_PER_NAME) +
    Math.ceil(layout.sciFontSize * LABEL_LINE_HEIGHT * LABEL_LINES_PER_NAME) +
    1
  );
}

const nineByNineLayout = getCellLayout(80, 100, {
  photoOn: true,
  commonOn: true,
  sciOn: true,
});

const availableContentHeight =
  100 - nineByNineLayout.padding * 2 - PDF_CELL_BORDER_PX;
const requiredLabelHeight = requiredTwoLineLabelHeight(nineByNineLayout);

assert.equal(nineByNineLayout.commonFontSize, 7);
assert.equal(nineByNineLayout.sciFontSize, 6);
assert.ok(
  nineByNineLayout.labelHeight >= requiredLabelHeight,
  `expected label height ${nineByNineLayout.labelHeight} to fit ${requiredLabelHeight}px of two-line labels`
);
assert.ok(
  nineByNineLayout.imageSize +
    nineByNineLayout.gap +
    nineByNineLayout.labelHeight <=
    availableContentHeight,
  "expected image and labels to fit within the cell content height"
);

const nineByNineWithFooterLayout = getCellLayout(80, 94, {
  photoOn: true,
  commonOn: true,
  sciOn: true,
});
const footerContentHeight =
  94 - nineByNineWithFooterLayout.padding * 2 - PDF_CELL_BORDER_PX;
const footerRequiredLabelHeight = requiredTwoLineLabelHeight(
  nineByNineWithFooterLayout
);

assert.ok(
  nineByNineWithFooterLayout.labelHeight >= footerRequiredLabelHeight,
  `expected footer layout label height ${nineByNineWithFooterLayout.labelHeight} to fit ${footerRequiredLabelHeight}px of two-line labels`
);
assert.ok(
  nineByNineWithFooterLayout.imageSize +
    nineByNineWithFooterLayout.gap +
    nineByNineWithFooterLayout.labelHeight <=
    footerContentHeight,
  "expected footer layout image and labels to fit within the cell content height"
);
