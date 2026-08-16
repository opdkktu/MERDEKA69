/* ==========================================================================
   dashboard.js — public leaderboard + live host/admin view (polling)
   ========================================================================== */

const Dashboard = (() => {
  let livePollTimer = null;
  let currentTab = "leaderboard";
  let currentGame = "quiz";

  function open(tab, game) {
    currentTab = tab || "leaderboard";
    currentGame = game || "quiz";
    render();
  }

  function render() {
    stopLivePoll();
    UI.render(`
      <div class="tabs">
        <button class="tab-btn ${currentTab === "leaderboard" ? "active" : ""}" id="tab-lb">🏆 Papan Pendahulu</button>
        <button class="tab-btn ${currentTab === "live" ? "active" : ""}" id="tab-live">📡 Status Langsung</button>
      </div>
      <div id="dash-body" class="panel"><div class="state-block"><div class="emoji">⏳</div><p>Memuatkan...</p></div></div>
    `);
    document.getElementById("tab-lb").addEventListener("click", () => { currentTab = "leaderboard"; render(); });
    document.getElementById("tab-live").addEventListener("click", () => { currentTab = "live"; render(); });

    if (currentTab === "leaderboard") loadLeaderboard();
    else loadLive();
  }

  async function loadLeaderboard() {
    const body = document.getElementById("dash-body");
    try {
      const rows = await Api.leaderboard(currentGame, 20);
      if (!rows || rows.length === 0) {
        body.innerHTML = emptyState("🏆", "Belum Ada Keputusan", "Jadilah orang pertama untuk bermain dan rekodkan skor anda!");
        return;
      }
      body.innerHTML = rows.map((r, i) => leaderboardRow(r, i + 1)).join("");
    } catch (e) {
      body.innerHTML = errorState(() => loadLeaderboard());
    }
  }

  function leaderboardRow(r, rank) {
    const rankClass = rank === 1 ? "top1" : rank === 2 ? "top2" : rank === 3 ? "top3" : "";
    const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : rank;
    return `
      <div class="lb-row">
        <div class="lb-rank ${rankClass}">${medal}</div>
        <div class="lb-name">${escapeHtml(r.nickname)}</div>
        <div>
          <div class="lb-score">${r.score}</div>
          <div class="lb-sub">${r.timeTakenSec != null ? formatDuration(r.timeTakenSec) : ""}</div>
        </div>
      </div>
    `;
  }

  async function loadLive() {
    const body = document.getElementById("dash-body");
    await tickLive(body);
    livePollTimer = setInterval(() => tickLive(body), APP_CONFIG.LIVE_POLL_INTERVAL_MS);
  }

  async function tickLive(body) {
    try {
      const data = await Api.liveDashboard();
      const players = (data.players || []).slice().sort((a, b) => b.score - a.score);
      body.innerHTML = `
        <div class="live-meta">
          <span>Menyertai: <b>${data.totalJoined ?? players.length}</b></span>
          <span>Selesai: <b>${data.totalFinished ?? players.filter(p => p.status === "finished").length}</b></span>
        </div>
        ${players.length === 0
          ? emptyState("📡", "Belum Ada Pemain", "Tunggu pemain menyertai kuiz langsung.")
          : players.map(p => `
            <div class="lb-row">
              <div class="lb-name">${escapeHtml(p.nickname)}</div>
              <span class="status-pill ${p.status === "finished" ? "finished" : "playing"}">
                ${p.status === "finished" ? "SELESAI" : `S${p.currentQuestion || 0}`}
              </span>
              <div class="lb-score" style="margin-left:8px;">${p.score || 0}</div>
            </div>
          `).join("")
        }
      `;
    } catch (e) {
      // silent — keep last known state on transient poll failure
    }
  }

  function stopLivePoll() {
    if (livePollTimer) clearInterval(livePollTimer);
    livePollTimer = null;
  }

  function emptyState(emoji, title, message) {
    return `<div class="state-block"><div class="emoji">${emoji}</div><h2>${title}</h2><p>${message}</p></div>`;
  }

  function errorState(retry) {
    const id = "dash-retry-" + Math.random().toString(36).slice(2, 7);
    setTimeout(() => document.getElementById(id)?.addEventListener("click", retry), 0);
    return `<div class="state-block"><div class="emoji">😅</div><h2>Oops!</h2><p>Tidak dapat memuatkan data. Sila cuba lagi.</p>
      <button class="btn btn-primary" id="${id}" style="max-width:200px;margin:0 auto;">CUBA LAGI</button></div>`;
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

  return { open, stopLivePoll };
})();
