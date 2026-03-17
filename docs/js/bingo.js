/**
 * Bingo card generation with seedable PRNG.
 * Ported from Python bingo_generator.py
 */

/**
 * Mulberry32 – a simple 32-bit seedable PRNG.
 * Returns a function that produces a float in [0, 1) on each call.
 */
function mulberry32(seed) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fisher-Yates shuffle using a supplied random() function.
 * Shuffles the array in-place and returns it.
 */
function shuffle(arr, random) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Build a single bingo grid.
 * @param {Array} speciesPool - Array of species objects
 * @param {number} gridSize - 3, 5, 7, or 9
 * @param {boolean} freeSquare - Whether to include a FREE center square
 * @param {number|null} seed - Random seed (null for Math.random)
 * @returns {Array<Array>} 2D grid where each cell is a species object or "FREE"
 */
export function buildGrid(speciesPool, gridSize, freeSquare, seed) {
  const random = seed !== null && seed !== undefined
    ? mulberry32(seed)
    : Math.random;

  const pool = [...speciesPool];
  shuffle(pool, random);

  const needed = gridSize * gridSize - (freeSquare ? 1 : 0);
  const cells = pool.slice(0, needed);

  const grid = [];
  let idx = 0;
  const center = Math.floor(gridSize / 2);

  for (let r = 0; r < gridSize; r++) {
    const row = [];
    for (let c = 0; c < gridSize; c++) {
      if (freeSquare && r === center && c === center) {
        row.push("FREE");
      } else {
        row.push(cells[idx++]);
      }
    }
    grid.push(row);
  }

  return grid;
}

/**
 * Generate multiple bingo cards.
 * @returns {Array<Array<Array>>} Array of grids
 */
export function generateCards(speciesPool, numCards, gridSize, freeSquare, baseSeed) {
  const cards = [];
  for (let i = 0; i < numCards; i++) {
    const seed = baseSeed !== null && baseSeed !== undefined ? baseSeed + i : null;
    cards.push(buildGrid(speciesPool, gridSize, freeSquare, seed));
  }
  return cards;
}
