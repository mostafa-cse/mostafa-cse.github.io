/**
 * routine-engine.js
 * Core engine — fully automatic:
 *   1. Fetches today's contests from all platforms
 *   2. Builds dynamic schedule (no manual toggle)
 *   3. Drives live clock (1s tick), progress tracking, alarms
 *   4. Updates prayer times from GPS location
 */

import { buildSchedule, CATEGORIES, timeToMins, minsToTime, blockDuration, fmtDuration, getPracticeSummary } from './routine-data.js';
import { checkAlarms, initAlarm, toggleAlarmPanel } from './alarm.js';
import { initPrayer, updateActivePrayer } from './prayer.js';
import { initContestInject, getTodayContests } from './contest-inject.js';

let schedule     = [];
let isContestDay = false;

// ─── Init ────────────────────────────────────────────────────────────────────
export async function initRoutine() {
  initAlarm();

  // Start prayer fetch (parallel)
  const prayerPromise = initPrayer();

  // Show skeleton while loading
  showSkeleton();

  // Detect contests first, then build schedule around them
  await initContestInject();
  await prayerPromise;

  const contests = getTodayContests();
  isContestDay = contests.length > 0;

  schedule = buildSchedule(contests);

  renderTable();
  renderPracticeSummary();
  tick();

  // Tick every second for live clock, every 30s for status
  setInterval(updateClock, 1000);
  setInterval(tick,       30000);
  setInterval(updateActivePrayer, 60000);

  // Re-fetch contests every 30 minutes (new contests may be announced)
  setInterval(async () => {
    await initContestInject();
    const fresh = getTodayContests();
    const wasContest = isContestDay;
    isContestDay = fresh.length > 0;
    if (isContestDay !== wasContest || fresh.length !== contests.length) {
      schedule = buildSchedule(fresh);
      renderTable();
      renderPracticeSummary();
      tick();
      showToast('📅 Schedule updated — contest detected!');
    }
  }, 30 * 60 * 1000);

  // Keyboard shortcuts
  document.addEventListener('keydown', handleKey);
  document.getElementById('alarm-bell')?.addEventListener('click', toggleAlarmPanel);

  // Contest-detected event (from contest-inject)
  document.addEventListener('contests-detected', () => {
    const fresh = getTodayContests();
    isContestDay = true;
    schedule = buildSchedule(fresh);
    renderTable();
    renderPracticeSummary();
    tick();
    updateDayBadge();
  });

  document.addEventListener('no-contests', () => {
    updateDayBadge();
  });
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────
function showSkeleton() {
  const tbody = document.getElementById('routine-tbody');
  if (!tbody) return;
  tbody.innerHTML = Array(8).fill(0).map(() => `
    <tr class="skel-row">
      <td><div class="skel skel-sm"></div></td>
      <td><div class="skel skel-badge"></div></td>
      <td><div class="skel skel-lg"></div></td>
      <td><div class="skel skel-sm"></div></td>
      <td><div class="skel skel-md"></div></td>
      <td><div class="skel skel-sm"></div></td>
    </tr>
  `).join('');
}

// ─── Day badge ────────────────────────────────────────────────────────────────
function updateDayBadge() {
  const badge = document.getElementById('day-mode-badge');
  if (!badge) return;
  if (isContestDay) {
    badge.textContent  = '🏆 Contest Day — Auto-detected';
    badge.className    = 'day-badge day-badge-contest';
  } else {
    badge.textContent  = '📚 Normal Practice Day';
    badge.className    = 'day-badge day-badge-normal';
  }
}

// ─── Live clock (1-second interval) ──────────────────────────────────────────
function updateClock() {
  const now = new Date();

  const clockEl = document.getElementById('live-clock');
  if (clockEl) {
    clockEl.textContent = now.toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
    });
  }

  const dateEl = document.getElementById('live-date');
  if (dateEl) {
    dateEl.textContent = now.toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    });
  }
}

// ─── Render schedule table ────────────────────────────────────────────────────
function renderTable() {
  const tbody = document.getElementById('routine-tbody');
  if (!tbody) return;

  tbody.innerHTML = schedule.map((block) => {
    const dur  = blockDuration(block);
    const cat  = CATEGORIES[block.category] || { label: block.category, color: '#94a3b8' };
    const isContest = block.type === 'contest';
    const urlAttr   = block.url ? `data-url="${block.url}"` : '';

    return `
      <tr class="routine-row${isContest ? ' contest-row' : ''}" data-id="${block.id}" data-type="${block.type}" ${urlAttr}>
        <td class="rt-time">${block.start} – ${block.end}</td>
        <td class="rt-cat">
          <span class="cat-badge" style="--cat-color:${cat.color}">${cat.label}</span>
        </td>
        <td class="rt-activity">
          <span class="block-name">${block.activity}</span>
          ${isContest && block.url ? `<a href="${block.url}" target="_blank" rel="noopener" class="contest-link">Open ↗</a>` : ''}
        </td>
        <td class="rt-dur">${fmtDuration(dur)}</td>
        <td class="rt-status">
          <span class="status-badge status-upcoming">○ Upcoming</span>
        </td>
        <td class="rt-progress-cell">
          <div class="mini-progress"><div class="mini-bar" style="width:0%"></div></div>
        </td>
      </tr>
    `;
  }).join('');
}

// ─── Practice summary card ────────────────────────────────────────────────────
function renderPracticeSummary() {
  const el = document.getElementById('practice-summary');
  if (!el) return;

  const totals  = getPracticeSummary(schedule);
  const targets = {
    CF:    8 * 60,
    USACO: 4 * 60,
    TOPIC: 4.5 * 60,
    CSES:  2 * 60,
  };

  el.innerHTML = Object.entries(targets).map(([cat, targetMins]) => {
    const actual  = totals[cat] || 0;
    const catMeta = CATEGORIES[cat];
    const pct     = Math.min(100, Math.round((actual / targetMins) * 100));
    return `
      <div class="ps-item">
        <span class="ps-label" style="color:${catMeta.color}">${catMeta.label}</span>
        <div class="ps-bar-wrap">
          <div class="ps-bar" style="width:${pct}%;background:${catMeta.color}"></div>
        </div>
        <span class="ps-val">${fmtDuration(actual)} <span class="ps-target">/ ${fmtDuration(targetMins)}</span></span>
      </div>`;
  }).join('');

  // Contest blocks
  const contestBlocks = schedule.filter(b => b.type === 'contest');
  if (contestBlocks.length > 0) {
    el.innerHTML += `<div class="ps-contests">
      ${contestBlocks.map(b => `<span class="ps-contest-pill">${b.activity}</span>`).join('')}
    </div>`;
  }
}

// ─── Tick: status updates every 30s ──────────────────────────────────────────
function tick() {
  const now   = new Date();
  const nowM  = now.getHours() * 60 + now.getMinutes();

  let completedCount = 0;
  let practiceCount  = 0;

  for (const block of schedule) {
    let startM = block.startM;
    let endM   = block.endM;

    // Overnight block normalization
    let checkNow = nowM;
    if (startM >= 1380 && nowM < 360) checkNow = nowM + 1440; // after 23:00, pre-06:00

    const isActive = checkNow >= startM && checkNow < endM;
    const isDone   = checkNow >= endM;

    const row = document.querySelector(`.routine-row[data-id="${block.id}"]`);
    if (!row) continue;

    const statusCell  = row.querySelector('.status-badge');
    const progressBar = row.querySelector('.mini-bar');

    if (isActive) {
      const elapsed  = checkNow - startM;
      const total    = endM - startM;
      const pct      = Math.min(100, Math.round((elapsed / total) * 100));
      const minsLeft = total - elapsed;

      const nextBlock = schedule[schedule.indexOf(block) + 1] || null;

      row.classList.add('active-block');
      row.classList.remove('completed-block');
      statusCell.className = 'status-badge status-active';
      statusCell.innerHTML = `<span class="now-pill">▶ NOW</span> ⏳ ${minsLeft}m left`;
      if (progressBar) progressBar.style.width = pct + '%';

      checkAlarms(block, nextBlock, minsLeft);

      // Auto-scroll once
      if (!row.dataset.scrolled) {
        row.dataset.scrolled = '1';
        setTimeout(() => row.scrollIntoView({ behavior: 'smooth', block: 'center' }), 800);
      }

    } else if (isDone) {
      row.classList.remove('active-block');
      row.classList.add('completed-block');
      row.dataset.scrolled = '';
      statusCell.className  = 'status-badge status-done';
      statusCell.innerHTML  = '✅ Done';
      if (progressBar) progressBar.style.width = '100%';
      if (block.type === 'practice') completedCount++;

    } else {
      row.classList.remove('active-block', 'completed-block');
      row.dataset.scrolled = '';
      statusCell.className  = 'status-badge status-upcoming';
      statusCell.innerHTML  = '○ Upcoming';
      if (progressBar) progressBar.style.width = '0%';
    }

    if (block.type === 'practice') practiceCount++;
  }

  // Update overall progress
  const pct = practiceCount > 0 ? Math.round((completedCount / practiceCount) * 100) : 0;
  const el  = document.getElementById('routine-progress-pct');
  if (el) el.textContent = pct + '%';

  updateDayBadge();
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function showToast(msg) {
  const toast = document.getElementById('routine-toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 4500);
}

// ─── Keyboard shortcuts ───────────────────────────────────────────────────────
function handleKey(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  switch (e.key) {
    case 'a': case 'A': toggleAlarmPanel(); break;
    case 'd': case 'D': document.dispatchEvent(new CustomEvent('toggle-theme')); break;
    case 'r': case 'R': initPrayer().then(() => showToast('🕌 Prayer times refreshed')); break;
    case 't': case 'T': window.scrollTo({ top: 0, behavior: 'smooth' }); break;
    case '?': alert('Keyboard Shortcuts:\nA = Alarm Panel\nD = Dark Mode Toggle\nR = Refresh Prayer Times\nT = Scroll to Top\n? = Help'); break;
  }
}
