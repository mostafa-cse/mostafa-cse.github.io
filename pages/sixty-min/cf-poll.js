/**
 * cf-poll.js
 * Poll CF API every 5s for AC submission after timer start.
 *
 * Fix: Compare submissions by creationTimeSeconds > timerStartTime
 *      instead of relying on a "knownSolved" set (which was pre-populated
 *      with ALL solved problems and missed new ones during a session).
 */

import { autoSolve, isRunning, getCurrentProblem, playAlarm } from './timer.js';

let handle       = null;
let pollInterval = null;
let pollActive   = false;
let timerStartedAt = null; // Unix timestamp (seconds) when polling started

const PROXIES = [
  h => `https://corsproxy.io/?${encodeURIComponent(`https://codeforces.com/api/user.status?handle=${h}&from=1&count=30`)}`,
  h => `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://codeforces.com/api/user.status?handle=${h}&from=1&count=30`)}`,
];

export function setHandle(h) {
  handle = h;
}
export function getHandle() { return handle; }

export function startPolling() {
  if (pollActive || !handle) return;
  pollActive   = true;
  timerStartedAt = Math.floor(Date.now() / 1000);
  pollInterval = setInterval(poll, 5000);
  showPollStatus('polling');
}

export function stopPolling() {
  pollActive = false;
  clearInterval(pollInterval);
  timerStartedAt = null;
  showPollStatus('idle');
}

async function poll() {
  if (!isRunning() || !handle) return;
  const problem = getCurrentProblem();

  for (const proxyFn of PROXIES) {
    try {
      const r = await fetch(proxyFn(handle), { signal: AbortSignal.timeout(6000) });
      const d = await r.json();
      if (d.status !== 'OK') continue;

      for (const sub of d.result) {
        if (sub.verdict !== 'OK') continue;
        // Only consider submissions made after the timer started
        if (sub.creationTimeSeconds < timerStartedAt) continue;

        // Match against current problem (if one is set)
        const noTarget = !problem;
        const matchByContestIdx = problem &&
          sub.problem.contestId === problem.contestId &&
          sub.problem.index === problem.problemIdx;
        const matchByName = problem && sub.problem.name === problem.name;

        if (noTarget || matchByContestIdx || matchByName) {
          stopPolling();
          playAlarm(); // 🔔 ring alarm on AC
          autoSolve();
          showACNotify(sub.problem.name);
          return;
        }
      }
      return; // Got a valid response — no match yet
    } catch { /* try next proxy */ }
  }
}

function showPollStatus(status) {
  // Try both possible element IDs
  const el = document.getElementById('cf-poll-status') || document.getElementById('poll-status');
  if (!el) return;
  if (status === 'polling') {
    el.textContent = `👁 Watching for AC (${handle})`;
    el.style.color = '#22c55e';
  } else {
    el.textContent = handle ? `Handle: ${handle}` : 'Set CF handle to enable auto-detect';
    el.style.color = 'var(--color-text-muted)';
  }
}

function showACNotify(name) {
  const overlay = document.getElementById('phase-overlay');
  if (!overlay) return;
  overlay.innerHTML = `
    <div class="po-inner" style="border-color:#22c55e">
      <div class="po-emoji">✅</div>
      <div class="po-label" style="color:#22c55e">Accepted!</div>
      <div class="po-desc">CF detected AC for: ${name}</div>
    </div>
  `;
  overlay.classList.add('show');
  setTimeout(() => overlay.classList.remove('show'), 5000);
}
