/* ==========================================================================
   APP_CONFIG — the ONE place you edit to connect the frontend to your backend
   ========================================================================== */

const APP_CONFIG = {
  // Paste your deployed Google Apps Script Web App URL here.
  // Get this after Deploy > New deployment > Web App (see README, Step 4).
  API_URL: "https://script.google.com/macros/s/AKfycbyaDjByj8zd75vcthe6zACgljAck8u39BnTFymnEq_VlT7TZI0vo_GWtl8bVMM83VR9/exec",

  APP_NAME: "MERDEKA MINI-GAMES",

  // How often (ms) the host dashboard polls for live updates.
  LIVE_POLL_INTERVAL_MS: 3000,

  // How often (ms) the "quiz status" screen re-checks if the window has opened/closed.
  STATUS_POLL_INTERVAL_MS: 5000,

  // localStorage keys
  STORAGE_KEYS: {
    NICKNAME: "mmg_nickname",
    QUIZ_SESSION: "mmg_quiz_session_v1",
  },
};
