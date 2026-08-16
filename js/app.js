/* ==========================================================================
   app.js — bootstraps the app
   ========================================================================== */

const App = (() => {
  let configCache = null;

  async function init() {
    Loading.show("Memuatkan MERDEKA MINI-GAMES...");
    UI.init();

    if (!APP_CONFIG.API_URL || APP_CONFIG.API_URL === "YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL") {
      Loading.hide(true);
      UI.renderState({
        emoji: "⚙️",
        title: "Persediaan Diperlukan",
        message: "Sila masukkan URL Google Apps Script Web App anda dalam js/config.js (APP_CONFIG.API_URL) sebelum menggunakan aplikasi ini. Lihat README untuk arahan.",
        actions: [],
      });
      return;
    }

    try {
      configCache = await Api.config();
    } catch (e) {
      configCache = { games: { quiz: true } }; // graceful fallback so the app still shows something
    }
    Loading.hide(true);
    goHome();
  }

  function goHome() {
    Dashboard.stopLivePoll?.();
    const proceed = () => UI.renderHome(configCache);
    const inProgress = (Quiz.isInProgress && Quiz.isInProgress()) || (Sudoku.isInProgress && Sudoku.isInProgress()) || (WordSearch.isInProgress && WordSearch.isInProgress());
    if (inProgress) {
      UI.confirmDialog({
        title: "Keluar dari permainan?",
        message: "Kemajuan permainan anda akan hilang.",
        confirmLabel: "KELUAR",
        cancelLabel: "TERUSKAN BERMAIN",
      }).then((ok) => { if (ok) { Quiz.reset(); Sudoku.reset(); WordSearch.reset(); proceed(); } });
    } else {
      proceed();
    }
  }

  return { init, goHome };
})();

document.addEventListener("DOMContentLoaded", () => App.init());
