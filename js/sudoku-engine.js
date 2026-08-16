/* ==========================================================================
   sudoku-engine.js — pure puzzle logic, no DOM. Kept separate from sudoku.js
   (which handles rendering/interaction) so the generation algorithm is easy
   to test and reason about on its own.
   ========================================================================== */

const SudokuEngine = (() => {
  const SIZE = 9;
  const BOX = 3;

  function emptyGrid() {
    return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
  }

  function shuffledDigits() {
    const d = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    for (let i = d.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [d[i], d[j]] = [d[j], d[i]];
    }
    return d;
  }

  function isSafe(grid, row, col, val) {
    for (let i = 0; i < SIZE; i++) {
      if (grid[row][i] === val || grid[i][col] === val) return false;
    }
    const br = row - (row % BOX), bc = col - (col % BOX);
    for (let r = 0; r < BOX; r++) {
      for (let c = 0; c < BOX; c++) {
        if (grid[br + r][bc + c] === val) return false;
      }
    }
    return true;
  }

  // Fills an empty grid into a complete, valid, randomized solved Sudoku.
  function generateSolved() {
    const grid = emptyGrid();
    fillCell(grid, 0);
    return grid;
  }

  function fillCell(grid, pos) {
    if (pos === SIZE * SIZE) return true;
    const row = Math.floor(pos / SIZE), col = pos % SIZE;
    if (grid[row][col] !== 0) return fillCell(grid, pos + 1);
    for (const val of shuffledDigits()) {
      if (isSafe(grid, row, col, val)) {
        grid[row][col] = val;
        if (fillCell(grid, pos + 1)) return true;
        grid[row][col] = 0;
      }
    }
    return false;
  }

  // Counts solutions up to `limit` (we only ever need to know if it's exactly 1).
  function countSolutions(grid, limit) {
    const g = grid.map((r) => r.slice());
    let count = 0;
    function solve(pos) {
      if (count >= limit) return;
      if (pos === SIZE * SIZE) { count++; return; }
      const row = Math.floor(pos / SIZE), col = pos % SIZE;
      if (g[row][col] !== 0) { solve(pos + 1); return; }
      for (let val = 1; val <= 9; val++) {
        if (isSafe(g, row, col, val)) {
          g[row][col] = val;
          solve(pos + 1);
          g[row][col] = 0;
          if (count >= limit) return;
        }
      }
    }
    solve(0);
    return count;
  }

  // Removes cells from a solved grid down to ~targetClues while preserving a
  // unique solution. maxAttempts guards generation time on low-end phones.
  function carvePuzzle(solved, targetClues, maxAttempts) {
    const puzzle = solved.map((r) => r.slice());
    const cells = [];
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) cells.push([r, c]);
    // shuffle cell removal order
    for (let i = cells.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cells[i], cells[j]] = [cells[j], cells[i]];
    }

    let clues = SIZE * SIZE;
    let attempts = 0;
    for (const [r, c] of cells) {
      if (clues <= targetClues || attempts >= maxAttempts) break;
      attempts++;
      const backup = puzzle[r][c];
      if (backup === 0) continue;
      puzzle[r][c] = 0;
      const solutions = countSolutions(puzzle, 2);
      if (solutions !== 1) {
        puzzle[r][c] = backup; // not unique — put it back
      } else {
        clues--;
      }
    }
    return puzzle;
  }

  const DIFFICULTY = {
    easy: { label: "Mudah", clues: 40, maxAttempts: 60, baseScore: 500 },
    medium: { label: "Sederhana", clues: 32, maxAttempts: 60, baseScore: 800 },
    hard: { label: "Sukar", clues: 27, maxAttempts: 60, baseScore: 1200 },
  };

  function generatePuzzle(difficultyKey) {
    const diff = DIFFICULTY[difficultyKey] || DIFFICULTY.easy;
    const solved = generateSolved();
    const puzzle = carvePuzzle(solved, diff.clues, diff.maxAttempts);
    return { puzzle, solution: solved, difficulty: difficultyKey };
  }

  return { generatePuzzle, DIFFICULTY, isSafe };
})();
