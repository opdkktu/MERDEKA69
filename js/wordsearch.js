/* ==========================================================================
   wordsearch.js — Merdeka Word Search: drag-to-select grid using Pointer
   Events (unifies touch/mouse/pen — no separate touch/mouse code paths),
   with cell position derived from geometry (clientX/Y vs. the grid's
   bounding rect) rather than elementFromPoint, which stays reliable even
   while the pointer is captured mid-drag on mobile Safari/Chrome.
   ========================================================================== */

const WordSearch = (() => {
  const DIFFICULTY = {
    easy: { label: "Mudah", size: 10, wordCount: 6 },
    medium: { label: "Sederhana", size: 12, wordCount: 8 },
    hard: { label: "Sukar", size: 15, wordCount: 10 },
  };

  let state = null;
  let timerInterval = null;

  // ---------- Entry point ----------
  function open() {
    renderDifficultyPicker();
  }

  function renderDifficultyPicker() {
    const savedName = localStorage.getItem(APP_CONFIG.STORAGE_KEYS.NICKNAME) || "";
    const cards = Object.entries(DIFFICULTY).map(([key, d]) => `
      <button class="diff-card" data-key="${key}">
        <div class="diff-label">${d.label}</div>
        <div class="diff-sub">${d.size}×${d.size} · ${d.wordCount} perkataan</div>
      </button>
    `).join("");

    UI.render(`
      <div class="panel pop-in">
        <div class="section-title">🔎 Merdeka Word Search</div>
        <div class="field">
          <label for="ws-nickname">Nama Panggilan</label>
          <input type="text" id="ws-nickname" maxlength="24" placeholder="cth. Amir" value="${escapeHtml(savedName)}" autocomplete="off">
        </div>
        <label style="display:block;font-size:13px;color:var(--ink-soft);margin-bottom:8px;">Pilih Tahap Kesukaran</label>
        <div class="diff-grid">${cards}</div>
      </div>
    `);

    document.querySelectorAll(".diff-card").forEach((btn) => {
      btn.addEventListener("click", () => {
        const nickname = document.getElementById("ws-nickname").value.trim();
        if (!nickname) { UI.toast("Sila masukkan nama panggilan anda."); return; }
        localStorage.setItem(APP_CONFIG.STORAGE_KEYS.NICKNAME, nickname);
        startGame(btn.dataset.key, nickname);
      });
    });
  }

  async function startGame(difficultyKey, nickname) {
    const diff = DIFFICULTY[difficultyKey];
    try {
      const puzzle = await Loading.during(async () => {
        const rows = await Api.wordsearchWords(difficultyKey);
        const candidates = shuffle(rows.map((r) => r.word)).slice(0, diff.wordCount * 2);
        // Generation is CPU-bound; yield a frame first so the overlay paints.
        return new Promise((resolve) => requestAnimationFrame(() => setTimeout(() => {
          let built = WordSearchEngine.generatePuzzle(candidates, diff.size);
          if (built.placed.length < 3) {
            // extremely unlucky placement run — try once more before giving up
            built = WordSearchEngine.generatePuzzle(candidates, diff.size);
          }
          resolve(built);
        }, 0)));
      }, "Menjana teka-teki...");

      if (puzzle.placed.length === 0) throw new Error("Tidak dapat menjana teka-teki.");

      state = {
        nickname,
        difficultyKey,
        puzzle,
        placed: puzzle.placed.slice(0, diff.wordCount).map((p) => ({ ...p, found: false })),
        startedAt: Date.now(),
        finished: false,
        dragging: false,
        startCell: null,
        highlighted: [],
      };
      renderGame();
      startTimer();
    } catch (e) {
      UI.renderState({
        emoji: "😅",
        title: "Oops!",
        message: "Permainan tidak dapat dimuatkan sekarang. Sila cuba lagi.",
        actions: [
          { label: "CUBA LAGI", style: "btn-primary", onClick: () => startGame(difficultyKey, nickname) },
          { label: "KEMBALI KE MENU", style: "btn-outline", onClick: () => App.goHome() },
        ],
      });
    }
  }

  // ---------- Rendering ----------
  function renderGame() {
    const diff = DIFFICULTY[state.difficultyKey];
    UI.render(`
      <div class="sudoku-topbar">
        <div class="sudoku-stat"><span class="lbl">MASA</span><span class="val mono" id="ws-timer">00:00</span></div>
        <div class="sudoku-stat"><span class="lbl">DITEMUI</span><span class="val mono" id="ws-found-count">0 / ${state.placed.length}</span></div>
      </div>
      <div class="panel">
        <div class="ws-grid" id="ws-grid" style="--ws-size:${diff.size};" aria-label="Papan Cari Perkataan"></div>
        <div class="ws-wordlist" id="ws-wordlist"></div>
      </div>
    `);
    buildGridDom(diff.size);
    buildWordListDom();
  }

  function buildGridDom(size) {
    const gridEl = document.getElementById("ws-grid");
    gridEl.innerHTML = "";
    state.cellEls = [];
    for (let r = 0; r < size; r++) {
      const rowEls = [];
      for (let c = 0; c < size; c++) {
        const cell = document.createElement("div");
        cell.className = "ws-cell";
        cell.textContent = state.puzzle.grid[r][c];
        gridEl.appendChild(cell);
        rowEls.push(cell);
      }
      state.cellEls.push(rowEls);
    }

    gridEl.addEventListener("pointerdown", onPointerDown);
    gridEl.addEventListener("pointermove", onPointerMove);
    gridEl.addEventListener("pointerup", onPointerUp);
    gridEl.addEventListener("pointercancel", onPointerUp);
  }

  function buildWordListDom() {
    const wrap = document.getElementById("ws-wordlist");
    wrap.innerHTML = `
      <div class="section-title" style="margin-top:4px;">CARI PERKATAAN</div>
      <div class="word-chips" id="word-chips">
        ${state.placed.map((p, i) => `<div class="word-chip" id="chip-${i}">${p.found ? "✓" : "○"} ${p.word}</div>`).join("")}
      </div>
    `;
  }

  // ---------- Pointer / drag selection ----------
  function cellFromPoint(gridEl, size, clientX, clientY) {
    const rect = gridEl.getBoundingClientRect();
    const colW = rect.width / size, rowH = rect.height / size;
    const col = clamp(Math.floor((clientX - rect.left) / colW), 0, size - 1);
    const row = clamp(Math.floor((clientY - rect.top) / rowH), 0, size - 1);
    return { row, col };
  }

  function onPointerDown(e) {
    if (state.finished) return;
    const gridEl = e.currentTarget;
    const size = DIFFICULTY[state.difficultyKey].size;
    const { row, col } = cellFromPoint(gridEl, size, e.clientX, e.clientY);
    state.dragging = true;
    state.startCell = { row, col };
    try { gridEl.setPointerCapture(e.pointerId); } catch (err) { /* older browsers */ }
    paintHighlight([[row, col]]);
    e.preventDefault();
  }

  function onPointerMove(e) {
    if (!state.dragging) return;
    const gridEl = e.currentTarget;
    const size = DIFFICULTY[state.difficultyKey].size;
    const { row, col } = cellFromPoint(gridEl, size, e.clientX, e.clientY);
    const line = WordSearchEngine.resolveDragLine(state.startCell.row, state.startCell.col, row, col);
    paintHighlight(line.cells);
    e.preventDefault();
  }

  function onPointerUp(e) {
    if (!state.dragging) return;
    state.dragging = false;
    const selected = state.highlighted.slice();
    clearTempHighlight();

    const match = WordSearchEngine.matchWord(selected, state.placed);
    if (match) {
      match.found = true;
      match.cells.forEach(([r, c]) => state.cellEls[r][c].classList.add("found"));
      const idx = state.placed.indexOf(match);
      const chip = document.getElementById(`chip-${idx}`);
      if (chip) { chip.textContent = `✓ ${match.word}`; chip.classList.add("found"); }
      updateFoundCount();
      if (state.placed.every((p) => p.found)) finishGame();
    }
  }

  function paintHighlight(cells) {
    clearTempHighlight();
    state.highlighted = cells;
    cells.forEach(([r, c]) => {
      const el = state.cellEls[r] && state.cellEls[r][c];
      if (el && !el.classList.contains("found")) el.classList.add("selected");
    });
  }

  function clearTempHighlight() {
    (state.highlighted || []).forEach(([r, c]) => {
      const el = state.cellEls[r] && state.cellEls[r][c];
      if (el) el.classList.remove("selected");
    });
    state.highlighted = [];
  }

  function updateFoundCount() {
    const foundN = state.placed.filter((p) => p.found).length;
    document.getElementById("ws-found-count").textContent = `${foundN} / ${state.placed.length}`;
  }

  // ---------- Timer ----------
  function startTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      if (state.finished) return;
      const el = document.getElementById("ws-timer");
      if (el) el.textContent = formatDuration(elapsedSeconds());
    }, 1000);
  }

  function elapsedSeconds() { return Math.round((Date.now() - state.startedAt) / 1000); }

  // ---------- Result ----------
  async function finishGame() {
    state.finished = true;
    clearInterval(timerInterval);
    const timeTakenSec = elapsedSeconds();
    const diff = DIFFICULTY[state.difficultyKey];
    const score = Math.max(50, state.placed.length * 120 - Math.floor(timeTakenSec / 2));

    try {
      await Loading.during(() => Api.submitScore({
        nickname: state.nickname,
        game: "wordsearch",
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
        <div class="score-pct">Semua perkataan berjaya ditemui! (${diff.label})</div>
      </div>
      <div class="stat-grid">
        <div class="stat-cell"><div class="val mono">${formatDuration(timeTakenSec)}</div><div class="lbl">Masa</div></div>
        <div class="stat-cell"><div class="val mono">${state.placed.length}</div><div class="lbl">Perkataan</div></div>
        <div class="stat-cell"><div class="val mono">${score}</div><div class="lbl">Skor</div></div>
      </div>
      <div class="btn-row" style="margin-bottom:10px;">
        <button class="btn btn-outline" id="btn-lb">PAPAN PENDAHULU</button>
        <button class="btn btn-gold" id="btn-again">MAIN LAGI</button>
      </div>
      <button class="btn btn-primary" id="btn-menu">PILIH PERMAINAN LAIN</button>
    `);

    Confetti.burst();
    document.getElementById("btn-menu").addEventListener("click", () => App.goHome());
    document.getElementById("btn-lb").addEventListener("click", () => Dashboard.open("leaderboard", "wordsearch"));
    document.getElementById("btn-again").addEventListener("click", () => {
      const nickname = state.nickname, key = state.difficultyKey;
      state = null;
      startGame(key, nickname);
    });
    state = null;
  }

  // ---------- Helpers ----------
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

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

  // Exposed for testing/debugging only — returns a snapshot of the current
  // puzzle (word placements, grid). No sensitive data involved.
  function _debugState() { return state; }

  return { open, isInProgress, reset, _debugState };
})();
