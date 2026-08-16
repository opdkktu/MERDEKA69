/* ==========================================================================
   ui.js — app shell, view switching (SPA-style, no page reloads), home screen
   ========================================================================== */

const UI = (() => {
  let mainEl, headerActionsEl;

  function init() {
    const app = document.getElementById("app");
    app.innerHTML = `
      <header class="app-header">
        <div class="brand" id="brand-home-btn" role="button" tabindex="0" aria-label="Ke Laman Utama">
          ${Star.markup("brand-badge")}
          <span class="brand-title">MERDEKA MINI-GAMES</span>
        </div>
        <div class="header-actions" id="header-actions"></div>
      </header>
      <main class="view" id="view"></main>
      <footer class="app-footer">
        🇲🇾 <strong>Semangat Merdeka, Semangat Malaysia</strong><br>
        Merdeka Mini-Games
      </footer>
    `;
    mainEl = document.getElementById("view");
    headerActionsEl = document.getElementById("header-actions");
    headerActionsEl.innerHTML = `
      <button class="icon-btn" id="dashboard-btn" aria-label="Papan Pendahulu">🏆</button>
    `;
    document.getElementById("brand-home-btn").addEventListener("click", () => App.goHome());
    document.getElementById("brand-home-btn").addEventListener("keydown", (e) => {
      if (e.key === "Enter") App.goHome();
    });
    document.getElementById("dashboard-btn").addEventListener("click", () => Dashboard.open());
  }

  function render(html) {
    mainEl.innerHTML = `<div class="view-enter">${html}</div>`;
    mainEl.scrollTop = 0;
    try { window.scrollTo({ top: 0, behavior: "auto" }); } catch (e) { window.scrollTo(0, 0); }
  }

  function renderHome(config) {
    const quizLive = config?.games?.quiz !== false;
    const sudokuEnabled = config?.games?.sudoku === true;
    const wordsearchEnabled = config?.games?.wordsearch === true;
    render(`
      <section class="hero">
        ${Star.markup("hero-badge")}
        <h1>🇲🇾 MERDEKA MINI-GAMES</h1>
        <div class="subtitle-ms">Jom Raikan Merdeka Dengan Bermain!</div>
        <div class="subtitle-en">Celebrate Merdeka through fun and games!</div>
      </section>

      <div class="game-grid">
        <div class="game-card" id="card-quiz">
          <span class="badge-live"><span class="dot"></span>LIVE</span>
          <div class="icon">🧠</div>
          <h3>Merdeka Quiz</h3>
          <p>Uji pengetahuan anda tentang Malaysia dan Merdeka.</p>
          <button class="btn btn-primary" id="btn-quiz">MULA KUIZ</button>
        </div>

        <div class="game-card" id="card-sudoku">
          ${sudokuEnabled ? "" : `<span class="badge-soon">AKAN DATANG</span>`}
          <div class="icon">🇲🇾</div>
          <h3>Merdeka Sudoku</h3>
          <p>Susun nombor mengikut logik Sudoku bertema Merdeka.</p>
          <button class="btn ${sudokuEnabled ? "btn-primary" : "btn-outline"}" id="btn-sudoku" ${sudokuEnabled ? "" : "disabled"}>MAIN SEKARANG</button>
        </div>

        <div class="game-card" id="card-wordsearch">
          ${wordsearchEnabled ? "" : `<span class="badge-soon">AKAN DATANG</span>`}
          <div class="icon">🔎</div>
          <h3>Merdeka Word Search</h3>
          <p>Cari perkataan tersembunyi berkaitan Malaysia dan Merdeka.</p>
          <button class="btn ${wordsearchEnabled ? "btn-primary" : "btn-outline"}" id="btn-wordsearch" ${wordsearchEnabled ? "" : "disabled"}>MAIN SEKARANG</button>
        </div>
      </div>
    `);

    document.getElementById("btn-quiz").addEventListener("click", () => Quiz.open());
    document.getElementById("card-quiz").addEventListener("click", (e) => {
      if (e.target.id !== "btn-quiz") Quiz.open();
    });

    if (sudokuEnabled) {
      document.getElementById("btn-sudoku").addEventListener("click", () => Sudoku.open());
      document.getElementById("card-sudoku").addEventListener("click", (e) => {
        if (e.target.id !== "btn-sudoku") Sudoku.open();
      });
    }

    if (wordsearchEnabled) {
      document.getElementById("btn-wordsearch").addEventListener("click", () => WordSearch.open());
      document.getElementById("card-wordsearch").addEventListener("click", (e) => {
        if (e.target.id !== "btn-wordsearch") WordSearch.open();
      });
    }
  }

  function renderState({ emoji, title, message, actions }) {
    render(`
      <div class="state-block pop-in">
        <div class="emoji">${emoji}</div>
        <h2>${title}</h2>
        <p>${message}</p>
        <div class="btn-row" style="max-width:280px;margin:0 auto;">
          ${(actions || []).map((a, i) => `<button class="btn ${a.style || 'btn-primary'}" id="state-action-${i}">${a.label}</button>`).join("")}
        </div>
      </div>
    `);
    (actions || []).forEach((a, i) => {
      document.getElementById(`state-action-${i}`).addEventListener("click", a.onClick);
    });
  }

  // Simple confirm modal (used for "exit game?" prompts)
  function confirmDialog({ title, message, confirmLabel, cancelLabel }) {
    return new Promise((resolve) => {
      const wrap = document.createElement("div");
      wrap.style.cssText = "position:fixed;inset:0;z-index:180;display:flex;align-items:center;justify-content:center;background:rgba(4,10,26,0.65);padding:20px;";
      wrap.innerHTML = `
        <div class="panel pop-in" style="max-width:340px;width:100%;">
          <h3 style="margin-bottom:8px;">${title}</h3>
          <p style="color:var(--ink-soft);font-size:14px;margin-bottom:18px;">${message}</p>
          <div class="btn-row">
            <button class="btn btn-outline" id="confirm-cancel">${cancelLabel}</button>
            <button class="btn btn-primary" id="confirm-ok">${confirmLabel}</button>
          </div>
        </div>
      `;
      document.body.appendChild(wrap);
      wrap.querySelector("#confirm-cancel").addEventListener("click", () => { wrap.remove(); resolve(false); });
      wrap.querySelector("#confirm-ok").addEventListener("click", () => { wrap.remove(); resolve(true); });
    });
  }

  function toast(message) {
    const t = document.createElement("div");
    t.textContent = message;
    t.style.cssText = "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:var(--midnight-3);border:1px solid var(--line);color:#fff;padding:10px 18px;border-radius:999px;font-size:13px;z-index:220;box-shadow:var(--shadow-pop);";
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2600);
  }

  return { init, render, renderHome, renderState, confirmDialog, toast };
})();
