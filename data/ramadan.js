// ── Ramadan Data ────────────────────────────────────────────────────────────
// Fallback dates used when Aladhan API is unreachable (offline mode).
window.RAMADAN_START = "2026-03-01";
window.RAMADAN_END   = "2026-03-30";

// Prayer-time fallbacks (overwritten at runtime by PrayerTimeService)
window.PRAYER_TIMES = {
  fajr:    "04:30",
  dhuhr:   "12:30",
  asr:     "15:45",
  maghrib: "18:10",
  isha:    "20:00"
};

// configurable prayer calculation method (Aladhan API method number)
window.PRAYER_METHOD = 2; // 2 = ISNA

window.ROUTINE = [
  {
    id: "suhoor", start: "04:30", end: "05:00",
    phase: "Pre-Dawn", ramadanOnly: true,
    activity: "Suhoor — wake up, eat a proper meal, drink 1 L water, pray Fajr",
    color: "#f0c040", notify: "break", dynamic: true
    // start/end overwritten at runtime by PrayerTimeService (Fajr − 30 min → Fajr)
  },
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
    id: "weak2", start: "16:00", end: "18:10",
    phase: "Afternoon",
    activity: "Weakness Elimination continued",
    color: "#f4c8a0", notify: "work", warn5min: true
  },
  {
    id: "iftar", start: "18:10", end: "19:00",
    phase: "Iftar", ramadanOnly: true,
    activity: "Iftar Break — break fast, pray Maghrib, rest",
    color: "#f5e07a", notify: null, dynamic: true
    // start overwritten at runtime by PrayerTimeService (Maghrib time)
  },
  {
    id: "precon", start: "19:00", end: "19:30",
    phase: "Afternoon",
    activity: "Pre-Contest Disconnect",
    color: "#f4c8a0", notify: "break"
  },
  {
    id: "evening", start: "19:30", end: "22:00",
    phase: "Evening",
    activity: "Evening Contest / Mock Contest — full contest simulation",
    color: "#b8a8e0", notify: "contest", warn5min: true
  },
  {
    id: "review", start: "22:00", end: "23:00",
    phase: "Night",
    activity: "Review & Journal — upsolve, write contest notes",
    color: "#c8c8cc", notify: "break", warn5min: true
  },
  {
    id: "shutdown", start: "23:00", end: "23:30",
    phase: "Night",
    activity: "Shutdown — plan tomorrow, screen off, sleep by 23:30",
    color: "#c8c8cc", notify: "shutdown"
  }
];

// ── Content Sections ─────────────────────────────────────────────────────────
window.CONTENT = {
  techniques: {
    harshTruths: [
      { title: "Typing is not problem-solving", body: "If your fingers are moving, your brain is usually turned off. Spend 80% of your time on paper, 20% on the keyboard." },
      { title: "Easy problems are a trap", body: "Solving 1,000 easy problems gives you a fake dopamine hit. If you aren't struggling and your brain doesn't physically hurt trying to bridge a logical gap, you aren't growing." },
      { title: "CSES is the wrench, Codeforces is the engine", body: "CSES taught you algorithms. Codeforces will hand you scrap metal and ask you to build a machine. Do not force heavy CSES data structures onto simple CF ad-hoc math problems." },
      { title: "Embrace the Flatline", body: "Your rating will flatline for months. You will feel stupid. Then, overnight, a pattern will click, and you will jump 200 points. Do not quit." },
      { title: "Attempting 200 easy problems is weaker than deeply understanding 30 hard ones", body: "Volume without depth is noise. Each hard problem you truly understand is worth a hundred you skimmed." },
      { title: "An editorial read without a re-implementation is wasted time", body: "Reading a solution and understanding it are different things. Close the tab, open the editor, and rebuild it from memory." }
    ],
    goldenTechniques: [
      "45-minute paper phase: draw examples, find patterns, prove your approach before coding.",
      "Binary search on the answer for monotone functions — always consider this first.",
      "Segment tree with lazy propagation covers 70 % of range-query problems.",
      "DP optimisation order: identify state → recurrence → base cases → transitions.",
      "Graph: model the problem, then pick BFS/DFS/Dijkstra/Bellman-Ford by constraints."
    ]
  },
  micro60: [
    {
      time: "0–5 min",   label: "Reconnaissance",
      body: "Read the problem twice. Check constraints. Guess the intended time complexity. Do NOT touch the keyboard."
    },
    {
      time: "5–25 min",  label: "Observation",
      body: "No keyboard. Pen and paper only. Draw sample cases. Find the math/logic invariant."
    },
    {
      time: "25–35 min", label: "Attack It",
      body: "Try to break your logic with extreme edge cases (e.g., N\u00a0=\u00a01, all zeros, sorted array)."
    },
    {
      time: "35–45 min", label: "Code It",
      body: "Only touch the keyboard if your logic survived your own attacks. Code clean."
    },
    {
      time: "45–60 min", label: "The Struggle",
      body: "Debug or rethink. If completely stuck, write down what you know and isolate the gap."
    },
    {
      time: "60+ min",   label: "Editorial Protocol",
      body: "Read only the first hint. Close the tab. Wait 30\u00a0minutes. Code the solution entirely from memory."
    }
  ],
  keywords: [
    {
      word: "Upsolve",
      quote: "Contests measure your skill; upsolving builds it.",
      body: "Solving problems after the contest ends. Every problem you couldn\u2019t crack during a contest is a gap in your understanding — upsolving is the only way to close it."
    },
    {
      word: "Paper",
      quote: "Your true compiler. A wrong answer on paper costs 0 penalty points.",
      body: "Before touching the keyboard, think on paper. Drawing cases, testing logic, and finding counter-examples on paper is faster and deeper than staring at a blank screen."
    },
    {
      word: "Constraints",
      quote: "The constraints whisper the intended algorithm before you even read the story.",
      body: "N\u2264100 suggests O(N\u00b3). N\u226410\u2075 suggests O(N\u00b7logN). N\u226410\u2079 demands O(logN) or O(1). Read the constraints first \u2014 always."
    },
    {
      word: "Counter-Example",
      quote: "Play devil\u2019s advocate against your own logic before typing a single line.",
      body: "Aggressively try to break your approach with edge cases: N\u00a0=\u00a01, all identical elements, a fully sorted or reversed array, overflow boundaries. If you can\u2019t break it, code it."
    },
    {
      word: "Occam\u2019s Razor",
      quote: "The simplest solution is usually the right one.",
      body: "If a 1400-rated problem requires 150 lines of complex data structures, your approach is wrong. Step back, re-read the constraints, and look for the elegant insight you missed."
    }
  ],
  glossary: [
    { term: "AC",           def: "Accepted — your solution is correct." },
    { term: "WA",           def: "Wrong Answer — logic error in solution." },
    { term: "TLE",          def: "Time Limit Exceeded — optimise complexity." },
    { term: "MLE",          def: "Memory Limit Exceeded — reduce space usage." },
    { term: "Upsolve",      def: "Re-attempt a problem after contest with full time." },
    { term: "Greedy",       def: "Make locally optimal choice at every step." },
    { term: "DP",           def: "Dynamic Programming — overlapping subproblems + optimal substructure." },
    { term: "Segment Tree", def: "Tree for range queries & point/range updates in O(log n)." },
    { term: "Binary Search",def: "Halve search space each iteration — O(log n)." },
    { term: "BFS/DFS",      def: "Breadth/Depth-First Search for graph traversal." }
  ],
  growth: [
    "Solve 1 rated problem per day minimum — consistency beats bursts.",
    "After every contest: upsolve all problems you could not solve during it.",
    "Keep a solution journal: date, problem link, key idea, time taken.",
    "Rate yourself by difficulty solved, not by number of problems.",
    "Every month: pick one weak topic and spend a full week on it.",
    "Study top-rated solutions after AC — there is always a cleaner way.",
    "Join virtual contests to simulate real pressure without affecting rating."
  ],
  strategy: {
    rule10: {
      title: "The Rule of 10",
      subtitle: "When Should I Move to the Next Rating Bracket?",
      body: "Do not blindly solve 300 problems per rating bracket. If you can solve 10 problems in a row at a specific rating (e.g., 1400) within 45 minutes each, without ever looking at the editorial, you have mastered that rating.",
      action: "Move up immediately."
    },
    cfTips: [
      {
        icon: "🛸",
        title: "Stop doing easy problems in practice",
        body: "Jump straight to problems C and D during your CF Foundation blocks. Get comfortable feeling completely lost."
      },
      {
        icon: "🎯",
        title: "Hunt your weaknesses",
        body: "Look at your last 5 contest performances. Identify the exact tag that stopped you, and spend your 03:30\u202fPM block destroying that specific weakness for a whole week."
      },
      {
        icon: "📊",
        title: "Read the Standings",
        body: "During a live contest, if you are stuck on Problem C but 1,000 people have solved Problem D, abandon C immediately. The scoreboard is telling you that D is secretly easier."
      }
    ]
  }
};
