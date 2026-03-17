/**
 * PDF generation using html2canvas + jsPDF.
 * Renders each bingo card at letter-size proportions, captures at 2x, assembles PDF.
 */

/* global jspdf, html2canvas */

const DPI = 96;
const SCALE = 2; // 2x for ~192 effective DPI
const PAGE_W_IN = 8.5;
const PAGE_H_IN = 11;
const MARGIN_IN = 0.5;

/**
 * Wait for all images in a container to finish loading.
 */
function waitForImages(container) {
  const imgs = container.querySelectorAll("img");
  const promises = Array.from(imgs).map(
    (img) =>
      new Promise((resolve) => {
        if (img.complete) return resolve();
        img.onload = resolve;
        img.onerror = resolve;
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
  const titleHeight = 48;
  const usableH = pageH - 2 * margin - titleHeight;

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
  const cellSize = Math.floor(Math.min(usableW / gridSize, usableH / gridSize));
  const gridW = cellSize * gridSize;

  const card = document.createElement("div");
  card.className = "pdf-card";
  card.style.display = "grid";
  card.style.gridTemplateColumns = `repeat(${gridSize}, ${cellSize}px)`;
  card.style.gridTemplateRows = `repeat(${gridSize}, ${cellSize}px)`;
  card.style.width = gridW + "px";
  card.style.margin = "0 auto";
  card.style.border = "2px solid #333";

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
      cell.style.padding = "2px";
      cell.style.overflow = "hidden";

      if (cellData === "FREE") {
        cell.style.fontSize = "1.2em";
        cell.style.fontWeight = "700";
        cell.style.color = "#2c6b2f";
        cell.textContent = "FREE";
      } else {
        if (photoOn && cellData.imageUrl) {
          const img = document.createElement("img");
          img.crossOrigin = "anonymous";
          img.src = cellData.imageUrl;
          img.style.width = "80%";
          img.style.aspectRatio = "1";
          img.style.objectFit = "cover";
          img.style.borderRadius = "2px";
          img.style.display = "block";
          cell.appendChild(img);
        }
        if (commonOn && cellData.commonName) {
          const span = document.createElement("div");
          span.style.fontSize = Math.max(8, Math.floor(cellSize / 12)) + "px";
          span.style.fontWeight = "600";
          span.style.lineHeight = "1.2";
          span.style.marginTop = "1px";
          span.style.wordBreak = "break-word";
          span.textContent = cellData.commonName;
          cell.appendChild(span);
        }
        if (sciOn && cellData.scientificName) {
          const span = document.createElement("div");
          span.style.fontSize = Math.max(7, Math.floor(cellSize / 14)) + "px";
          span.style.fontStyle = "italic";
          span.style.lineHeight = "1.2";
          span.style.color = "#555";
          span.style.wordBreak = "break-word";
          span.textContent = cellData.scientificName;
          cell.appendChild(span);
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
