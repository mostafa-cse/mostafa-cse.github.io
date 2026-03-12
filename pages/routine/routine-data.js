/**
 * routine-data.js
 * Dynamic schedule builder for CP Routine.
 *
 * Practice targets (per day):
 *   CF Rating-wise   → 8h
 *   USACO            → 4h
 *   Topic-wise/Contest → 4-5h
 *   CSES Revision    → 2h
 *
 * Auto-inserts contest blocks at the correct time when contests are detected.
 * No manual mode toggle — schedule is always auto-computed.
 */

export const CATEGORIES = {
  CF:      { label: 'CF Rating-wise',   color: '#06b6d4', targetHours: 8   },
  USACO:   { label: 'USACO',            color: '#22c55e', targetHours: 4   },
  TOPIC:   { label: 'Topic / Contest',  color: '#8b5cf6', targetHours: 4   },
  CSES:    { label: 'CSES Revision',    color: '#f59e0b', targetHours: 2   },
  CONTEST: { label: 'Contest',          color: '#ef4444', targetHours: null },
  BREAK:   { label: 'Break',            color: '#64748b', targetHours: null },
  PRAYER:  { label: 'Prayer',           color: '#a78bfa', targetHours: null },
  MEAL:    { label: 'Meal',             color: '#fb923c', targetHours: null },
  SLEEP:   { label: 'Sleep',            color: '#334155', targetHours: null },
  REVIEW:  { label: 'Review / Plan',    color: '#38bdf8', targetHours: null },
  UPSOLVE: { label: 'Upsolving',        color: '#f472b6', targetHours: null },
};

// ─── Fixed daily anchor blocks (prayer, sleep, meals) ──────────────────────
// These do NOT move. Contests get slotted around them.
const ANCHORS = [
  // Morning
  { id: 'a-sleep-end', start: '06:00', end: '06:30', category: 'PRAYER', activity: 'Fajr Prayer + Morning Warm-up', type: 'prayer', fixed: true },
  { id: 'a-breakfast', start: '06:30', end: '07:00', category: 'MEAL',   activity: 'Breakfast',                     type: 'meal',   fixed: true },
  // Midday
  { id: 'a-dhuhr',     start: '12:00', end: '12:30', category: 'PRAYER', activity: 'Dhuhr Prayer',                  type: 'prayer', fixed: true },
  { id: 'a-lunch',     start: '12:30', end: '13:00', category: 'MEAL',   activity: 'Lunch',                         type: 'meal',   fixed: true },
  // Afternoon
  { id: 'a-asr',       start: '15:30', end: '16:00', category: 'PRAYER', activity: 'Asr Prayer',                    type: 'prayer', fixed: true },
  // Evening
  { id: 'a-maghrib',   start: '18:15', end: '18:30', category: 'PRAYER', activity: 'Maghrib Prayer',               type: 'prayer', fixed: true },
  // Night
  { id: 'a-isha',      start: '20:30', end: '21:00', category: 'PRAYER', activity: 'Isha Prayer',                  type: 'prayer', fixed: true },
  // End of day
  { id: 'a-review',    start: '22:30', end: '23:00', category: 'REVIEW', activity: 'Daily Review + Plan Tomorrow', type: 'study',  fixed: true },
  { id: 'a-dinner',    start: '23:00', end: '23:30', category: 'MEAL',   activity: 'Dinner',                       type: 'meal',   fixed: true },
  { id: 'a-sleep',     start: '23:30', end: '06:00', category: 'SLEEP',  activity: 'Sleep',                        type: 'sleep',  fixed: true },
];

// ─── Practice block definitions ─────────────────────────────────────────────
// These are "pools" of practice time. buildSchedule() distributes them
// into free slots left after anchors + contest blocks.
const PRACTICE_POOLS = [
  { id: 'p-cf1',     category: 'CF',    activity: 'CF Rating-wise Practice',      type: 'practice', hours: 2.5 },
  { id: 'p-cf2',     category: 'CF',    activity: 'CF Rating-wise Practice',      type: 'practice', hours: 2.5 },
  { id: 'p-cf3',     category: 'CF',    activity: 'CF Rating-wise Practice',      type: 'practice', hours: 2   },
  { id: 'p-cf4',     category: 'CF',    activity: 'CF Rating-wise Practice',      type: 'practice', hours: 1   },
  { id: 'p-usaco1',  category: 'USACO', activity: 'USACO Practice',               type: 'practice', hours: 2   },
  { id: 'p-usaco2',  category: 'USACO', activity: 'USACO Practice',               type: 'practice', hours: 2   },
  { id: 'p-topic1',  category: 'TOPIC', activity: 'Topic-wise Practice',          type: 'practice', hours: 2   },
  { id: 'p-topic2',  category: 'TOPIC', activity: 'Topic-wise Practice',          type: 'practice', hours: 2   },
  { id: 'p-cses',    category: 'CSES',  activity: 'CSES Revision',                type: 'practice', hours: 2   },
];

// On contest day, we also add upsolving after the contest
const UPSOLVE_BLOCK = { id: 'p-upsolve', category: 'UPSOLVE', activity: 'Contest Upsolving + Review', type: 'practice', hours: 1.5 };

// ─── buildSchedule(contests) ─────────────────────────────────────────────────
/**
 * @param {Array} contests  — from contest-inject.js getTodayContests()
 *                            each: { platform, name, startTime, endTime, url, phase }
 * @returns {Array} schedule rows sorted by start time
 */
export function buildSchedule(contests = []) {
  // 1. Start with anchor blocks (minutes from midnight)
  const rows = ANCHORS.map(a => ({ ...a, startM: timeToMins(a.start), endM: normEnd(a.start, a.end) }));

  // 2. Insert contest blocks (+ 15-min buffer before & after each)
  const contestRows = [];
  const hasContest = contests.length > 0;

  for (const c of contests) {
    const meta = getPlatformMeta(c.platform);

    // Convert contest times to Bangladesh (UTC+6), then to minutes
    const startBD = toLocalMins(c.startTime, 'Asia/Dhaka');
    const endBD   = toLocalMins(c.endTime,   'Asia/Dhaka');

    // Pre-contest buffer (15m)
    const bufStart = Math.max(startBD - 15, timeToMins('06:00'));
    contestRows.push({
      id: `c-prep-${c.platform}`,
      start: minsToTime(bufStart),
      end:   minsToTime(startBD),
      startM: bufStart, endM: startBD,
      category: 'BREAK',
      activity: `${meta.label} Contest Prep / Mental Warm-up`,
      type: 'break', fixed: false,
    });

    // Contest block itself
    contestRows.push({
      id:       `c-${c.platform}-${startBD}`,
      start:    minsToTime(startBD),
      end:      minsToTime(endBD > 1440 ? endBD - 1440 : endBD),
      startM:   startBD,
      endM:     endBD,
      category: 'CONTEST',
      activity: `${meta.icon} ${c.name}`,
      type:     'contest',
      fixed:    false,
      url:      c.url,
      platform: c.platform,
      phase:    c.phase,
    });

    // Upsolving after contest (1.5h)
    const upStart = endBD + 5; // 5-min breather
    const upEnd   = upStart + 90;
    contestRows.push({
      id: `c-upsolve-${c.platform}`,
      start: minsToTime(upStart % 1440),
      end:   minsToTime(upEnd   % 1440),
      startM: upStart, endM: upEnd,
      category: 'UPSOLVE',
      activity: `${meta.label} Upsolving + Editorial Review`,
      type: 'practice', fixed: false,
    });
  }

  // 3. Compute all occupied time ranges
  const occupied = [...rows, ...contestRows].map(r => ({ s: r.startM, e: r.endM }));

  // 4. Find free slots and fill with practice
  const freeSlots = findFreeSlots(occupied);

  // 5. Reduce practice pools on contest day (less CF, no topic — upsolving covers it)
  let pools = [...PRACTICE_POOLS];
  if (hasContest) {
    // On contest day: reduce CF by 2h, reduce topic by 1h (upsolving covers review)
    pools = pools.map(p => {
      if (p.category === 'CF' && p.id === 'p-cf1') return { ...p, hours: 1.5 };
      if (p.category === 'CF' && p.id === 'p-cf4') return { ...p, hours: 0.5 };
      if (p.category === 'TOPIC' && p.id === 'p-topic2') return { ...p, hours: 1 };
      return p;
    });
  }

  // 6. Assign practice pools to free slots (first-fit, minimum 30m per block)
  const practiceRows = assignPractice(pools, freeSlots);

  // 7. Fill remaining gaps with short breaks
  const allRows = [...rows, ...contestRows, ...practiceRows];
  const breakRows = fillBreaks(allRows);

  // 8. Sort all by startM and add visual metadata
  const final = [...allRows, ...breakRows]
    .sort((a, b) => a.startM - b.startM)
    .filter(r => r.endM > r.startM || (r.endM < r.startM && r.id.startsWith('a-sleep'))); // keep overnight sleep

  // Re-number IDs sequentially for stable DOM references
  return final.map((r, i) => ({
    id:       r.id || `s-${i}`,
    start:    r.start  || minsToTime(r.startM),
    end:      r.end    || minsToTime(r.endM % 1440),
    startM:   r.startM,
    endM:     r.endM,
    category: r.category,
    activity: r.activity,
    type:     r.type,
    url:      r.url || null,
    platform: r.platform || null,
    phase:    r.phase || null,
  }));
}

// ─── Free slot finder ────────────────────────────────────────────────────────
function findFreeSlots(occupied) {
  // Sort by start, merge overlapping
  const sorted = [...occupied].sort((a, b) => a.s - b.s);
  const merged = [];
  for (const seg of sorted) {
    if (merged.length && seg.s <= merged[merged.length - 1].e) {
      merged[merged.length - 1].e = Math.max(merged[merged.length - 1].e, seg.e);
    } else {
      merged.push({ ...seg });
    }
  }

  // Day runs 06:00 (360m) to 23:30 (1410m)
  const DAY_START = 360;
  const DAY_END   = 1410;
  const gaps = [];
  let cursor = DAY_START;

  for (const seg of merged) {
    if (seg.s > cursor + 29) { // at least 30m gap
      gaps.push({ s: cursor, e: seg.s });
    }
    cursor = Math.max(cursor, seg.e);
  }
  if (cursor < DAY_END - 29) {
    gaps.push({ s: cursor, e: DAY_END });
  }
  return gaps;
}

// ─── Practice assignment ─────────────────────────────────────────────────────
function assignPractice(pools, slots) {
  const rows = [];
  let slotIndex = 0;
  let slotCursor = slots.length ? slots[0].s : 360;

  for (const pool of pools) {
    let remaining = Math.round(pool.hours * 60); // minutes

    while (remaining > 0 && slotIndex < slots.length) {
      const slot = slots[slotIndex];
      const avail = slot.e - slotCursor;

      if (avail < 30) {
        // Move to next slot
        slotIndex++;
        if (slotIndex < slots.length) slotCursor = slots[slotIndex].s;
        continue;
      }

      const take = Math.min(remaining, avail);
      if (take < 30) break; // Don't create tiny blocks

      rows.push({
        id:       `${pool.id}-${rows.length}`,
        startM:   slotCursor,
        endM:     slotCursor + take,
        start:    minsToTime(slotCursor),
        end:      minsToTime(slotCursor + take),
        category: pool.category,
        activity: pool.activity,
        type:     pool.type,
        fixed:    false,
      });

      slotCursor += take;
      remaining  -= take;

      if (slotCursor >= slot.e) {
        slotIndex++;
        if (slotIndex < slots.length) slotCursor = slots[slotIndex].s;
      }
    }
  }

  return rows;
}

// ─── Break filler ─────────────────────────────────────────────────────────────
function fillBreaks(rows) {
  const breaks = [];
  const sorted = [...rows].sort((a, b) => a.startM - b.startM);
  const occupied = sorted.map(r => ({ s: r.startM, e: r.endM }));
  const gaps = findFreeSlots(occupied);

  for (const g of gaps) {
    const dur = g.e - g.s;
    if (dur >= 5 && dur <= 60) {
      breaks.push({
        id:       `brk-${g.s}`,
        startM:    g.s,
        endM:      g.e,
        start:     minsToTime(g.s),
        end:       minsToTime(g.e),
        category:  'BREAK',
        activity:  dur <= 15 ? 'Short Break' : 'Break + Rest',
        type:      'break',
        fixed:     false,
      });
    }
  }
  return breaks;
}

// ─── Time utilities ───────────────────────────────────────────────────────────

export function timeToMins(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function normEnd(start, end) {
  const s = timeToMins(start);
  let   e = timeToMins(end);
  if (e <= s) e += 1440;
  return e;
}

export function minsToTime(m) {
  const h = Math.floor(((m % 1440) + 1440) % 1440 / 60);
  const min = ((m % 1440) + 1440) % 1440 % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

export function blockDuration(block) {
  return (block.endM || normEnd(block.start, block.end)) - (block.startM || timeToMins(block.start));
}

export function fmtDuration(mins) {
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  }
  return `${mins}m`;
}

function toLocalMins(date, tz) {
  // Get HH:MM in a given timezone
  const s = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz });
  const [h, m] = s.split(':').map(Number);
  // Handle date offset: if it's "next day" we add 1440
  const baseDay = new Date().toLocaleDateString('en-US', { timeZone: tz });
  const contestDay = date.toLocaleDateString('en-US', { timeZone: tz });
  const isDayAfter = new Date(contestDay) > new Date(baseDay);
  return h * 60 + m + (isDayAfter ? 1440 : 0);
}

function getPlatformMeta(platform) {
  const map = {
    CF: { label: 'Codeforces', icon: '🔴' },
    CC: { label: 'CodeChef',   icon: '🟠' },
    AT: { label: 'AtCoder',    icon: '🟢' },
    LC: { label: 'LeetCode',   icon: '🟣' },
  };
  return map[platform] || { label: platform, icon: '🏆' };
}

// ─── Practice summary ─────────────────────────────────────────────────────────
/**
 * Returns total minutes per category in the given schedule
 */
export function getPracticeSummary(schedule) {
  const totals = {};
  for (const block of schedule) {
    if (block.type === 'practice') {
      totals[block.category] = (totals[block.category] || 0) + blockDuration(block);
    }
  }
  return totals;
}
