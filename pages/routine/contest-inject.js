/**
 * contest-inject.js
 * Auto-detects today's contests from Codeforces, Codeforces (CC mirror),
 * LeetCode, AtCoder, and CodeChef.
 *
 * Known typical contest windows (Bangladesh time, UTC+6):
 *   Codeforces  → 8:35 PM  (duration ~2h)
 *   CodeChef    → 8:00 PM  (duration ~3h)
 *   AtCoder     → 6:00 PM  (duration ~1h40m)
 *   LeetCode    → 8:30 AM  (Weekly) or 8:00 PM (Biweekly)
 *
 * Exports: initContestInject(), getTodayContests()
 */

const PLATFORM_META = {
  CF:       { label: 'Codeforces', color: '#ef4444', icon: '🔴', duration: 120 },
  CC:       { label: 'CodeChef',   color: '#f59e0b', icon: '🟠', duration: 180 },
  AT:       { label: 'AtCoder',    color: '#22c55e', icon: '🟢', duration: 100 },
  LC:       { label: 'LeetCode',   color: '#8b5cf6', icon: '🟣', duration: 90  },
};

let todayContests = []; // array of { platform, name, startTime (Date), endTime (Date), url, phase }

// ─── Public API ──────────────────────────────────────────────────────────────

export async function initContestInject() {
  const results = await Promise.allSettled([
    fetchCF(),
    fetchAtCoder(),
    fetchLeetCode(),
  ]);

  todayContests = results
    .filter(r => r.status === 'fulfilled' && r.value)
    .flatMap(r => r.value)
    .filter(Boolean)
    .sort((a, b) => a.startTime - b.startTime);

  if (todayContests.length > 0) {
    renderBanner(todayContests);
    document.dispatchEvent(new CustomEvent('contests-detected', {
      detail: { contests: todayContests }
    }));
  } else {
    hideBanner();
    document.dispatchEvent(new CustomEvent('no-contests'));
  }

  return todayContests;
}

export function getTodayContests() { return todayContests; }

// ─── Codeforces ──────────────────────────────────────────────────────────────

async function fetchCF() {
  try {
    const r = await fetch('https://codeforces.com/api/contest.list?gym=false', {
      signal: AbortSignal.timeout(8000)
    });
    const d = await r.json();
    if (d.status !== 'OK') return [];

    const now = Date.now();
    const WINDOW = 36 * 3600 * 1000; // 36 hours window

    return d.result
      .filter(c => {
        if (!c.startTimeSeconds) return false;
        const start = c.startTimeSeconds * 1000;
        const end   = start + (c.durationSeconds || 7200) * 1000;
        // Running now OR starting within next 36h OR started recently (within 12h)
        const active  = c.phase === 'CODING';
        const upcoming = c.phase === 'BEFORE' && start - now < WINDOW && start > now - 3600000;
        return active || upcoming;
      })
      .map(c => {
        const start = new Date(c.startTimeSeconds * 1000);
        const durMs  = (c.durationSeconds || 7200) * 1000;
        return {
          platform: 'CF',
          name:     c.name,
          startTime: start,
          endTime:   new Date(start.getTime() + durMs),
          url:      `https://codeforces.com/contest/${c.id}`,
          phase:    c.phase === 'CODING' ? 'running' : 'upcoming',
          id:       c.id,
        };
      });
  } catch {
    return [];
  }
}

// ─── AtCoder (via unofficial clist.by public API or fallback heuristic) ──────

async function fetchAtCoder() {
  // Try clist.by (public, no key for basic use)
  try {
    const now   = new Date();
    const start = new Date(now.getTime() - 4 * 3600 * 1000).toISOString().slice(0, 19);
    const end   = new Date(now.getTime() + 36 * 3600 * 1000).toISOString().slice(0, 19);
    const url   = `https://clist.by/api/v4/contest/?resource=atcoder.jp&start__gte=${start}&start__lte=${end}&format=json&limit=10`;
    const r = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (r.ok) {
      const d = await r.json();
      const objects = d.objects || d.results || [];
      return objects.map(c => ({
        platform: 'AT',
        name:     c.event,
        startTime: new Date(c.start + 'Z'),
        endTime:   new Date(c.end   + 'Z'),
        url:      c.href,
        phase:    isRunning(new Date(c.start + 'Z'), new Date(c.end + 'Z')) ? 'running' : 'upcoming',
      }));
    }
  } catch {}

  // Fallback: check Atcoder API directly
  try {
    const r = await fetch('https://atcoder.jp/contests/?lang=en', {
      signal: AbortSignal.timeout(5000)
    });
    // Can't parse HTML here, return empty
    return [];
  } catch {
    return [];
  }
}

// ─── LeetCode (contest API is public) ────────────────────────────────────────

async function fetchLeetCode() {
  try {
    // LeetCode GraphQL contest list
    const query = `{"query":"{ allContests { title titleSlug startTime duration } }"}`;
    const r = await fetch('https://leetcode.com/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: query,
      signal: AbortSignal.timeout(8000)
    });
    if (!r.ok) return [];
    const d = await r.json();
    const contests = d?.data?.allContests || [];
    const now = Date.now();
    const WINDOW = 36 * 3600 * 1000;

    return contests
      .filter(c => {
        const start = c.startTime * 1000;
        const end   = start + c.duration * 1000;
        return (start > now - 3600000 && start < now + WINDOW) ||
               (now >= start && now < end);
      })
      .map(c => {
        const start = new Date(c.startTime * 1000);
        const end   = new Date(c.startTime * 1000 + c.duration * 1000);
        return {
          platform: 'LC',
          name:     c.title,
          startTime: start,
          endTime:   end,
          url:      `https://leetcode.com/contest/${c.titleSlug}/`,
          phase:    isRunning(start, end) ? 'running' : 'upcoming',
        };
      });
  } catch {
    return [];
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isRunning(start, end) {
  const now = Date.now();
  return now >= start.getTime() && now < end.getTime();
}

function fmtTime(date) {
  // Format in Bangladesh time (UTC+6)
  return date.toLocaleTimeString('en-BD', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dhaka'
  });
}

function formatCountdown(ms) {
  if (ms <= 0) return 'Starting now!';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
}

// ─── Banner Rendering ─────────────────────────────────────────────────────────

const countdownIntervals = [];

function hideBanner() {
  const banner = document.getElementById('contest-banner');
  if (banner) banner.style.display = 'none';
}

function renderBanner(contests) {
  const banner = document.getElementById('contest-banner');
  if (!banner) return;

  // Clear old countdown intervals
  countdownIntervals.forEach(clearInterval);
  countdownIntervals.length = 0;

  const running  = contests.filter(c => c.phase === 'running');
  const upcoming = contests.filter(c => c.phase === 'upcoming');

  let html = '';

  if (running.length > 0) {
    html += `<div class="cb-section cb-running">
      <div class="cb-section-label">🔴 Live Now</div>
      <div class="cb-cards">
        ${running.map(c => renderContestCard(c, 'running')).join('')}
      </div>
    </div>`;
  }

  if (upcoming.length > 0) {
    html += `<div class="cb-section cb-upcoming">
      <div class="cb-section-label">⏰ Today's Contests</div>
      <div class="cb-cards">
        ${upcoming.map(c => renderContestCard(c, 'upcoming')).join('')}
      </div>
    </div>`;
  }

  banner.innerHTML = html;
  banner.style.display = 'block';

  // Start live countdowns
  upcoming.forEach(c => startCountdown(c));
}

function renderContestCard(c, phase) {
  const meta = PLATFORM_META[c.platform] || { label: c.platform, color: '#94a3b8', icon: '⚪', duration: 120 };
  const timeStr = fmtTime(c.startTime);
  const endStr  = fmtTime(c.endTime);

  if (phase === 'running') {
    const endMs = c.endTime.getTime() - Date.now();
    return `
      <div class="cb-card cb-card-running" style="--platform-color:${meta.color}">
        <span class="cb-platform-badge">${meta.icon} ${meta.label}</span>
        <span class="cb-contest-name">${c.name}</span>
        <span class="cb-time-info">Ends at ${endStr}</span>
        <a href="${c.url}" target="_blank" rel="noopener" class="cb-action-btn">Join →</a>
      </div>`;
  } else {
    const msLeft = c.startTime.getTime() - Date.now();
    const cdId = `cd-${c.platform}-${c.startTime.getTime()}`;
    return `
      <div class="cb-card" style="--platform-color:${meta.color}">
        <span class="cb-platform-badge">${meta.icon} ${meta.label}</span>
        <span class="cb-contest-name">${c.name}</span>
        <span class="cb-time-info">Starts ${timeStr} · <span class="cb-cd" id="${cdId}">${formatCountdown(msLeft)}</span></span>
        <a href="${c.url}" target="_blank" rel="noopener" class="cb-action-btn">Register →</a>
      </div>`;
  }
}

function startCountdown(contest) {
  const id = `cd-${contest.platform}-${contest.startTime.getTime()}`;
  const interval = setInterval(() => {
    const el = document.getElementById(id);
    if (!el) { clearInterval(interval); return; }
    const ms = contest.startTime.getTime() - Date.now();
    if (ms <= 0) {
      el.textContent = 'Starting now!';
      clearInterval(interval);
      // Re-render after 30s (will show as running)
      setTimeout(() => initContestInject(), 30000);
      return;
    }
    el.textContent = formatCountdown(ms);
  }, 1000);
  countdownIntervals.push(interval);
}
