/**
 * cf-api.js
 * Codeforces API fetcher — direct CF API (CORS-enabled endpoints)
 * Falls back to multiple CORS proxies if needed
 */

const CF = 'https://codeforces.com/api';

// Multiple proxy options to try in order
const PROXIES = [
  'https://corsproxy.io/?',
  'https://api.allorigins.win/raw?url=',
  'https://cors-anywhere.herokuapp.com/',
];

let problemsCache  = null;
let contestsCache  = null;

async function cfFetch(endpoint) {
  const directUrl = `${CF}${endpoint}`;

  // 1. Try direct (works in deployed environment)
  try {
    const r = await fetch(directUrl, { signal: AbortSignal.timeout(12000) });
    if (r.ok) {
      const d = await r.json();
      if (d.status === 'OK') return d;
    }
  } catch {}

  // 2. Try each proxy
  for (const proxy of PROXIES) {
    try {
      const url = proxy + encodeURIComponent(directUrl);
      const r = await fetch(url, { signal: AbortSignal.timeout(12000) });
      if (!r.ok) continue;
      const text = await r.text();
      const d = JSON.parse(text);
      if (d.status === 'OK') return d;
    } catch {}
  }

  throw new Error('Could not reach Codeforces API. Please check your connection.');
}

export async function fetchProblems() {
  if (problemsCache) return problemsCache;

  const d = await cfFetch('/problemset.problems');
  const problems = d.result.problems;
  const stats    = d.result.problemStatistics;

  // Build a solve-count map
  const solveMap = {};
  stats.forEach(s => {
    solveMap[`${s.contestId}_${s.index}`] = s.solvedCount || 0;
  });

  problemsCache = problems.map(p => ({
    contestId:  p.contestId,
    index:      p.index,
    name:       p.name,
    rating:     p.rating || null,
    tags:       p.tags || [],
    solveCount: solveMap[`${p.contestId}_${p.index}`] || 0,
  }));

  return problemsCache;
}

export async function fetchContests() {
  if (contestsCache) return contestsCache;
  const d = await cfFetch('/contest.list?gym=false');
  contestsCache = d.result;
  return contestsCache;
}

export async function fetchUserSolved(handle) {
  const d = await cfFetch(`/user.status?handle=${encodeURIComponent(handle)}&from=1&count=10000`);
  const solved = new Set();
  d.result.forEach(sub => {
    if (sub.verdict === 'OK') {
      solved.add(`${sub.problem.contestId}_${sub.problem.index}`);
    }
  });
  return solved;
}

export async function fetchUserInfo(handle) {
  const d = await cfFetch(`/user.info?handles=${encodeURIComponent(handle)}`);
  return d.result[0];
}

export function getContestDiv(name = '') {
  const n = name.toLowerCase();
  if (n.includes('educational'))                         return 'educational';
  if (n.includes('global'))                              return 'global';
  if (n.includes('div. 1 + div. 2') || n.includes('div.1+2') || n.includes('div. 1+2')) return 'div12';
  if (n.includes('div. 1') && !n.includes('div. 2'))    return 'div1';
  if (n.includes('div. 2'))                             return 'div2';
  if (n.includes('div. 3'))                             return 'div3';
  if (n.includes('div. 4'))                             return 'div4';
  return 'other';
}

export function buildContestMap(contests) {
  const map = {};
  contests.forEach(c => {
    map[c.id] = {
      name:      c.name,
      div:       getContestDiv(c.name),
      startTime: c.startTimeSeconds,
    };
  });
  return map;
}
