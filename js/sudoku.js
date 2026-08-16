/* ==========================================================================
   sudoku.js — Merdeka Sudoku: classic 9x9 logic (clearest, most reliable
   mobile UX), themed via the app's visual design rather than reskinned
   symbols, per the brief's own "prefer best mobile UX" guidance.

   Mistake detection is rule-based (row/col/3x3-box conflicts), which is
   the standard, well-understood way Sudoku apps give immediate feedback —
   and since every generated puzzle has a unique solution, a fully filled
   grid with zero conflicts is guaranteed to BE that solution.
   ========================================================================== */

const Sudoku = (() => {
  const HINT_LIMIT = 3;
  let state = null;
  let timerInterval = null;

  // ---------- Entry point ----------
  function open() {
    renderDifficultyPicker();
  }

  function renderDifficultyPicker() {
    const savedName = localStorage.getItem(APP_CONFIG.STORAGE_KEYS.NICKNAME) || "";
    const cards = Object.entries(SudokuEngine.DIFFICULTY).map(([key, d]) => `
      <button class="diff-card" data-key="${key}">
        <div class="diff-label">${d.label}</div>
        <div class="diff-sub">${81 - d.clues} petak kosong</div>
      </button>
    `).join("");

    UI.render(`
      <div class="panel pop-in">
        <div class="section-title">🇲🇾 Merdeka Sudoku</div>
        <div class="field">
          <label for="sudoku-nickname">Nama Panggilan</label>
          <input type="text" id="sudoku-nickname" maxlength="24" placeholder="cth. Amir" value="${escapeHtml(savedName)}" autocomplete="off">
        </div>
        <label style="display:block;font-size:13px;color:var(--ink-soft);margin-bottom:8px;">Pilih Tahap Kesukaran</label>
        <div class="diff-grid">${cards}</div>
      </div>
    `);

    document.querySelectorAll(".diff-card").forEach((btn) => {
      btn.addEventListener("click", () => {
        const nickname = document.getElementById("sudoku-nickname").value.trim();
        if (!nickname) { UI.toast("Sila masukkan nama panggilan anda."); return; }
        localStorage.setItem(APP_CONFIG.STORAGE_KEYS.NICKNAME, nickname);
        startGame(btn.dataset.key, nickname);
      });
    });
  }

  async function startGame(difficultyKey, nickname) {
    const { puzzle, solution } = await Loading.during(
      () => new Promise((resolve) => {
        // Generation is synchronous/CPU-bound; yield a frame first so the
        // loading overlay actually paints before the main thread blocks.
        requestAnimationFrame(() => setTimeout(() => resolve(SudokuEngine.generatePuzzle(difficultyKey)), 0));
      }),
      "Menyediakan teka-teki..."
    );

    const given = puzzle.map((row) => row.map((v) => v !== 0));
    state = {
      nickname,
      difficultyKey,
      puzzle,
      solution,
      given,
      grid: puzzle.map((r) => r.slice()),
      selected: null,
      mistakes: 0,
      hintsUsed: 0,
      startedAt: Date.now(),
      paused: false,
      finished: false,
    };
    renderGame();
    startTimer();
  }

  // ---------- Rendering ----------
  function renderGame() {
    const diff = SudokuEngine.DIFFICULTY[state.difficultyKey];
    UI.render(`
      <div class="sudoku-topbar">
        <div class="sudoku-stat"><span class="lbl">MASA</span><span class="val mono" id="sudoku-timer">00:00</span></div>
        <div class="sudoku-stat"><span class="lbl">SILAP</span><span class="val mono" id="sudoku-mistakes">0</span></div>
        <div class="sudoku-stat"><span class="lbl">PETUNJUK</span><span class="val mono" id="sudoku-hints">${HINT_LIMIT}</span></div>
        <button class="icon-btn" id="sudoku-pause" aria-label="Jeda">⏸</button>
      </div>

      <div class="panel" style="position:relative;">
        <div class="sudoku-grid" id="sudoku-grid" aria-label="Papan Sudoku ${diff.label}"></div>
        <div id="pause-overlay" class="pause-overlay hidden">
          <div class="emoji">⏸️</div>
          <div style="font-family:var(--font-display);font-size:18px;margin-bottom:14px;">DIJEDA</div>
          <button class="btn btn-gold" id="resume-btn">SAMBUNG BERMAIN</button>
        </div>

        <div class="keypad" id="sudoku-keypad"></div>

        <div class="btn-row" style="margin-top:16px;">
          <button class="btn btn-outline" id="sudoku-hint-btn">💡 PETUNJUK</button>
          <button class="btn btn-outline" id="sudoku-reset-btn">↺ RESET</button>
        </div>
      </div>
    `);

    buildGridDom();
    buildKeypadDom();
    updateHud();

    document.getElementById("sudoku-pause").addEventListener("click", togglePause);
    document.getElementById("resume-btn").addEventListener("click", togglePause);
    document.getElementById("sudoku-hint-btn").addEventListener("click", useHint);
    document.getElementById("sudoku-reset-btn").addEventListener("click", confirmReset);
  }

  function buildGridDom() {
    const grid = document.getElementById("sudoku-grid");
    grid.innerHTML = "";
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const cell = document.createElement("button");
        cell.className = "sudoku-cell";
        cell.dataset.r = r; cell.dataset.c = c;
        if ((c === 2 || c === 5)) cell.classList.add("border-right");
        if ((r === 2 || r === 5)) cell.classList.add("border-bottom");
        if (state.given[r][c]) cell.classList.add("given");
        cell.textContent = state.grid[r][c] || "";
        cell.setAttribute("aria-label", `Baris ${r + 1}, Lajur ${c + 1}`);
        cell.addEventListener("click", () => selectCell(r, c));
        grid.appendChild(cell);
      }
    }
  }

  function buildKeypadDom() {
    const keypad = document.getElementById("sudoku-keypad");
    keypad.innerHTML = "";
    for (let n = 1; n <= 9; n++) {
      const b = document.createElement("button");
      b.className = "key-btn"; b.textContent = n; b.dataset.n = n;
      b.addEventListener("click", () => inputNumber(n));
      keypad.appendChild(b);
    }
    const erase = document.createElement("button");
    erase.className = "key-btn key-erase"; erase.textContent = "⌫";
    erase.addEventListener("click", () => inputNumber(0));
    keypad.appendChild(erase);
  }

  function selectCell(r, c) {
    if (state.paused || state.finished) return;
    state.selected = { r, c };
    refreshCellStyles();
  }

  function refreshCellStyles() {
    document.querySelectorAll(".sudoku-cell").forEach((cell) => {
      const r = Number(cell.dataset.r), c = Number(cell.dataset.c);
      cell.classList.toggle("selected", !!state.selected && state.selected.r === r && state.selected.c === c);
    });
  }

  // ---------- Gameplay ----------
  function inputNumber(n) {
    if (state.paused || state.finished || !state.selected) {
      if (!state.selected) UI.toast("Pilih petak dahulu.");
      return;
    }
    const { r, c } = state.selected;
    if (state.given[r][c]) return;

    state.grid[r][c] = n;
    const cellEl = document.querySelector(`.sudoku-cell[data-r="${r}"][data-c="${c}"]`);
    cellEl.classList.remove("wrong", "hint");
    cellEl.textContent = n || "";

    if (n === 0) { refreshConflicts(); return; }

    if (hasConflict(r, c, n)) {
      state.mistakes++;
      cellEl.classList.add("wrong", "shake");
      setTimeout(() => cellEl.classList.remove("shake"), 400);
      document.getElementById("sudoku-mistakes").textContent = state.mistakes;
    }
    refreshConflicts();
    checkCompletion();
  }

  function hasConflict(r, c, val) {
    for (let i = 0; i < 9; i++) {
      if (i !== c && state.grid[r][i] === val) return true;
      if (i !== r && state.grid[i][c] === val) return true;
    }
    const br = r - (r % 3), bc = c - (c % 3);
    for (let rr = 0; rr < 3; rr++) {
      for (let cc = 0; cc < 3; cc++) {
        const gr = br + rr, gc = bc + cc;
        if ((gr !== r || gc !== c) && state.grid[gr][gc] === val) return true;
      }
    }
    return false;
  }

  // Re-derive which filled cells currently conflict (covers the case where
  // fixing one cell resolves a conflict on a previously-flagged neighbour).
  function refreshConflicts() {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (state.given[r][c]) continue;
        const val = state.grid[r][c];
        const cellEl = document.querySelector(`.sudoku-cell[data-r="${r}"][data-c="${c}"]`);
        if (!cellEl || cellEl.classList.contains("hint")) continue;
        if (val && hasConflict(r, c, val)) cellEl.classList.add("wrong");
        else cellEl.classList.remove("wrong");
      }
    }
  }

  function useHint() {
    if (state.paused || state.finished) return;
    if (state.hintsUsed >= HINT_LIMIT) { UI.toast("Petunjuk telah habis digunakan."); return; }
    if (!state.selected) { UI.toast("Pilih petak kosong dahulu."); return; }
    const { r, c } = state.selected;
    if (state.given[r][c]) { UI.toast("Petak ini sudah diisi."); return; }

    const correct = state.solution[r][c];
    state.grid[r][c] = correct;
    state.hintsUsed++;
    const cellEl = document.querySelector(`.sudoku-cell[data-r="${r}"][data-c="${c}"]`);
    cellEl.classList.remove("wrong");
    cellEl.classList.add("hint", "pop-in");
    cellEl.textContent = correct;
    document.getElementById("sudoku-hints").textContent = HINT_LIMIT - state.hintsUsed;
    checkCompletion();
  }

  function confirmReset() {
    UI.confirmDialog({
      title: "Reset Teka-teki?",
      message: "Semua jawapan yang dimasukkan akan dipadam. Masa terus berjalan.",
      confirmLabel: "RESET",
      cancelLabel: "BATAL",
    }).then((ok) => { if (ok) doReset(); });
  }

  function doReset() {
    state.grid = state.puzzle.map((r) => r.slice());
    state.mistakes = 0;
    state.hintsUsed = 0;
    state.selected = null;
    buildGridDom();
    updateHud();
  }

  function checkCompletion() {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (!state.grid[r][c] || hasConflict(r, c, state.grid[r][c])) return;
      }
    }
    finishGame();
  }

  // ---------- Timer / pause ----------
  function startTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      if (state.paused || state.finished) return;
      const el = document.getElementById("sudoku-timer");
      if (el) el.textContent = formatDuration(elapsedSeconds());
    }, 1000);
  }

  function elapsedSeconds() {
    return Math.round((Date.now() - state.startedAt) / 1000);
  }

  function togglePause() {
    if (!state || state.finished) return;
    state.paused = !state.paused;
    document.getElementById("pause-overlay").classList.toggle("hidden", !state.paused);
  }

  function updateHud() {
    document.getElementById("sudoku-timer").textContent = formatDuration(elapsedSeconds());
    document.getElementById("sudoku-mistakes").textContent = state.mistakes;
    document.getElementById("sudoku-hints").textContent = HINT_LIMIT - state.hintsUsed;
  }

  // ---------- Result ----------
  async function finishGame() {
    state.finished = true;
    clearInterval(timerInterval);
    const timeTakenSec = elapsedSeconds();
    const diff = SudokuEngine.DIFFICULTY[state.difficultyKey];
    const score = Math.max(50, diff.baseScore - state.mistakes * 15 - state.hintsUsed * 40 - Math.floor(timeTakenSec / 3));

    try {
      await Loading.during(() => Api.submitScore({
        nickname: state.nickname,
        game: "sudoku",
        score,
        timeTakenSec,
        difficulty: diff.label,
      }), "Menyimpan keputusan...");
    } catch (e) {
      UI.toast("Keputusan tidak dapat disimpan ke pelayan, tetapi berikut skor anda.");
    }

    UI.render(`
      <div class="result-hero pop-in">
        ${Star.markup("badge-lg")}
        <h2 style="margin-bottom:2px;">TAHNIAH! 🇲🇾</h2>
        <div class="score-big">${score}</div>
        <div class="score-pct">Anda berjaya menyelesaikan Merdeka Sudoku (${diff.label})</div>
      </div>
      <div class="stat-grid">
        <div class="stat-cell"><div class="val mono">${formatDuration(timeTakenSec)}</div><div class="lbl">Masa</div></div>
        <div class="stat-cell"><div class="val mono">${state.mistakes}</div><div class="lbl">Kesilapan</div></div>
        <div class="stat-cell"><div class="val mono">${state.hintsUsed}</div><div class="lbl">Petunjuk</div></div>
      </div>
      <div class="btn-row" style="margin-bottom:10px;">
        <button class="btn btn-outline" id="btn-lb">PAPAN PENDAHULU</button>
        <button class="btn btn-gold" id="btn-again">MAIN LAGI</button>
      </div>
      <button class="btn btn-primary" id="btn-menu">PILIH PERMAINAN LAIN</button>
    `);

    Confetti.burst();
    document.getElementById("btn-menu").addEventListener("click", () => App.goHome());
    document.getElementById("btn-lb").addEventListener("click", () => Dashboard.open("leaderboard", "sudoku"));
    document.getElementById("btn-again").addEventListener("click", () => {
      const nickname = state.nickname, key = state.difficultyKey;
      state = null;
      startGame(key, nickname);
    });
    state = null;
  }

  // ---------- Helpers ----------
  function formatDuration(sec) {
    const m = Math.floor(sec / 60).toString().padStart(2, "0");
    const s = (sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str ?? "";
    return div.innerHTML;
  }

  function isInProgress() { return !!state && !state.finished; }

  function reset() {
    clearInterval(timerInterval);
    state = null;
  }

  return { open, isInProgress, reset };
})();
