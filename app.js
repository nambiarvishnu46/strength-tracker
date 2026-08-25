// app.js
// Core app logic: rendering, localStorage persistence, history, progress, CSV export.
// All workout data is namespaced per local profile (username), so multiple people
// sharing the same browser/device each see only their own sessions/history/progress.

const dayIndexToKey = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

let state = {
  activeTab: "today",
  selectedDayKey: dayIndexToKey[new Date().getDay()],
  openExerciseIdx: null,
  timerHandle: null
};

// ---------------------------------------------------------------------------
// Profiles (no password — just a chosen username, stored locally on this device)
// ---------------------------------------------------------------------------
const PROFILES_KEY = "strengthTracker.profiles.v1";
const CURRENT_USER_KEY = "strengthTracker.currentUser.v1";

function sanitizeUsername(raw) {
  return (raw || "").trim().replace(/\s+/g, " ").slice(0, 24);
}

function loadProfiles() {
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveProfiles(list) {
  localStorage.setItem(PROFILES_KEY, JSON.stringify(list));
}

// Returns the canonical stored casing for a username if a case-insensitive
// match already exists among saved profiles; otherwise registers it as new
// and returns it unchanged. This prevents "John" and "john" from silently
// splitting into two separate data namespaces.
function resolveOrRegisterProfile(username) {
  const list = loadProfiles();
  const existing = list.find((u) => u.toLowerCase() === username.toLowerCase());
  if (existing) return existing;
  list.push(username);
  saveProfiles(list);
  return username;
}

function getCurrentUser() {
  return localStorage.getItem(CURRENT_USER_KEY);
}

function setCurrentUser(username) {
  localStorage.setItem(CURRENT_USER_KEY, username);
}

// Build a storage key namespaced to the current profile
function userKey(base) {
  const u = getCurrentUser() || "guest";
  return `strengthTracker.u.${u}.${base}`;
}

// ---------------------------------------------------------------------------
// Storage helpers (all scoped to the active profile via userKey())
// ---------------------------------------------------------------------------
function loadSessions() {
  try {
    const raw = localStorage.getItem(userKey("sessions.v1"));
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Failed to load sessions", e);
    return [];
  }
}

function saveSessions(sessions) {
  localStorage.setItem(userKey("sessions.v1"), JSON.stringify(sessions));
}

function todayISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function getDraft(dayKey) {
  try {
    const raw = localStorage.getItem(userKey("draft." + dayKey));
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function saveDraft(dayKey, draft) {
  localStorage.setItem(userKey("draft." + dayKey), JSON.stringify(draft));
}

function clearDraft(dayKey) {
  localStorage.removeItem(userKey("draft." + dayKey));
}

// Find the most recent logged set data for a given exercise name (any past session)
function findLastLog(exerciseName) {
  const sessions = loadSessions();
  for (let i = sessions.length - 1; i >= 0; i--) {
    const s = sessions[i];
    const entry = s.entries.find((e) => e.exerciseName === exerciseName);
    if (entry && entry.sets.some((st) => st.weight || st.reps)) {
      const lastSet = [...entry.sets].reverse().find((st) => st.weight || st.reps);
      if (lastSet) return { date: s.date, weight: lastSet.weight, reps: lastSet.reps };
    }
  }
  return null;
}

// Find the previous session's sets array for a given exercise (most recent session that logged it)
function findLastSessionSets(exerciseName) {
  const sessions = loadSessions();
  for (let i = sessions.length - 1; i >= 0; i--) {
    const entry = sessions[i].entries.find((e) => e.exerciseName === exerciseName);
    if (entry && entry.sets.some((st) => st.weight || st.reps)) return entry.sets;
  }
  return null;
}

function findAllLogsForExercise(exerciseName) {
  const sessions = loadSessions();
  const out = [];
  sessions.forEach((s) => {
    const entry = s.entries.find((e) => e.exerciseName === exerciseName);
    if (entry) {
      entry.sets.forEach((st) => {
        if (st.weight) out.push({ date: s.date, weight: parseFloat(st.weight), reps: st.reps });
      });
    }
  });
  return out.sort((a, b) => (a.date > b.date ? 1 : -1));
}

// Best (heaviest) weight ever logged for an exercise, excluding a given date if needed
function bestWeightForExercise(exerciseName) {
  const logs = findAllLogsForExercise(exerciseName);
  if (logs.length === 0) return 0;
  return logs.reduce((max, l) => (l.weight > max ? l.weight : max), 0);
}

// ---------------------------------------------------------------------------
// Workout timer (elapsed time since the current day's log was first opened)
// ---------------------------------------------------------------------------
function getStartTime(dayKey) {
  const raw = localStorage.getItem(userKey("startedAt." + dayKey));
  return raw ? parseInt(raw, 10) : null;
}

function ensureStartTime(dayKey) {
  let ts = getStartTime(dayKey);
  if (!ts) {
    ts = Date.now();
    localStorage.setItem(userKey("startedAt." + dayKey), String(ts));
  }
  return ts;
}

function clearStartTime(dayKey) {
  localStorage.removeItem(userKey("startedAt." + dayKey));
}

function formatElapsed(ms) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function startTimerDisplay(dayKey) {
  const el = document.getElementById("topbarTimer");
  if (!el) return;
  clearInterval(state.timerHandle);
  const startTs = ensureStartTime(dayKey);
  el.style.display = "inline-block";
  const tick = () => {
    el.textContent = formatElapsed(Date.now() - startTs);
  };
  tick();
  state.timerHandle = setInterval(tick, 1000);
}

function stopTimerDisplay() {
  clearInterval(state.timerHandle);
  const el = document.getElementById("topbarTimer");
  if (el) el.style.display = "none";
}

// ---------------------------------------------------------------------------
// Login / profile screen
// ---------------------------------------------------------------------------
function initialsFor(username) {
  return (username || "?").trim().slice(0, 2);
}

function updateProfileChip() {
  const btn = document.getElementById("profileChipBtn");
  if (!btn) return;
  const user = getCurrentUser();
  btn.innerHTML = `<span class="avatar">${initialsFor(user)}</span><span>${user}</span>`;
}

function showLoginScreen(forSwitch) {
  const screen = document.getElementById("loginScreen");
  const list = document.getElementById("loginProfileList");
  const cancelBtn = document.getElementById("loginCancelBtn");
  const input = document.getElementById("loginUsernameInput");

  screen.classList.remove("hidden");
  input.value = "";

  const profiles = loadProfiles();
  if (profiles.length > 0) {
    let html = `<div class="lbl">Existing profiles on this device</div>`;
    profiles.forEach((p) => {
      html += `<button class="profile-row-btn" data-switch-user="${p}"><span class="avatar">${initialsFor(p)}</span><span>${p}</span></button>`;
    });
    list.innerHTML = html;
    list.querySelectorAll("[data-switch-user]").forEach((b) => {
      b.addEventListener("click", () => loginAs(b.dataset.switchUser));
    });
  } else {
    list.innerHTML = "";
  }

  cancelBtn.style.display = forSwitch && getCurrentUser() ? "inline-block" : "none";
  setTimeout(() => input.focus(), 50);
}

function hideLoginScreen() {
  document.getElementById("loginScreen").classList.add("hidden");
}

function loginAs(rawUsername) {
  const cleaned = sanitizeUsername(rawUsername);
  if (!cleaned) {
    showToast("Please enter a username");
    return;
  }
  const username = resolveOrRegisterProfile(cleaned);
  setCurrentUser(username);
  hideLoginScreen();
  updateProfileChip();
  state.activeTab = "today";
  state.openExerciseIdx = null;
  state.selectedDayKey = dayIndexToKey[new Date().getDay()];
  document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
  const todayBtn = document.querySelector('.tab-btn[data-tab="today"]');
  if (todayBtn) todayBtn.classList.add("active");
  render();
  showToast(`Welcome, ${username}`);
}

function wireLoginScreen() {
  document.getElementById("loginContinueBtn").addEventListener("click", () => {
    loginAs(document.getElementById("loginUsernameInput").value);
  });
  document.getElementById("loginUsernameInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") loginAs(document.getElementById("loginUsernameInput").value);
  });
  document.getElementById("loginCancelBtn").addEventListener("click", () => {
    hideLoginScreen();
  });
  document.getElementById("profileChipBtn").addEventListener("click", () => {
    showLoginScreen(true);
  });
}

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------
function showToast(msg) {
  let t = document.getElementById("toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "toast";
    t.className = "toast";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => t.classList.remove("show"), 1800);
}

// ---------------------------------------------------------------------------
// Tab bar
// ---------------------------------------------------------------------------
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    state.activeTab = btn.dataset.tab;
    render();
  });
});

// ---------------------------------------------------------------------------
// Rendering: TODAY tab
// ---------------------------------------------------------------------------
function renderToday() {
  const app = document.getElementById("app");
  const day = PROGRAM.find((d) => d.key === state.selectedDayKey);

  document.getElementById("topbarTitle").textContent = day.dayName;
  document.getElementById("topbarSub").textContent = day.subtitle;

  const timerKey = `${day.key}.${todayISO()}`;
  if (day.type === "lift") {
    startTimerDisplay(timerKey);
  } else {
    stopTimerDisplay();
  }

  let html = "";

  // Day pill selector
  html += `<div class="pill-row">`;
  PROGRAM.forEach((d) => {
    const active = d.key === state.selectedDayKey ? "active" : "";
    const rest = d.type === "swim" ? "rest" : "";
    html += `<button class="day-pill ${active} ${rest}" data-day="${d.key}">${d.label.slice(0, 3)}</button>`;
  });
  html += `</div>`;

  if (day.warmup) {
    html += `<div class="warmup-note"><b>Warm-up:</b> ${day.warmup}</div>`;
  }

  const draft = getDraft(day.key) || {};

  day.exercises.forEach((ex, idx) => {
    const isOpen = state.openExerciseIdx === idx ? "open" : "";
    const last = findLastLog(ex.name);
    const lastText = last
      ? `Last time (${last.date}): ${last.weight ? last.weight + "kg" : ""} ${last.reps ? "x " + last.reps : ""}`.trim()
      : "No previous log yet";
    const bestWeight = bestWeightForExercise(ex.name);
    const hasPR = bestWeight > 0;

    html += `<div class="exercise ${isOpen}" data-idx="${idx}">`;
    html += `  <div class="exercise-head" data-toggle="${idx}">
                 <div>
                   <div class="exercise-name">${ex.name}${hasPR ? '<span class="pr-badge" title="All-time best: ' + bestWeight + 'kg">&#127942;</span>' : ""}</div>
                   <div class="exercise-target">Target: ${ex.target}</div>
                 </div>
                 <div class="chevron">&#9654;</div>
               </div>`;
    html += `  <div class="sets-wrap">`;
    html += `    <div class="last-time">${lastText}</div>`;
    html += `    <div class="set-header-row"><div></div><div>Previous</div><div>${ex.isHold ? "Sec" : "kg"}</div><div>Reps</div><div>${ex.isHold ? "" : "RPE"}</div><div></div></div>`;

    const savedSets = (draft[ex.name] && draft[ex.name].sets) || [];
    const prevSessionSets = findLastSessionSets(ex.name);

    for (let s = 0; s < ex.sets; s++) {
      const saved = savedSets[s] || {};
      const checked = saved.done ? "checked" : "";
      const prevSet = prevSessionSets ? prevSessionSets[s] : null;
      const prevText = prevSet && prevSet.weight ? `${prevSet.weight}kg x${prevSet.reps || "-"}` : "—";
      const enteredWeight = parseFloat(saved.weight);
      const isNewPR = hasPR && !isNaN(enteredWeight) && enteredWeight > bestWeight;
      html += `<div class="set-row ${isNewPR ? "is-pr" : ""}" data-ex="${idx}" data-set="${s}">
                 <div class="set-num">${s + 1}</div>
                 <div class="set-previous">${prevText}</div>
                 <input type="number" inputmode="decimal" placeholder="kg" class="inp-weight" value="${saved.weight || ""}" />
                 <input type="number" inputmode="numeric" placeholder="${ex.repHint}" class="inp-reps" value="${saved.reps || ""}" />
                 <input type="number" inputmode="numeric" placeholder="${ex.isHold ? "" : "1-10"}" class="inp-rpe" value="${saved.rpe || ""}" />
                 <button class="set-done-btn ${checked}" data-done="${idx}-${s}">${isNewPR ? "&#127942;" : "&#10003;"}</button>
               </div>`;
    }

    html += `    <div class="set-actions">
                    <button class="btn-small" data-addset="${idx}">+ Add set</button>
                  </div>`;
    html += `    <input type="text" class="notes-input" placeholder="Notes (optional)" data-notes="${idx}" value="${(draft[ex.name] && draft[ex.name].notes) || ""}" />`;
    html += `  </div>`;
    html += `</div>`;
  });

  if (day.cooldown) {
    html += `<div class="cooldown-note"><b>Cool-down:</b> ${day.cooldown}</div>`;
  }

  html += `<div class="finish-bar"><button class="btn-primary" id="finishBtn">Finish &amp; Save Session</button></div>`;

  app.innerHTML = html;
  wireTodayEvents(day);
}

function wireTodayEvents(day) {
  document.querySelectorAll(".day-pill").forEach((p) => {
    p.addEventListener("click", () => {
      state.selectedDayKey = p.dataset.day;
      state.openExerciseIdx = null;
      render();
    });
  });

  document.querySelectorAll("[data-toggle]").forEach((el) => {
    el.addEventListener("click", () => {
      const idx = parseInt(el.dataset.toggle, 10);
      state.openExerciseIdx = state.openExerciseIdx === idx ? null : idx;
      render();
    });
  });

  document.querySelectorAll("[data-addset]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.addset, 10);
      day.exercises[idx].sets += 1;
      persistCurrentInputsToDraft(day);
      render();
      state.openExerciseIdx = idx;
    });
  });

  document.querySelectorAll("[data-done]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      btn.classList.toggle("checked");
      persistCurrentInputsToDraft(day);
    });
  });

  document.querySelectorAll(".set-row input").forEach((inp) => {
    inp.addEventListener("input", () => persistCurrentInputsToDraft(day));
    inp.addEventListener("click", (e) => e.stopPropagation());
  });

  document.querySelectorAll(".set-row .inp-weight").forEach((inp) => {
    inp.addEventListener("input", () => updatePRHighlight(inp, day));
  });

  document.querySelectorAll(".notes-input").forEach((inp) => {
    inp.addEventListener("input", () => persistCurrentInputsToDraft(day));
    inp.addEventListener("click", (e) => e.stopPropagation());
  });

  document.getElementById("finishBtn").addEventListener("click", () => finishSession(day));
}

function updatePRHighlight(weightInput, day) {
  const row = weightInput.closest(".set-row");
  const exEl = weightInput.closest(".exercise");
  const idx = parseInt(exEl.dataset.idx, 10);
  const ex = day.exercises[idx];
  const bestWeight = bestWeightForExercise(ex.name);
  const doneBtn = row.querySelector("[data-done]");
  const val = parseFloat(weightInput.value);
  const isNewPR = bestWeight > 0 && !isNaN(val) && val > bestWeight;
  row.classList.toggle("is-pr", isNewPR);
  doneBtn.innerHTML = isNewPR ? "&#127942;" : "&#10003;";
}

function persistCurrentInputsToDraft(day) {
  const draft = {};
  document.querySelectorAll(".exercise").forEach((exEl) => {
    const idx = parseInt(exEl.dataset.idx, 10);
    const ex = day.exercises[idx];
    const sets = [];
    exEl.querySelectorAll(".set-row").forEach((row) => {
      const weight = row.querySelector(".inp-weight").value;
      const reps = row.querySelector(".inp-reps").value;
      const rpe = row.querySelector(".inp-rpe").value;
      const done = row.querySelector("[data-done]").classList.contains("checked");
      sets.push({ weight, reps, rpe, done });
    });
    const notesEl = exEl.querySelector(".notes-input");
    draft[ex.name] = { sets, notes: notesEl ? notesEl.value : "" };
  });
  saveDraft(day.key, draft);
}

function finishSession(day) {
  const draft = getDraft(day.key) || {};
  const entries = [];
  let anyData = false;

  day.exercises.forEach((ex) => {
    const d = draft[ex.name];
    if (d && d.sets.some((s) => s.weight || s.reps)) {
      anyData = true;
      entries.push({
        exerciseName: ex.name,
        sets: d.sets.filter((s) => s.weight || s.reps),
        notes: d.notes || ""
      });
    }
  });

  if (!anyData) {
    showToast("Log at least one set before finishing");
    return;
  }

  const sessions = loadSessions();
  sessions.push({
    date: todayISO(),
    dayKey: day.key,
    dayName: day.dayName,
    entries
  });
  saveSessions(sessions);
  clearDraft(day.key);
  clearStartTime(`${day.key}.${todayISO()}`);
  stopTimerDisplay();
  showToast("Session saved");
  state.openExerciseIdx = null;
  render();
}

// ---------------------------------------------------------------------------
// Rendering: PROGRAM tab (read-only overview of the whole week)
// ---------------------------------------------------------------------------
function renderProgram() {
  document.getElementById("topbarTitle").textContent = "Routines";
  document.getElementById("topbarSub").textContent = "UL Sport Arena · Strength Building Plan";
  stopTimerDisplay();

  const app = document.getElementById("app");
  let html = "";

  PROGRAM.forEach((day) => {
    const isRest = day.type === "swim";
    html += `<div class="routine-card ${isRest ? "rest" : ""}">
      <div class="routine-head">
        <div>
          <div class="routine-day-label">${day.label}</div>
          <div class="routine-title">${day.dayName}</div>
          <div class="routine-sub">${day.subtitle}</div>
        </div>
        <div class="routine-count">${day.exercises.length} ${day.exercises.length === 1 ? "item" : "exercises"}</div>
      </div>`;
    html += `<div class="routine-ex-list">`;
    day.exercises.forEach((ex) => {
      html += `<div class="routine-ex-row"><b>${ex.name}</b><span>${ex.target}</span></div>`;
    });
    html += `</div>`;
    html += `<button class="btn-start ${isRest ? "secondary" : ""}" data-start="${day.key}">${isRest ? "View Details" : "Start Workout"}</button>`;
    html += `</div>`;
  });

  app.innerHTML = html;

  document.querySelectorAll("[data-start]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.selectedDayKey = btn.dataset.start;
      state.openExerciseIdx = null;
      state.activeTab = "today";
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelector('.tab-btn[data-tab="today"]').classList.add("active");
      render();
    });
  });
}

// ---------------------------------------------------------------------------
// Rendering: HISTORY tab
// ---------------------------------------------------------------------------
function renderHistory() {
  document.getElementById("topbarTitle").textContent = "History";
  document.getElementById("topbarSub").textContent = "Past logged sessions";
  stopTimerDisplay();

  const app = document.getElementById("app");
  const sessions = loadSessions().slice().reverse();

  if (sessions.length === 0) {
    app.innerHTML = `<div class="history-empty">No sessions logged yet.<br/>Go to <b>Today</b> and finish a workout to see it here.</div>`;
    return;
  }

  let html = "";
  sessions.forEach((s) => {
    html += `<div class="history-item">
      <div class="h-date">${s.date}</div>
      <div class="h-day">${s.dayName}</div>`;
    s.entries.forEach((e) => {
      const setSummary = e.sets
        .map((st) => `${st.weight || "-"}kg x${st.reps || "-"}`)
        .join(", ");
      html += `<div class="h-ex"><b>${e.exerciseName}:</b> ${setSummary}</div>`;
    });
    html += `</div>`;
  });

  html += `<button class="export-btn" id="exportBtn">Export all data as CSV</button>`;
  html += `<button class="export-btn" id="clearBtn" style="margin-top:8px;color:var(--danger);">Clear all history</button>`;

  app.innerHTML = html;

  document.getElementById("exportBtn").addEventListener("click", exportCSV);
  document.getElementById("clearBtn").addEventListener("click", () => {
    if (confirm(`This will permanently delete all logged sessions for "${getCurrentUser()}" on this device. Continue?`)) {
      localStorage.removeItem(userKey("sessions.v1"));
      showToast("History cleared");
      render();
    }
  });
}

function exportCSV() {
  const sessions = loadSessions();
  let rows = [["Date", "Day", "Exercise", "SetNumber", "Weight_kg", "Reps", "RPE", "Notes"]];
  sessions.forEach((s) => {
    s.entries.forEach((e) => {
      e.sets.forEach((st, i) => {
        rows.push([s.date, s.dayName, e.exerciseName, i + 1, st.weight || "", st.reps || "", st.rpe || "", e.notes || ""]);
      });
    });
  });
  const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `strength-tracker-export-${getCurrentUser() || "guest"}-${todayISO()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast("CSV exported");
}

// ---------------------------------------------------------------------------
// Rendering: PROGRESS tab
// ---------------------------------------------------------------------------
function allExerciseNames() {
  const set = new Set();
  PROGRAM.forEach((d) => d.exercises.forEach((e) => set.add(e.name)));
  return Array.from(set);
}

function renderProgress() {
  document.getElementById("topbarTitle").textContent = "Progress";
  document.getElementById("topbarSub").textContent = "Track your strength gains over time";
  stopTimerDisplay();

  const app = document.getElementById("app");
  const sessions = loadSessions();

  const totalSessions = sessions.length;
  const totalSets = sessions.reduce(
    (sum, s) => sum + s.entries.reduce((a, e) => a + e.sets.length, 0),
    0
  );
  const uniqueDays = new Set(sessions.map((s) => s.date)).size;

  let html = `<div class="stat-grid">
    <div class="stat-box"><div class="stat-num">${totalSessions}</div><div class="stat-label">Sessions Logged</div></div>
    <div class="stat-box"><div class="stat-num">${totalSets}</div><div class="stat-label">Total Sets</div></div>
    <div class="stat-box"><div class="stat-num">${uniqueDays}</div><div class="stat-label">Days Trained</div></div>
    <div class="stat-box"><div class="stat-num">${currentStreak(sessions)}</div><div class="stat-label">Week Streak</div></div>
  </div>`;

  html += `<select class="progress-select" id="exerciseSelect">`;
  allExerciseNames().forEach((name) => {
    html += `<option value="${name}">${name}</option>`;
  });
  html += `</select>`;

  html += `<div class="card" id="prCardWrap"></div>`;

  app.innerHTML = html;

  const sel = document.getElementById("exerciseSelect");
  sel.addEventListener("change", () => renderPRCard(sel.value));
  renderPRCard(sel.value);
}

function currentStreak(sessions) {
  // count distinct ISO weeks with >=1 session, consecutive back from this week
  if (sessions.length === 0) return 0;
  const weekKey = (dateStr) => {
    const d = new Date(dateStr);
    const onejan = new Date(d.getFullYear(), 0, 1);
    const week = Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7);
    return `${d.getFullYear()}-W${week}`;
  };
  const weeks = new Set(sessions.map((s) => weekKey(s.date)));
  let streak = 0;
  let cursor = new Date();
  while (true) {
    const key = weekKey(cursor.toISOString().slice(0, 10));
    if (weeks.has(key)) {
      streak++;
      cursor.setDate(cursor.getDate() - 7);
    } else {
      break;
    }
  }
  return streak;
}

// Build a small inline SVG line chart (sparkline) from an array of {date, weight} points.
function buildSparkline(points) {
  if (points.length < 2) {
    return `<div class="meta" style="text-align:center;padding:14px 0;">Log this exercise a couple more times to see a trend chart.</div>`;
  }
  const w = 300;
  const h = 70;
  const padX = 6;
  const padY = 8;
  const weights = points.map((p) => p.weight);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = max - min || 1;

  const coords = points.map((p, i) => {
    const x = padX + (i / (points.length - 1)) * (w - padX * 2);
    const y = h - padY - ((p.weight - min) / range) * (h - padY * 2);
    return [x, y];
  });

  const linePath = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${coords[coords.length - 1][0].toFixed(1)},${h} L${coords[0][0].toFixed(1)},${h} Z`;

  const dots = coords
    .map(([x, y], i) => {
      const isMax = points[i].weight === max;
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${isMax ? 3.5 : 2.5}" fill="${isMax ? "#f5c518" : "#8b7ff0"}" />`;
    })
    .join("");

  return `<div class="sparkline-wrap">
    <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
      <defs>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#6c5dd3" stop-opacity="0.35" />
          <stop offset="100%" stop-color="#6c5dd3" stop-opacity="0" />
        </linearGradient>
      </defs>
      <path d="${areaPath}" fill="url(#sparkFill)" stroke="none" />
      <path d="${linePath}" fill="none" stroke="#8b7ff0" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
      ${dots}
    </svg>
  </div>`;
}

function renderPRCard(exerciseName) {
  const wrap = document.getElementById("prCardWrap");
  const logs = findAllLogsForExercise(exerciseName);

  if (logs.length === 0) {
    wrap.innerHTML = `<h2>${exerciseName}</h2><div class="meta">No data logged yet for this exercise.</div>`;
    return;
  }

  const best = logs.reduce((max, l) => (l.weight > max.weight ? l : max), logs[0]);
  const latest = logs[logs.length - 1];

  // Collapse multiple sets on the same date to that date's max weight, for a cleaner trend line
  const byDate = new Map();
  logs.forEach((l) => {
    const existing = byDate.get(l.date);
    if (!existing || l.weight > existing.weight) byDate.set(l.date, l);
  });
  const trendPoints = Array.from(byDate.values()).sort((a, b) => (a.date > b.date ? 1 : -1));

  let html = `<h2>${exerciseName}</h2>`;
  html += `<div class="pr-summary">
      <div class="pr-box"><div class="lbl">All-Time Best</div><div class="val gold">${best.weight}kg &#127942;</div></div>
      <div class="pr-box"><div class="lbl">Most Recent</div><div class="val accent">${latest.weight}kg</div></div>
    </div>`;

  html += buildSparkline(trendPoints);

  logs
    .slice()
    .reverse()
    .slice(0, 10)
    .forEach((l) => {
      const isBest = l.weight === best.weight;
      html += `<div class="pr-row"><div class="pr-date">${l.date} (${l.reps || "-"} reps)</div><div class="pr-val ${isBest ? "is-best" : ""}">${l.weight}kg${isBest ? " &#127942;" : ""}</div></div>`;
    });

  wrap.innerHTML = html;
}

// ---------------------------------------------------------------------------
// Main render dispatcher
// ---------------------------------------------------------------------------
function render() {
  if (state.activeTab === "today") renderToday();
  else if (state.activeTab === "program") renderProgram();
  else if (state.activeTab === "history") renderHistory();
  else if (state.activeTab === "progress") renderProgress();
}

// ---------------------------------------------------------------------------
// App bootstrap: require a profile before showing any workout data
// ---------------------------------------------------------------------------
wireLoginScreen();

if (getCurrentUser()) {
  hideLoginScreen();
  updateProfileChip();
  render();
} else {
  showLoginScreen(false);
}

// ---------------------------------------------------------------------------
// PWA service worker registration (enables offline use once installed)
// ---------------------------------------------------------------------------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch((e) => console.warn("SW registration failed", e));
  });
}
