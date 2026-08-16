/* ==========================================================================
   wordsearch-engine.js — pure puzzle logic, no DOM. Split from wordsearch.js
   (rendering/interaction) so placement and drag-math are easy to unit test.
   ========================================================================== */

const WordSearchEngine = (() => {
  const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  // All 8 straight-line directions: horizontal, vertical, both diagonals — forward and reverse.
  const DIRECTIONS = [
    [0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1],
  ];

  function normalizeWord(word) {
    return String(word || "").toUpperCase().replace(/[^A-Z]/g, "");
  }

  function emptyGrid(size) {
    return Array.from({ length: size }, () => Array(size).fill(""));
  }

  /**
   * Places as many words as possible into a `size`x`size` grid, longest
   * first (easiest to place, and gives shorter words more room to fit
   * afterward). Any word that can't be placed after maxAttempts is simply
   * left out of the returned puzzle — so the puzzle's own word list
   * (puzzle.placed) is ALWAYS 100% solvable, per the brief's requirement
   * to validate solvability before showing the puzzle.
   */
  function generatePuzzle(rawWords, size, maxAttemptsPerWord) {
    const attempts = maxAttemptsPerWord || 200;
    const grid = emptyGrid(size);
    const words = rawWords
      .map(normalizeWord)
      .filter((w) => w.length >= 3 && w.length <= size)
      .sort((a, b) => b.length - a.length);

    const placed = [];

    words.forEach((word) => {
      for (let attempt = 0; attempt < attempts; attempt++) {
        const [dr, dc] = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
        const maxStartRow = dr >= 0 ? size - (dr === 1 ? word.length : 1) : size - 1;
        const startRow = Math.floor(Math.random() * size);
        const startCol = Math.floor(Math.random() * size);
        const cells = [];
        let ok = true;

        for (let i = 0; i < word.length; i++) {
          const r = startRow + dr * i;
          const c = startCol + dc * i;
          if (r < 0 || r >= size || c < 0 || c >= size) { ok = false; break; }
          const existing = grid[r][c];
          if (existing && existing !== word[i]) { ok = false; break; }
          cells.push([r, c]);
        }
        if (!ok) continue;

        cells.forEach(([r, c], i) => { grid[r][c] = word[i]; });
        placed.push({ word, cells });
        return; // success — move to next word
      }
      // couldn't place this word within the attempt budget — it's simply excluded
    });

    // Fill remaining empty cells with random letters
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!grid[r][c]) grid[r][c] = LETTERS[Math.floor(Math.random() * LETTERS.length)];
      }
    }

    return { grid, size, placed };
  }

  /**
   * Resolves a drag from (startRow,startCol) to (curRow,curCol) into a
   * straight 8-direction line, tolerating slightly imprecise touch input.
   * Returns { cells: [[r,c],...] } or null if the drag hasn't moved yet.
   */
  function resolveDragLine(startRow, startCol, curRow, curCol) {
    const dRow = curRow - startRow;
    const dCol = curCol - startCol;
    if (dRow === 0 && dCol === 0) return { cells: [[startRow, startCol]] };

    let dr, dc, length;
    if (dRow === 0) {
      dr = 0; dc = Math.sign(dCol); length = Math.abs(dCol);
    } else if (dCol === 0) {
      dc = 0; dr = Math.sign(dRow); length = Math.abs(dRow);
    } else if (Math.abs(dRow) === Math.abs(dCol)) {
      dr = Math.sign(dRow); dc = Math.sign(dCol); length = Math.abs(dRow);
    } else if (Math.abs(dRow) > Math.abs(dCol) * 1.5) {
      dr = Math.sign(dRow); dc = 0; length = Math.abs(dRow);
    } else if (Math.abs(dCol) > Math.abs(dRow) * 1.5) {
      dr = 0; dc = Math.sign(dCol); length = Math.abs(dCol);
    } else {
      const len = Math.min(Math.abs(dRow), Math.abs(dCol));
      dr = Math.sign(dRow); dc = Math.sign(dCol); length = len;
    }

    const cells = [];
    for (let i = 0; i <= length; i++) cells.push([startRow + dr * i, startCol + dc * i]);
    return { cells };
  }

  function sameCellSet(a, b) {
    if (a.length !== b.length) return false;
    const forward = a.every((cell, i) => cell[0] === b[i][0] && cell[1] === b[i][1]);
    const reverse = a.every((cell, i) => cell[0] === b[b.length - 1 - i][0] && cell[1] === b[b.length - 1 - i][1]);
    return forward || reverse;
  }

  function matchWord(selectedCells, placedWords) {
    return placedWords.find((p) => !p.found && sameCellSet(p.cells, selectedCells)) || null;
  }

  return { normalizeWord, generatePuzzle, resolveDragLine, sameCellSet, matchWord, DIRECTIONS };
})();
