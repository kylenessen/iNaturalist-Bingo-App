/**
 * PDF generation using html2canvas + jsPDF.
 * Renders each bingo card at letter-size proportions, captures at 2x, assembles PDF.
 */

import { PDF_IMAGE_PROXY_BASE, PDF_IMAGE_SIZE_PX } from "./config.js";

/* global jspdf, html2canvas */

const DPI = 96;
const SCALE = 2; // 2x for ~192 effective DPI
const PAGE_W_IN = 8.5;
const PAGE_H_IN = 11;
const MARGIN_IN = 0.5;
const CELL_BORDER_PX = 2;
const LABEL_LINE_HEIGHT = 1.12;
const LABEL_LINES_PER_NAME = 2;
const SCI_LABEL_BOTTOM_PAD_PX = 1;
const PDF_FILENAME_FALLBACK = "inat_bingo_cards.pdf";
const PDF_TITLE_FILENAME_MAX_LENGTH = 80;

export function getPdfFilename(title) {
  const safeTitle = String(title || "")
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9_-]+/g, " ")
    .replace(/\s+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, PDF_TITLE_FILENAME_MAX_LENGTH)
    .replace(/^_+|_+$/g, "");

  if (!safeTitle) return PDF_FILENAME_FALLBACK;

  return `inat_bingo_cards_${safeTitle}.pdf`;
}

function getProxiedImageUrl(imageUrl) {
  if (!imageUrl) return "";

  const proxiedUrl = new URL(PDF_IMAGE_PROXY_BASE);
  proxiedUrl.searchParams.set("url", imageUrl);
  proxiedUrl.searchParams.set("w", String(PDF_IMAGE_SIZE_PX));
  proxiedUrl.searchParams.set("h", String(PDF_IMAGE_SIZE_PX));
  proxiedUrl.searchParams.set("fit", "cover");
  proxiedUrl.searchParams.set("output", "jpg");
  return proxiedUrl.toString();
}

function getTwoLineLabelHeight(commonFontSize, sciFontSize, commonOn, sciOn) {
  const commonHeight = commonOn
    ? Math.ceil(commonFontSize * LABEL_LINE_HEIGHT * LABEL_LINES_PER_NAME)
    : 0;
  const sciHeight = sciOn
    ? Math.ceil(sciFontSize * LABEL_LINE_HEIGHT * LABEL_LINES_PER_NAME) +
      SCI_LABEL_BOTTOM_PAD_PX
    : 0;

  return commonHeight + sciHeight;
}

export function getCellLayout(cellWidth, cellHeight, options) {
  const { photoOn, commonOn, sciOn } = options;
  const hasText = commonOn || sciOn;
  const padding = Math.max(3, Math.floor(cellWidth * 0.035));
  const contentWidth = Math.max(0, cellWidth - padding * 2 - CELL_BORDER_PX);
  const contentHeight = Math.max(0, cellHeight - padding * 2 - CELL_BORDER_PX);
  const gap = photoOn && hasText ? Math.max(2, Math.floor(cellWidth * 0.02)) : 0;
  const commonFontSize = Math.max(7, Math.min(13, Math.floor(cellWidth / 13)));
  const sciFontSize = Math.max(6, Math.min(11, Math.floor(cellWidth / 16)));

  if (!photoOn || !hasText) {
    return {
      padding,
      gap,
      commonFontSize,
      sciFontSize,
      imageSize: photoOn ? Math.min(contentWidth, contentHeight) : 0,
      labelHeight: hasText ? contentHeight : 0,
    };
  }

  const minLabelHeight = Math.min(
    contentHeight,
    getTwoLineLabelHeight(commonFontSize, sciFontSize, commonOn, sciOn)
  );
  const imageSize = Math.min(
    contentWidth,
    Math.max(0, contentHeight - gap - minLabelHeight)
  );
  const labelHeight = Math.max(0, contentHeight - imageSize - gap);

  return {
    padding,
    gap,
    commonFontSize,
    sciFontSize,
    imageSize: Math.floor(imageSize),
    labelHeight: Math.floor(labelHeight),
  };
}

function applyLineClamp(element, lineCount) {
  element.style.display = "-webkit-box";
  element.style.setProperty("-webkit-box-orient", "vertical");
  element.style.setProperty("-webkit-line-clamp", String(lineCount));
  element.style.overflow = "hidden";
  element.style.flex = "0 0 auto";
}

function fitTextBlocks(container) {
  const blocks = container.querySelectorAll(".species-labels");

  blocks.forEach((block) => {
    const textEls = block.querySelectorAll(".species-label");
    let guard = 0;

    while (block.scrollHeight > block.clientHeight && guard < 8) {
      textEls.forEach((el) => {
        const current = Number.parseFloat(el.style.fontSize);
        if (current > 6) {
          el.style.fontSize = `${current - 1}px`;
        }
      });
      guard += 1;
    }
  });
}

/**
 * Wait for all images in a container to finish loading.
 */
function waitForImages(container) {
  const imgs = container.querySelectorAll("img");
  const promises = Array.from(imgs).map(
    (img) =>
      new Promise((resolve) => {
        if (img.complete) {
          resolve(img.naturalWidth > 0);
          return;
        }

        img.onload = () => resolve(true);
        img.onerror = () => {
          img.remove();
          resolve(false);
        };
      })
  );
  return Promise.all(promises);
}

/**
 * Render a single card into a DOM element sized for PDF capture.
 */
function renderPdfCard(grid, gridSize, options, title) {
  const { photoOn, commonOn, sciOn } = options;

  const pageW = PAGE_W_IN * DPI;
  const pageH = PAGE_H_IN * DPI;
  const margin = MARGIN_IN * DPI;
  const usableW = pageW - 2 * margin;
  const titleHeight = 60;
  const usableH = pageH - 2 * margin - titleHeight;
  const cellWidth = Math.floor(usableW / gridSize);
  const cellHeight = Math.floor(usableH / gridSize);
  const layout = getCellLayout(cellWidth, cellHeight, options);

  // Page wrapper
  const page = document.createElement("div");
  page.className = "pdf-card-page";
  page.style.width = pageW + "px";
  page.style.height = pageH + "px";
  page.style.padding = margin + "px";
  page.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

  // Title
  const titleEl = document.createElement("div");
  titleEl.className = "pdf-card-title";
  titleEl.textContent = title;
  page.appendChild(titleEl);

  // Card grid
  const gridW = cellWidth * gridSize;
  const gridH = cellHeight * gridSize;

  const card = document.createElement("div");
  card.className = "pdf-card";
  card.style.display = "grid";
  card.style.gridTemplateColumns = `repeat(${gridSize}, ${cellWidth}px)`;
  card.style.gridTemplateRows = `repeat(${gridSize}, ${cellHeight}px)`;
  card.style.width = gridW + "px";
  card.style.height = gridH + "px";
  card.style.margin = "0 auto";

  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const cellData = grid[r][c];
      const cell = document.createElement("div");
      cell.className = "bingo-cell";
      cell.style.border = "1px solid #999";
      cell.style.display = "flex";
      cell.style.flexDirection = "column";
      cell.style.alignItems = "center";
      cell.style.justifyContent = "center";
      cell.style.textAlign = "center";
      cell.style.gap = `${layout.gap}px`;
      cell.style.padding = `${layout.padding}px`;
      cell.style.overflow = "hidden";
      cell.style.minWidth = "0";
      cell.style.minHeight = "0";

      if (cellData === "FREE") {
        cell.style.fontSize = "1.2em";
        cell.style.fontWeight = "700";
        cell.style.color = "#2c6b2f";
        cell.textContent = "FREE";
      } else {
        const proxiedImageUrl = getProxiedImageUrl(cellData.imageUrl);

        if (photoOn && proxiedImageUrl && layout.imageSize > 0) {
          const img = document.createElement("img");
          img.crossOrigin = "anonymous";
          img.src = proxiedImageUrl;
          img.style.width = `${layout.imageSize}px`;
          img.style.height = `${layout.imageSize}px`;
          img.style.maxWidth = "100%";
          img.style.objectFit = "cover";
          img.style.borderRadius = "2px";
          img.style.display = "block";
          img.style.flex = "0 0 auto";
          cell.style.justifyContent = "flex-start";
          cell.appendChild(img);
        }

        if ((commonOn && cellData.commonName) || (sciOn && cellData.scientificName)) {
          const labels = document.createElement("div");
          labels.className = "species-labels";
          labels.style.display = "flex";
          labels.style.flex = `0 0 ${layout.labelHeight}px`;
          labels.style.flexDirection = "column";
          labels.style.justifyContent = "center";
          labels.style.alignItems = "center";
          labels.style.width = "100%";
          labels.style.minHeight = "0";
          labels.style.overflow = "hidden";

          if (commonOn && cellData.commonName) {
            const span = document.createElement("div");
            span.className = "species-label";
            span.style.fontSize = `${layout.commonFontSize}px`;
            span.style.fontWeight = "600";
            span.style.lineHeight = String(LABEL_LINE_HEIGHT);
            span.style.overflowWrap = "break-word";
            span.style.maxWidth = "100%";
            span.textContent = cellData.commonName;
            applyLineClamp(span, LABEL_LINES_PER_NAME);
            labels.appendChild(span);
          }

          if (sciOn && cellData.scientificName) {
            const span = document.createElement("div");
            span.className = "species-label";
            span.style.fontSize = `${layout.sciFontSize}px`;
            span.style.fontStyle = "italic";
            span.style.lineHeight = String(LABEL_LINE_HEIGHT);
            span.style.color = "#555";
            span.style.overflowWrap = "break-word";
            span.style.maxWidth = "100%";
            span.style.paddingBottom = `${SCI_LABEL_BOTTOM_PAD_PX}px`;
            span.textContent = cellData.scientificName;
            applyLineClamp(span, LABEL_LINES_PER_NAME);
            labels.appendChild(span);
          }

          cell.appendChild(labels);
        }
      }

      card.appendChild(cell);
    }
  }

  page.appendChild(card);
  return page;
}

/**
 * Generate a PDF from an array of bingo card grids.
 * @param {Array<Array<Array>>} cards - Array of grids
 * @param {number} gridSize
 * @param {object} options - { photoOn, commonOn, sciOn }
 * @param {string} title
 * @param {function} onProgress - Called with (current, total)
 * @returns {Promise<Blob>} PDF blob
 */
export async function generatePdf(cards, gridSize, options, title, onProgress) {
  const { jsPDF } = jspdf;
  const pdf = new jsPDF({ orientation: "portrait", unit: "in", format: "letter" });

  const renderArea = document.getElementById("pdf-render-area");

  for (let i = 0; i < cards.length; i++) {
    if (i > 0) pdf.addPage();

    const pageEl = renderPdfCard(cards[i], gridSize, options, title);
    renderArea.appendChild(pageEl);

    await waitForImages(pageEl);
    fitTextBlocks(pageEl);
    // Small delay to allow browser to paint
    await new Promise((r) => setTimeout(r, 50));

    const canvas = await html2canvas(pageEl, {
      scale: SCALE,
      useCORS: true,
      allowTaint: false,
      backgroundColor: "#ffffff",
    });

    const imgData = canvas.toDataURL("image/jpeg", 0.92);
    pdf.addImage(imgData, "JPEG", 0, 0, PAGE_W_IN, PAGE_H_IN);

    renderArea.removeChild(pageEl);

    if (onProgress) onProgress(i + 1, cards.length);
  }

  return pdf.output("blob");
}
