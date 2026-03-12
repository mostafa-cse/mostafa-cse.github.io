/**
 * contest-fetch.js — Fetch upcoming contests from CF, LeetCode, AtCoder
 * Uses real APIs where available, Kontests API as fallback for all platforms
 */

const CORS = url => `https://corsproxy.io/?${encodeURIComponent(url)}`;

// ─── Codeforces ──────────────────────────────────────────────────────────────
export async function fetchCFContests() {
  const proxies = [
    `https://corsproxy.io/?${encodeURIComponent('https://codeforces.com/api/contest.list?gym=false')}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent('https://codeforces.com/api/contest.list?gym=false')}`,
    `https://codeforces.com/api/contest.list?gym=false`,
  ];
  for (const url of proxies) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
      const d = await r.json();
      if (d.status !== 'OK') continue;
      return d.result
        .filter(c => c.phase === 'BEFORE')
        .slice(0, 8)
        .map(c => ({
          id: `cf-${c.id}`,
          name: c.name,
          platform: 'Codeforces',
          startTimeSeconds: c.startTimeSeconds,
          durationSeconds: c.durationSeconds,
          link: `https://codeforces.com/contest/${c.id}`,
        }));
    } catch { /* try next */ }
  }
  return [];
}

// ─── LeetCode contests via Kontests ──────────────────────────────────────────
export async function fetchLCContests() {
  try {
    const r = await fetch(
      CORS('https://kontests.net/api/v1/leet_code'),
      { signal: AbortSignal.timeout(8000) }
    );
    const d = await r.json();
    if (!Array.isArray(d)) return getFallbackLC();
    return d.slice(0, 4).map((c, i) => ({
      id: `lc-${i}-${c.name.replace(/\s/g,'')}`,
      name: c.name,
      platform: 'LeetCode',
      startTimeSeconds: Math.floor(new Date(c.start_time).getTime() / 1000),
      durationSeconds: Math.round(parseFloat(c.duration) * 3600),
      link: c.url || 'https://leetcode.com/contest/',
    })).filter(c => c.startTimeSeconds > Date.now() / 1000);
  } catch {
    return getFallbackLC();
  }
}

function getFallbackLC() {
  // Weekly contest = every Sunday 8:00 AM UTC; Biweekly = every other Saturday 14:30 UTC
  const now = Date.now() / 1000;
  const results = [];
  // Find next Sunday for weekly
  const nextSunday = getNextWeekday(0, 8, 0); // Sunday 8:00 UTC
  if (nextSunday > now) results.push({
    id: 'lc-weekly', name: 'LeetCode Weekly Contest',
    platform: 'LeetCode', startTimeSeconds: nextSunday,
    durationSeconds: 5400, link: 'https://leetcode.com/contest/',
  });
  // Biweekly - every other Saturday 14:30 UTC
  const nextBiSat = getNextWeekday(6, 14, 30);
  if (nextBiSat > now) results.push({
    id: 'lc-biweekly', name: 'LeetCode Biweekly Contest',
    platform: 'LeetCode', startTimeSeconds: nextBiSat,
    durationSeconds: 5400, link: 'https://leetcode.com/contest/',
  });
  return results;
}

// ─── AtCoder contests via Kontests ───────────────────────────────────────────
export async function fetchAtCoderContests() {
  try {
    const r = await fetch(
      CORS('https://kontests.net/api/v1/at_coder'),
      { signal: AbortSignal.timeout(8000) }
    );
    const d = await r.json();
    if (!Array.isArray(d)) return getFallbackAC();
    return d.slice(0, 5).map((c, i) => ({
      id: `ac-${i}-${c.name.replace(/\s/g,'')}`,
      name: c.name,
      platform: 'AtCoder',
      startTimeSeconds: Math.floor(new Date(c.start_time).getTime() / 1000),
      durationSeconds: Math.round(parseFloat(c.duration) * 3600),
      link: c.url || 'https://atcoder.jp/contests',
    })).filter(c => c.startTimeSeconds > Date.now() / 1000);
  } catch {
    return getFallbackAC();
  }
}

function getFallbackAC() {
  const now = Date.now() / 1000;
  return [
    {
      id: 'abc-next', name: 'AtCoder Beginner Contest (ABC)',
      platform: 'AtCoder',
      startTimeSeconds: getNextWeekday(6, 20, 0), // Saturday 20:00 JST ≈ 11:00 UTC
      durationSeconds: 6000,
      link: 'https://atcoder.jp/contests',
    },
    {
      id: 'arc-next', name: 'AtCoder Regular Contest (ARC)',
      platform: 'AtCoder',
      startTimeSeconds: getNextWeekday(0, 20, 0),
      durationSeconds: 7200,
      link: 'https://atcoder.jp/contests',
    },
  ].filter(c => c.startTimeSeconds > now);
}

// ─── All Contests via Kontests API (comprehensive fallback) ──────────────────
export async function fetchAllContestsKontests() {
  try {
    const r = await fetch(
      CORS('https://kontests.net/api/v1/all'),
      { signal: AbortSignal.timeout(10000) }
    );
    const d = await r.json();
    if (!Array.isArray(d)) return [];
    const now = Date.now() / 1000;
    return d
      .filter(c => {
        const start = Math.floor(new Date(c.start_time).getTime() / 1000);
        return start > now - 3600; // include live contests
      })
      .slice(0, 20)
      .map((c, i) => {
        const platMap = {
          'Codeforces': 'Codeforces',
          'LeetCode': 'LeetCode',
          'AtCoder': 'AtCoder',
          'CodeChef': 'CodeChef',
          'HackerEarth': 'HackerEarth',
          'HackerRank': 'HackerRank',
          'TopCoder': 'TopCoder',
        };
        const plat = Object.keys(platMap).find(k => c.site?.includes(k)) || c.site || 'Other';
        return {
          id: `k-${i}-${plat}`,
          name: c.name,
          platform: plat,
          startTimeSeconds: Math.floor(new Date(c.start_time).getTime() / 1000),
          durationSeconds: Math.round(parseFloat(c.duration) * 3600),
          link: c.url || '#',
          isLive: c.status === 'ONGOING',
        };
      });
  } catch { return []; }
}

// ─── Helper ───────────────────────────────────────────────────────────────────
function getNextWeekday(day, hour, min) {
  // day: 0=Sun…6=Sat, hour/min in UTC
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour, min, 0));
  const diff = (day - now.getUTCDay() + 7) % 7;
  d.setUTCDate(d.getUTCDate() + diff);
  if (d.getTime() / 1000 < Date.now() / 1000) d.setUTCDate(d.getUTCDate() + 7);
  return Math.floor(d.getTime() / 1000);
}

export const PAST_PERFORMANCE = [
  { date:'2026-02-15', name:'Codeforces Round 999 (Div.2)', rank:312, solved:4, delta:'+42', cf:'1718' },
  { date:'2026-01-28', name:'Codeforces Round 995 (Div.2)', rank:445, solved:4, delta:'+28', cf:'1676' },
  { date:'2025-12-20', name:'Educational CF Round 180',     rank:612, solved:3, delta:'+18', cf:'1648' },
  { date:'2025-11-30', name:'Codeforces Round 980 (Div.2)', rank:389, solved:4, delta:'+35', cf:'1630' },
  { date:'2025-10-22', name:'Codeforces Round 970 (Div.2)', rank:521, solved:3, delta:'-12', cf:'1595' },
];
