# 🇲🇾 MERDEKA MINI-GAMES

Phase 1 + Phase 2 + Phase 3 deliverable: app shell, design system, loading
overlay, a fully working **Merdeka Quiz** (live open/close window,
per-question countdown, self-paced play, results, public leaderboard, live
host dashboard), a fully working **Merdeka Sudoku** (classic 9×9 logic,
three difficulties, mistake tracking, hints, pause, timer, results), and a
fully working **Merdeka Word Search** (real touch/mouse drag selection,
8-direction word placement, three difficulties, results).

All three games are now live — nothing left stubbed as "Akan Datang".

---

## 1. How it works (read this first)

- **Frontend** (`index.html`, `css/`, `js/`) is a static site → host it on **GitHub Pages**.
- **Backend** is a **Google Apps Script Web App** reading/writing a **Google Sheet**.
- The two talk over `fetch()`. GET requests use query params; POST requests are
  sent as `text/plain` bodies (this avoids CORS preflight issues that Apps
  Script can't handle).
- Live player progress during the quiz is kept in **CacheService** (fast,
  temporary, auto-expires) — not written to the Sheet — so many simultaneous
  players don't slow things down. Only the **final score** is saved to the
  `Scores` sheet.
- **Trust note:** scoring is calculated in the browser and submitted at the
  end. That's fine for a fun community event, but a technically savvy person
  could inspect the network request and submit a fake score. If you ever need
  tamper-proof scoring, that's a backend-side validation upgrade I can add
  later — flag it if you want it.
- **Sudoku is entirely client-side after the page loads** — no `Sudoku_Data`
  sheet reads happen during play. Puzzles are generated in the browser using
  a backtracking algorithm that guarantees a unique solution, then only the
  **final result** (score, time, mistakes) is sent to the `Scores` sheet
  when a player finishes. This keeps it fast and playable offline mid-game.
- **Word Search words come from the `WordSearch_Data` sheet** (fetched once
  when a player starts a game), but the puzzle grid itself — word placement,
  letter fill, and every word the player must find — is generated entirely
  in the browser. The generator only ever shows a word list it has already
  confirmed fits on the grid, so a puzzle can never contain an unfindable
  word. Drag-to-select works via Pointer Events, which unify touch, mouse,
  and pen under one code path (no separate mobile/desktop logic needed).

---

## 2. Set up the Google Sheet

Create a new Google Sheet. Create these tabs (exact names matter):

### Tab: `Config`
| Key | Value |
|---|---|
| APP_NAME | MERDEKA MINI-GAMES |
| VERSION | 1.0.0 |
| QUIZ_ENABLED | TRUE |
| SUDOKU_ENABLED | TRUE |
| WORDSEARCH_ENABLED | TRUE |
| QUIZ_TOTAL_QUESTIONS | 10 |
| QUIZ_TIME_PER_QUESTION | 15 |
| QUIZ_OPEN_AT | 2026-08-31T08:00:00+08:00 |
| QUIZ_CLOSE_AT | 2026-08-31T18:00:00+08:00 |

> Leave `QUIZ_OPEN_AT` blank to make the quiz open immediately.
> Leave `QUIZ_CLOSE_AT` blank so it never auto-closes once open.
> Always use the `+08:00` (Malaysia time) offset so the countdown is accurate.

### Tab: `Quiz_Data`
| ID | Question | OptionA | OptionB | OptionC | OptionD | CorrectAnswer | Explanation | ImageURL | Difficulty | Active |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Apakah nama bendera Malaysia? | Jalur Gemilang | Sang Saka | Bendera Persekutuan | Panji Malaysia | Jalur Gemilang | Jalur Gemilang ialah nama rasmi bendera Malaysia. | | Easy | TRUE |
| 2 | Malaysia mencapai kemerdekaan pada tahun berapa? | 1955 | 1957 | 1963 | 1969 | 1957 | Malaysia (Persekutuan Tanah Melayu) merdeka pada 31 Ogos 1957. | | Easy | TRUE |
| 3 | Berapakah jumlah negeri di Malaysia? | 11 | 13 | 14 | 16 | 13 | Malaysia mempunyai 13 negeri dan 3 wilayah persekutuan. | | Medium | TRUE |
| 4 | Apakah nama lagu kebangsaan Malaysia? | Negaraku | Tanah Airku | Malaysia Berjaya | Bangsa Malaysia | Negaraku | Negaraku ialah lagu kebangsaan rasmi Malaysia. | | Easy | TRUE |
| 5 | Apakah warna pada Jalur Gemilang? (pilih yang PALING tepat) | Merah, putih, biru, kuning | Merah, hijau, biru | Hitam, putih, merah | Kuning, hijau, biru | Merah, putih, biru, kuning | Jalur Gemilang terdiri daripada merah, putih, biru dan kuning (bintang & bulan). | | Medium | TRUE |
| 6 | Rukun Negara mempunyai berapa prinsip? | 3 | 4 | 5 | 6 | 5 | Rukun Negara mengandungi 5 prinsip. | | Medium | TRUE |
| 7 | Ibu negara Malaysia ialah? | Putrajaya | Kuala Lumpur | Johor Bahru | Shah Alam | Kuala Lumpur | Kuala Lumpur ialah ibu negara Malaysia. | | Easy | TRUE |
| 8 | Menara berkembar terkenal di Kuala Lumpur dikenali sebagai? | Menara KL | Petronas Twin Towers | Merdeka 118 | KLCC Tower | Petronas Twin Towers | Petronas Twin Towers pernah menjadi bangunan tertinggi dunia. | | Easy | TRUE |
| 9 | Pulau Borneo di Malaysia terdiri daripada negeri...? | Sabah & Sarawak | Perak & Pahang | Kedah & Perlis | Melaka & Johor | Sabah & Sarawak | Sabah dan Sarawak terletak di Pulau Borneo. | | Medium | TRUE |
| 10 | Bangunan tertinggi di Malaysia pada masa kini ialah? | Petronas Twin Towers | Merdeka 118 | KL Tower | The Exchange 106 | Merdeka 118 | Merdeka 118 kini menjadi bangunan tertinggi di Malaysia. | | Hard | TRUE |

Add as many rows as you like — the app randomly picks `QUIZ_TOTAL_QUESTIONS`
of the `Active = TRUE` rows each time someone plays. **ImageURL** is optional:
paste a direct image link (must end in .jpg/.png etc., and be publicly
viewable) and it will show above the question automatically.

### Tab: `Scores`
Just add the header row (leave the rest empty — the app writes to it):

| Timestamp | Nickname | Game | Score | TimeTakenSec | Difficulty | Device | Extra |
|---|---|---|---|---|---|---|---|

### Tab: `WordSearch_Data`
| ID | Word | Category | Difficulty | Active |
|---|---|---|---|---|
| 1 | MERDEKA | General | | TRUE |
| 2 | MALAYSIA | General | | TRUE |
| 3 | MADANI | General | | TRUE |
| 4 | JALUR GEMILANG | Symbol | | TRUE |
| 5 | BINTANG | Symbol | | TRUE |
| 6 | KELANTAN | State | | TRUE |
| 7 | PETRONAS | Landmark | | TRUE |
| 8 | NEGARAKU | Symbol | | TRUE |
| 9 | RUKUN NEGARA | Symbol | | TRUE |
| 10 | PATRIOTIK | General | | TRUE |
| 11 | PERPADUAN | General | | TRUE |
| 12 | KUALA LUMPUR | Place | | TRUE |
| 13 | PUTRAJAYA | Place | | TRUE |
| 14 | BORNEO | Place | | TRUE |
| 15 | KEMERDEKAAN | General | | TRUE |

Spaces are stripped automatically (e.g. "JALUR GEMILANG" becomes
`JALURGEMILANG` on the grid), so type words naturally with spaces — no need
to pre-join them yourself. Leave **Difficulty** blank to make a word
available at every difficulty level, or set it to `Easy`/`Medium`/`Hard` to
prefer it for a specific one (the game gracefully falls back to the full
list if too few words match a chosen difficulty). Each game randomly
selects from the active pool, and only places as many as fit well on the
grid — so add more rows than you need for variety between plays.

### Tabs reserved for future use
- `Sudoku_Data` → not used by the current numeric Sudoku (puzzles are
  generated algorithmically in the browser) — kept reserved in case you
  later want a symbol/term-based variant. Safe to leave empty or skip.

---

## 3. Deploy the Apps Script backend

1. In your Sheet: **Extensions → Apps Script**.
2. Delete the default `Code.gs` content. Create these files (matching names) and
   paste in the contents from the `gas/` folder of this project:
   - `Code.gs`
   - `Config.gs`
   - `Quiz.gs`
   - `Scores.gs`
   - `WordSearch.gs`
3. Click **Deploy → New deployment**.
4. Click the gear icon → select **Web app**.
5. Settings:
   - **Execute as:** Me
   - **Who has access:** Anyone
6. Click **Deploy**, authorize the permissions it asks for.
7. Copy the **Web app URL** it gives you (ends in `/exec`). You'll need this next.

> Whenever you edit the Apps Script code, you must **Deploy → Manage
> deployments → Edit (pencil) → New version → Deploy** again for changes to
> go live. Editing Sheet *data* (like adding quiz questions) does NOT require
> a redeploy — only editing the `.gs` code does.

---

## 4. Connect the frontend to your backend

Open `js/config.js` and paste your Web App URL:

```js
const APP_CONFIG = {
  API_URL: "https://script.google.com/macros/s/XXXXXXXX/exec",
  ...
};
```

---

## 5. Deploy the frontend to GitHub Pages

1. Create a new GitHub repository (e.g. `merdeka-mini-games`).
2. Upload all frontend files keeping the folder structure:
   ```
   index.html
   css/style.css
   css/responsive.css
   css/animations.css
   js/config.js
   js/star.js
   js/api.js
   js/loading.js
   js/confetti.js
   js/ui.js
   js/dashboard.js
   js/quiz.js
   js/sudoku-engine.js
   js/sudoku.js
   js/wordsearch-engine.js
   js/wordsearch.js
   js/app.js
   ```
3. Go to **Settings → Pages** in the repo.
4. Under **Build and deployment**, choose **Deploy from a branch**, branch
   `main`, folder `/ (root)`.
5. Wait ~1 minute, then visit the URL GitHub gives you
   (`https://yourusername.github.io/merdeka-mini-games/`).

---

## 6. Test it

1. Open the GitHub Pages URL.
2. You should see the loading overlay, then the home screen.
3. If `QUIZ_OPEN_AT` is in the future, tapping the Quiz card shows a
   "belum dibuka" countdown screen that auto-refreshes.
4. If open, enter a nickname and play — you'll get a per-question countdown,
   immediate feedback, and a results screen with confetti.
5. Tap the 🏆 icon in the header any time to see the **public leaderboard**
   and the **live status** tab (shows joined/finished players — great to
   project on a screen during the event).

---

## 7. Editing content later (no code changes needed)

- **Add a quiz question:** add a new row to `Quiz_Data`. Make sure
  `CorrectAnswer` text matches one of the four options exactly.
- **Add an image to a question:** paste a public image URL into `ImageURL`.
- **Change number of questions per attempt:** edit `QUIZ_TOTAL_QUESTIONS` in `Config`.
- **Change per-question time limit:** edit `QUIZ_TIME_PER_QUESTION` in `Config`.
- **Change when the quiz opens/closes:** edit `QUIZ_OPEN_AT` / `QUIZ_CLOSE_AT` in `Config`.
- **Temporarily disable a question:** set its `Active` to `FALSE`.
- Config changes are cached for 5 minutes on the backend, so allow a short
  delay (or just wait ~5 min) for changes to show up everywhere.
- **Change Sudoku difficulty (clue counts, hint limit, scoring):** these are
  code-level constants since Sudoku is generated entirely in the browser —
  edit `DIFFICULTY` in `js/sudoku-engine.js` (clue counts / base score) or
  `HINT_LIMIT` in `js/sudoku.js`. Re-upload the file to GitHub Pages after editing.
- **Add a Word Search word:** add a new row to `WordSearch_Data`. Spaces are
  fine — they're stripped automatically.
- **Prefer a word for a specific difficulty:** set its `Difficulty` column
  to `Easy`, `Medium`, or `Hard`. Leave blank for "any difficulty".
- **Change Word Search grid size / word count per difficulty:** code-level —
  edit `DIFFICULTY` in `js/wordsearch.js`.

---

## 8. Troubleshooting

| Symptom | Likely cause |
|---|---|
| "Persediaan Diperlukan" screen on load | `API_URL` in `js/config.js` still has the placeholder value |
| "Oops! Permainan tidak dapat dimuatkan" | Web app not deployed as "Anyone" access, or wrong URL, or a `.gs` code error — check **Executions** in the Apps Script editor for the error |
| Quiz always says "belum dibuka" | Check `QUIZ_OPEN_AT` — must be a valid ISO datetime and in the past |
| Leaderboard empty | No one has finished a game yet, or `Scores` sheet tab was renamed/missing headers |
| Live dashboard shows no players during an active quiz | CacheService entries expire after 3 hours — normal for old sessions; for a live event this won't be an issue |
| Sudoku card greyed out on home screen | `SUDOKU_ENABLED` in `Config` isn't set to `TRUE` |
| Sudoku takes a moment to start | Puzzle generation (especially Sukar/Hard) runs in-browser and can take up to ~1s on older phones — the loading overlay covers this |
| Word Search card greyed out | `WORDSEARCH_ENABLED` in `Config` isn't set to `TRUE` |
| Word Search puzzle has fewer words than expected | Some words didn't fit on the grid after placement attempts and were automatically excluded — this is by design (a puzzle never shows a word it can't guarantee is findable). Add more/shorter words to `WordSearch_Data` for more variety |
| Dragging on the Word Search grid scrolls the page instead of selecting | Should not happen (the grid uses `touch-action: none`) — if it does on a specific browser, let me know which one |

---

## Roadmap

- ✅ **Phase 1:** App shell, design system, loading overlay, Merdeka Quiz (live window, countdown, self-paced), leaderboard, live dashboard
- ✅ **Phase 2:** Merdeka Sudoku (classic 9×9, 3 difficulties, hints, mistakes, pause, timer)
- ✅ **Phase 3:** Merdeka Word Search (8-direction touch/mouse drag-select, 3 difficulties)
- ⏳ **Phase 4:** Extra animation polish, accessibility pass, offline resilience
- ⏳ **Phase 5:** Sound toggle, richer sharing, leaderboard filters
