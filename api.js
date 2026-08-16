/* ==========================================================================
   api.js — the ONLY module that talks to the network.
   Every other module calls apiRequest(); never raw fetch() elsewhere.

   IMPORTANT CORS NOTE:
   GitHub Pages (your frontend) and Apps Script (your backend) are different
   origins. Apps Script does not support CORS preflight (OPTIONS) requests,
   so:
     - GET requests use plain query params (no preflight triggered).
     - POST requests send a body with Content-Type "text/plain" (this also
       avoids triggering a CORS preflight) and the Apps Script side parses
       the text as JSON manually.
   ========================================================================== */

const Api = (() => {
  function buildUrl(action, params) {
    const url = new URL(APP_CONFIG.API_URL);
    url.searchParams.set("action", action);
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, v);
    });
    return url.toString();
  }

  async function get(action, params) {
    const res = await fetch(buildUrl(action, params), { method: "GET" });
    return parse(res);
  }

  async function post(action, payload) {
    const res = await fetch(buildUrl(action, {}), {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload || {}),
    });
    return parse(res);
  }

  async function parse(res) {
    if (!res.ok) {
      throw new ApiError(`Network error (${res.status})`);
    }
    let json;
    try {
      json = await res.json();
    } catch (e) {
      throw new ApiError("Invalid response from server");
    }
    if (!json || json.success !== true) {
      throw new ApiError((json && json.message) || "Something went wrong");
    }
    return json.data;
  }

  class ApiError extends Error {}

  return {
    config: () => get("config"),
    quizStatus: () => get("quizStatus"),
    quizQuestions: (count) => get("quiz", { count }),
    quizJoin: (nickname) => post("quizJoin", { nickname }),
    quizProgress: (sessionId, currentQuestion, score) =>
      post("quizProgress", { sessionId, currentQuestion, score }).catch(() => null), // best-effort, never block gameplay
    wordsearchWords: (difficulty) => get("wordsearch", { difficulty }),
    submitScore: (payload) => post("submitScore", payload),
    leaderboard: (game, limit) => get("leaderboard", { game, limit }),
    liveDashboard: () => get("liveDashboard"),
    ApiError,
  };
})();
