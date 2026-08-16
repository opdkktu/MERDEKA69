/* ==========================================================================
   loading.js — reusable full-screen loading overlay
   ========================================================================== */

const Loading = (() => {
  const MESSAGES = [
    "Memuatkan permainan...",
    "Menyediakan cabaran...",
    "Hampir siap...",
    "Loading game...",
    "Getting things ready...",
  ];

  let el, msgEl, depth = 0;

  function mount() {
    if (el) return;
    el = document.createElement("div");
    el.id = "loading-overlay";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.innerHTML = `
      <svg class="loader-badge" viewBox="0 0 100 100" aria-hidden="true">${Star.svgInner()}</svg>
      <div class="loader-title">MERDEKA MINI-GAMES</div>
      <div class="loader-dots"><span></span><span></span><span></span></div>
      <div class="loader-msg"></div>
    `;
    document.body.appendChild(el);
    msgEl = el.querySelector(".loader-msg");
  }

  function randomMessage() {
    return MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
  }

  function show(message) {
    mount();
    depth++;
    msgEl.textContent = message || randomMessage();
    el.classList.remove("hidden");
  }

  function hide(force) {
    if (!el) return;
    depth = force ? 0 : Math.max(0, depth - 1);
    if (depth === 0) el.classList.add("hidden");
  }

  // Wraps an async function: shows overlay, runs it, hides overlay (even on error)
  async function during(promiseFn, message) {
    show(message);
    try {
      return await promiseFn();
    } finally {
      hide();
    }
  }

  return { show, hide, during };
})();
