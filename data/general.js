// ── General (non-Ramadan) Routine Data ───────────────────────────────────────
// Loaded statically alongside ramadan.js. app.js swaps window.ROUTINE at runtime.
// Prayer times still fetched from geolocation for the prayer watch widget.
window.GENERAL_PRAYER_TIMES = {
  fajr:    "04:30",
  dhuhr:   "12:30",
  asr:     "15:45",
  maghrib: "18:10",
  isha:    "20:00"
};

window.GENERAL_ROUTINE = [
  {
    id: "boot", start: "05:00", end: "05:30",
    phase: "Morning",
    activity: "System Boot — no screens, walk outside or stretch to wake up brain",
    color: "#a8d8b0", notify: "break"
  },
  {
    id: "deep1", start: "05:30", end: "09:30",
    phase: "Morning",
    activity: "Deep Logic & Observation — USACO Silver/Gold (90 min/problem, 45 min on paper)",
    color: "#a8d8b0", notify: "work", warn5min: true
  },
  {
    id: "break1", start: "09:30", end: "10:00",
    phase: "Morning",
    activity: "Break — walk, eat, no screens",
    color: "#a8d8b0", notify: "break"
  },
  {
    id: "deep2", start: "10:00", end: "13:00",
    phase: "Mid-Day",
    activity: "Codeforces Rated Practice — solve 1 problem per 60-min cycle",
    color: "#aac4e8", notify: "work", warn5min: true
  },
  {
    id: "lunch", start: "13:00", end: "14:00",
    phase: "Mid-Day",
    activity: "Lunch Break + Prayer + Rest",
    color: "#aac4e8", notify: "break"
  },
  {
    id: "weak", start: "14:00", end: "15:30",
    phase: "Afternoon",
    activity: "Weakness Elimination — targeted topic drill",
    color: "#f4c8a0", notify: "work", warn5min: true
  },
  {
    id: "rest", start: "15:30", end: "16:00",
    phase: "Afternoon",
    activity: "Pre-Contest Disconnect — walk, no screens, mental reset",
    color: "#f4c8a0", notify: "break"
  },
  {
    id: "deep3", start: "16:00", end: "19:00",
    phase: "Afternoon",
    activity: "Weakness Elimination continued",
    color: "#f4c8a0", notify: "work", warn5min: true
  },
  {
    id: "precon", start: "19:00", end: "20:00",
    phase: "Evening",
    activity: "Pre-Contest Disconnect — walk, no screens, mental reset",
    color: "#f4c8a0", notify: "break"
  },
  {
    id: "evening", start: "20:00", end: "22:30",
    phase: "Evening",
    activity: "Evening Contest / Mock Contest — full contest simulation",
    color: "#b8a8e0", notify: "contest", warn5min: true
  },
  {
    id: "review", start: "22:30", end: "23:30",
    phase: "Night",
    activity: "Review & Journal — upsolve, write contest notes",
    color: "#c8c8cc", notify: "break", warn5min: true
  },
  {
    id: "shutdown", start: "23:30", end: "23:59",
    phase: "Night",
    activity: "Shutdown — plan tomorrow, screen off, sleep by midnight",
    color: "#c8c8cc", notify: "shutdown"
  }
];

window.CONTENT = window.CONTENT || {};
