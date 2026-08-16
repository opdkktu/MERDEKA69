/* ==========================================================================
   quiz.js — Merdeka Quiz: live open/close window, self-paced play,
   per-question countdown, live progress ping, results.
   ========================================================================== */

const Quiz = (() => {
  let statusPollTimer = null;
  let questionTimer = null;
  let state = null; // active game session state

  // ---------- Entry point ----------
  async function open() {
    stopStatusPoll();
    try {
      const status = await Loading.during(() => Api.quizStatus(), "Menyemak status kuiz...");
      handleStatus(status);
    } catch (e) {
      showLoadError(e, open);
    }
  }

  function handleStatus(status) {
    if (status.state === "before") {
      renderBeforeOpen(status);
      pollStatus();
    } else if (status.state === "closed") {
      renderClosed(status);
    } else {
      renderJoin(status);
    }
  }

  function pollStatus() {
    stopStatusPoll();
    statusPollTimer = setInterval(async () => {
      try {
        const status = await Api.quizStatus();
        if (status.state !== "before") {
          stopStatusPoll();
          handleStatus(status);
        }
      } catch (e) { /* silent — keep waiting */ }
    }, APP_CONFIG.STATUS_POLL_INTERVAL_MS);
  }

  function stopStatusPoll() {
    if (statusPollTimer) clearInterval(statusPollTimer);
    statusPollTimer = null;
  }

  // ---------- Not open yet ----------
  function renderBeforeOpen(status) {
    UI.renderState({
      emoji: "⏳",
      title: "Kuiz Belum Dibuka",
      message: status.opensAt
        ? `Kuiz akan dibuka pada ${formatTime(status.opensAt)}. Sila tunggu sebentar — halaman ini akan dikemaskini secara automatik.`
        : "Kuiz belum dibuka lagi. Sila tunggu sebentar.",
      actions: [{ label: "KEMBALI KE MENU", style: "btn-outline", onClick: () => App.goHome() }],
    });
  }

  // ---------- Closed ----------
  function renderClosed(status) {
    UI.renderState({
      emoji: "🏁",
      title: "Kuiz Telah Ditutup",
      message: "Sesi kuiz langsung telah tamat. Terima kasih kerana mengambil bahagian!",
      actions: [
        { label: "LIHAT PAPAN PENDAHULU", style: "btn-gold", onClick: () => Dashboard.open("leaderboard", "quiz") },
        { label: "KEMBALI KE MENU", style: "btn-outline", onClick: () => App.goHome() },
      ],
    });
  }

  // ---------- Join form ----------
  function renderJoin(status) {
    const savedName = localStorage.getItem(APP_CONFIG.STORAGE_KEYS.NICKNAME) || "";
    UI.render(`
      <div class="panel pop-in">
        <div class="section-title">🧠 Merdeka Quiz</div>
        <p style="color:var(--ink-soft);font-size:14px;margin-bottom:16px;">
          ${status.totalQuestions || 10} soalan · ${status.timePerQuestion || 15} saat setiap soalan.
          Jawab mengikut kelajuan anda sendiri sebelum sesi ditutup.
        </p>
        <div class="field">
          <label for="nickname-input">Nama Panggilan</label>
          <input type="text" id="nickname-input" maxlength="24" placeholder="cth. Amir" value="${escapeHtml(savedName)}" autocomplete="off">
        </div>
        <button class="btn btn-primary" id="join-btn">MULA SEKARANG</button>
      </div>
    `);
    const input = document.getElementById("nickname-input");
    const btn = document.getElementById("join-btn");
    btn.addEventListener("click", () => startQuiz(input.value.trim()));
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") startQuiz(input.value.trim()); });
    input.focus();
  }

  async function startQuiz(nickname) {
    if (!nickname) {
      UI.toast("Sila masukkan nama panggilan anda.");
      return;
    }
    localStorage.setItem(APP_CONFIG.STORAGE_KEYS.NICKNAME, nickname);
    try {
      const [{ sessionId }, questions, status] = await Loading.during(
        () => Promise.all([Api.quizJoin(nickname), Api.quizQuestions(), Api.quizStatus()]),
        "Menyediakan soalan..."
      );
      state = {
        sessionId,
        nickname,
        questions,
        index: 0,
        score: 0,
        correctCount: 0,
        startedAt: Date.now(),
        timePerQuestion: status.timePerQuestion || 15,
        locked: false,
      };
      renderQuestion();
    } catch (e) {
      showLoadError(e, () => renderJoin({}));
    }
  }

  // ---------- Question flow ----------
  function renderQuestion() {
    clearQuestionTimer();
    const q = state.questions[state.index];
    const total = state.questions.length;
    const letters = ["A", "B", "C", "D"];

    UI.render(`
      <div class="quiz-topbar">
        <div class="progress-track"><div class="progress-fill" style="width:${(state.index / total) * 100}%"></div></div>
        <div class="q-count">${state.index + 1} / ${total}</div>
        <div class="timer-ring" id="timer-ring">
          <svg viewBox="0 0 60 60"><circle class="bg" cx="30" cy="30" r="26"/><circle class="fg" id="timer-fg" cx="30" cy="30" r="26"/></svg>
          <div class="num" id="timer-num">${state.timePerQuestion}</div>
        </div>
      </div>
      <div class="panel">
        ${q.imageUrl ? `<img class="q-image" src="${q.imageUrl}" alt="" loading="lazy" onerror="this.style.display='none'">` : ""}
        <div class="q-text">${escapeHtml(q.question)}</div>
        <div class="answers" id="answers-wrap">
          ${q.options.map((opt, i) => `
            <button class="answer-btn" data-i="${i}">
              <span class="letter">${letters[i]}</span><span>${escapeHtml(opt)}</span>
            </button>
          `).join("")}
        </div>
        <div id="feedback-slot"></div>
      </div>
    `);

    document.getElementById("answers-wrap").addEventListener("click", (e) => {
      const btn = e.target.closest(".answer-btn");
      if (btn && !state.locked) selectAnswer(Number(btn.dataset.i));
    });

    runTimer(state.timePerQuestion);
    Api.quizProgress(state.sessionId, state.index + 1, state.score);
  }

  function runTimer(seconds) {
    const ring = document.getElementById("timer-ring");
    const fg = document.getElementById("timer-fg");
    const num = document.getElementById("timer-num");
    const circumference = 2 * Math.PI * 26;
    fg.style.strokeDasharray = `${circumference}`;
    let remaining = seconds;
    state.timeLeft = remaining;
    const tick = () => {
      const pct = remaining / seconds;
      fg.style.strokeDashoffset = `${circumference * (1 - pct)}`;
      num.textContent = remaining;
      ring.classList.toggle("low", remaining <= 5);
    };
    tick();
    questionTimer = setInterval(() => {
      remaining--;
      state.timeLeft = remaining;
      if (remaining <= 0) {
        clearQuestionTimer();
        if (!state.locked) selectAnswer(-1); // time's up — no answer
        return;
      }
      tick();
    }, 1000);
  }

  function clearQuestionTimer() {
    if (questionTimer) clearInterval(questionTimer);
    questionTimer = null;
  }

  function selectAnswer(choiceIndex) {
    state.locked = true;
    clearQuestionTimer();
    const q = state.questions[state.index];
    const correct = choiceIndex === q.correctIndex;
    if (correct) {
      const bonus = Math.max(0, state.timeLeft || 0) * 4;
      state.score += 100 + bonus;
      state.correctCount++;
    }

    document.querySelectorAll(".answer-btn").forEach((btn, i) => {
      btn.disabled = true;
      if (i === q.correctIndex) btn.classList.add("correct");
      if (i === choiceIndex && !correct) btn.classList.add("wrong");
    });

    const slot = document.getElementById("feedback-slot");
    slot.innerHTML = `
      <div class="feedback-banner ${correct ? "good" : "bad"} pop-in">
        ${correct ? "BETUL! 🎉" : (choiceIndex === -1 ? "MASA TAMAT ⏱️" : "BELUM TEPAT")}
        ${!correct ? `<div class="feedback-explain">Jawapan yang betul: ${escapeHtml(q.options[q.correctIndex])}</div>` : ""}
        ${q.explanation ? `<div class="feedback-explain">${escapeHtml(q.explanation)}</div>` : ""}
      </div>
      <button class="btn btn-gold" id="continue-btn" style="margin-top:14px;">
        ${state.index + 1 < state.questions.length ? "SETERUSNYA" : "LIHAT KEPUTUSAN"}
      </button>
    `;
    document.getElementById("continue-btn").addEventListener("click", nextQuestion);
  }

  function nextQuestion() {
    state.index++;
    state.locked = false;
    if (state.index >= state.questions.length) {
      finishQuiz();
    } else {
      renderQuestion();
    }
  }

  // ---------- Result ----------
  async function finishQuiz() {
    const timeTakenSec = Math.round((Date.now() - state.startedAt) / 1000);
    const total = state.questions.length;
    const pct = Math.round((state.correctCount / total) * 100);

    try {
      await Loading.during(() => Api.submitScore({
        sessionId: state.sessionId,
        nickname: state.nickname,
        game: "quiz",
        score: state.score,
        correctCount: state.correctCount,
        totalQuestions: total,
        timeTakenSec,
      }), "Menyimpan keputusan...");
    } catch (e) {
      UI.toast("Keputusan tidak dapat disimpan ke pelayan, tetapi berikut skor anda.");
    }

    const msg = pct >= 90
      ? "Hebat! Semangat dan pengetahuan Merdeka anda memang terbaik! 🇲🇾"
      : pct >= 70
      ? "Bagus! Anda memang mengenali Malaysia dengan baik!"
      : pct >= 50
      ? "Syabas! Teruskan belajar tentang Malaysia!"
      : "Jangan risau, cuba lagi dan tingkatkan skor anda!";

    UI.render(`
      <div class="result-hero pop-in">
        ${Star.markup("badge-lg")}
        <h2 style="margin-bottom:2px;">TAHNIAH! 🇲🇾</h2>
        <div class="score-big">${state.score}</div>
        <div class="score-pct">${state.correctCount}/${total} betul · ${pct}%</div>
      </div>
      <p class="result-msg">${msg}</p>
      <div class="stat-grid">
        <div class="stat-cell"><div class="val mono">${formatDuration(timeTakenSec)}</div><div class="lbl">Masa</div></div>
        <div class="stat-cell"><div class="val mono">${state.correctCount}/${total}</div><div class="lbl">Betul</div></div>
        <div class="stat-cell"><div class="val mono">${state.score}</div><div class="lbl">Skor</div></div>
      </div>
      <div class="btn-row" style="margin-bottom:10px;">
        <button class="btn btn-outline" id="btn-share">KONGSI</button>
        <button class="btn btn-gold" id="btn-leaderboard">PAPAN PENDAHULU</button>
      </div>
      <button class="btn btn-primary" id="btn-menu">PILIH PERMAINAN LAIN</button>
    `);

    Confetti.burst();
    document.getElementById("btn-menu").addEventListener("click", () => App.goHome());
    document.getElementById("btn-leaderboard").addEventListener("click", () => Dashboard.open("leaderboard", "quiz"));
    document.getElementById("btn-share").addEventListener("click", () => shareResult(state.score, state.correctCount, total));
    state = null;
  }

  async function shareResult(score, correct, total) {
    const text = `🇲🇾 Saya mendapat ${correct}/${total} (${score} mata) dalam Merdeka Mini-Games!\nBerapa skor anda?`;
    if (navigator.share) {
      try { await navigator.share({ text }); } catch (e) { /* user cancelled */ }
    } else {
      try {
        await navigator.clipboard.writeText(text);
        UI.toast("Keputusan disalin ke papan klip!");
      } catch (e) {
        UI.toast(text);
      }
    }
  }

  // ---------- Helpers ----------
  function showLoadError(e, retry) {
    UI.renderState({
      emoji: "😅",
      title: "Oops!",
      message: "Permainan tidak dapat dimuatkan sekarang. Sila cuba lagi.",
      actions: [
        { label: "CUBA LAGI", style: "btn-primary", onClick: retry },
        { label: "KEMBALI KE MENU", style: "btn-outline", onClick: () => App.goHome() },
      ],
    });
  }

  function formatTime(iso) {
    try {
      return new Date(iso).toLocaleString("ms-MY", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" });
    } catch (e) { return iso; }
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

  function isInProgress() { return !!state; }

  function reset() {
    stopStatusPoll();
    clearQuestionTimer();
    state = null;
  }

  return { open, isInProgress, reset };
})();
