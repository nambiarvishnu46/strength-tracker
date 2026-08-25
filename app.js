// app.js
// Core app logic: rendering, localStorage persistence, history, progress, CSV export.

const STORAGE_KEY = "strengthTracker.sessions.v1";
const DRAFT_KEY_PREFIX = "strengthTracker.draft."; // + dayKey -> in-progress (unsaved) set data

const dayIndexToKey = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

let state = {
  activeTab: "today",
  selectedDayKey: dayIndexToKey[new Date().getDay()],
  openExerciseIdx: null
};

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------
function loadSessions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Failed to load sessions", e);
    return [];
  }
}

function saveSessions(sessions) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

function todayISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function getDraft(dayKey) {
  try {
    const raw = localStorage.getItem(DRAFT_KEY_PREFIX + dayKey);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function saveDraft(dayKey, draft) {
  localStorage.setItem(DRAFT_KEY_PREFIX + dayKey, JSON.stringify(draft));
}

function clearDraft(dayKey) {
  localStorage.removeItem(DRAFT_KEY_PREFIX + dayKey);
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

    html += `<div class="exercise ${isOpen}" data-idx="${idx}">`;
    html += `  <div class="exercise-head" data-toggle="${idx}">
                 <div>
                   <div class="exercise-name">${ex.name}</div>
                   <div class="exercise-target">Target: ${ex.target}</div>
                 </div>
                 <div class="chevron">&#9654;</div>
               </div>`;
    html += `  <div class="sets-wrap">`;
    html += `    <div class="last-time">${lastText}</div>`;
    html += `    <div class="set-header-row"><div></div><div>Weight (kg)</div><div>Reps</div><div>${ex.isHold ? "Sec" : "RPE"}</div><div></div></div>`;

    const savedSets = (draft[ex.name] && draft[ex.name].sets) || [];

    for (let s = 0; s < ex.sets; s++) {
      const saved = savedSets[s] || {};
      const checked = saved.done ? "checked" : "";
      html += `<div class="set-row" data-ex="${idx}" data-set="${s}">
                 <div class="set-num">${s + 1}</div>
                 <input type="number" inputmode="decimal" placeholder="kg" class="inp-weight" value="${saved.weight || ""}" />
                 <input type="number" inputmode="numeric" placeholder="${ex.repHint}" class="inp-reps" value="${saved.reps || ""}" />
                 <input type="number" inputmode="numeric" placeholder="${ex.isHold ? "" : "1-10"}" class="inp-rpe" value="${saved.rpe || ""}" />
                 <button class="set-done-btn ${checked}" data-done="${idx}-${s}">&#10003;</button>
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

  document.querySelectorAll(".notes-input").forEach((inp) => {
    inp.addEventListener("input", () => persistCurrentInputsToDraft(day));
    inp.addEventListener("click", (e) => e.stopPropagation());
  });

  document.getElementById("finishBtn").addEventListener("click", () => finishSession(day));
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
  showToast("Session saved 💪");
  state.openExerciseIdx = null;
  render();
}

// ---------------------------------------------------------------------------
// Rendering: PROGRAM tab (read-only overview of the whole week)
// ---------------------------------------------------------------------------
function renderProgram() {
  document.getElementById("topbarTitle").textContent = "Weekly Program";
  document.getElementById("topbarSub").textContent = "UL Sport Arena · Strength Building Plan";

  const app = document.getElementById("app");
  let html = "";

  PROGRAM.forEach((day) => {
    html += `<div class="card">
      <h2>${day.label} — ${day.dayName}</h2>
      <div class="meta">${day.subtitle}</div>`;
    if (day.warmup) html += `<div class="warmup-note"><b>Warm-up:</b> ${day.warmup}</div>`;
    day.exercises.forEach((ex, i) => {
      html += `<div class="exercise-target" style="margin:6px 0;">${i + 1}. <b style="color:var(--ink)">${ex.name}</b> — ${ex.target}</div>`;
    });
    if (day.cooldown) html += `<div class="cooldown-note"><b>Cool-down:</b> ${day.cooldown}</div>`;
    html += `</div>`;
  });

  app.innerHTML = html;
}

// ---------------------------------------------------------------------------
// Rendering: HISTORY tab
// ---------------------------------------------------------------------------
function renderHistory() {
  document.getElementById("topbarTitle").textContent = "History";
  document.getElementById("topbarSub").textContent = "Past logged sessions";

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
    if (confirm("This will permanently delete all logged sessions on this device. Continue?")) {
      localStorage.removeItem(STORAGE_KEY);
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
  a.download = `strength-tracker-export-${todayISO()}.csv`;
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

function renderPRCard(exerciseName) {
  const wrap = document.getElementById("prCardWrap");
  const logs = findAllLogsForExercise(exerciseName);

  if (logs.length === 0) {
    wrap.innerHTML = `<h2>${exerciseName}</h2><div class="meta">No data logged yet for this exercise.</div>`;
    return;
  }

  const best = logs.reduce((max, l) => (l.weight > max.weight ? l : max), logs[0]);
  const latest = logs[logs.length - 1];

  let html = `<h2>${exerciseName}</h2>
    <div class="meta">Best: <b style="color:var(--good)">${best.weight}kg</b> on ${best.date} &nbsp;·&nbsp; Latest: ${latest.weight}kg on ${latest.date}</div>`;

  logs
    .slice()
    .reverse()
    .slice(0, 10)
    .forEach((l) => {
      html += `<div class="pr-row"><div class="pr-date">${l.date} (${l.reps || "-"} reps)</div><div class="pr-val">${l.weight}kg</div></div>`;
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

render();

// ---------------------------------------------------------------------------
// PWA service worker registration (enables offline use once installed)
// ---------------------------------------------------------------------------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch((e) => console.warn("SW registration failed", e));
  });
}
