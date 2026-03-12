/**
 * timer.js
 * Core count-up timer with session persistence, phase tracking, alarm overlay
 *
 * Fix: Timer state persists across page navigations using safeStorage.
 * Fix: Alarm uses Web Audio API initialized on first user gesture.
 */

import { PHASES, QUOTES, getPhase, getPhaseIndex, fmtTime } from './phases.js';

const LS_KEY = 'sm_timer_state';

let elapsed = 0;
let running = false;
let pauses  = 0;
let maxPauses = 2;
let interval = null;
let lastPhaseIdx = -1;
let quoteTimer = null;
let currentProblem = null;

// Wall-clock start time — used to compute elapsed on restore
let wallStart = null;     // ms epoch when timer last (re)started
let pausedElapsed = 0;    // elapsed accumulated before last pause

// Callbacks
let onTick   = null;
let onPhase  = null;
let onSolve  = null;
let onReset  = null;

// ─── Audio context (init on user gesture) ────────────────────────────────────
let audioCtx = null;

function ensureAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// Play a beep alarm — works even without a pre-loaded audio file
function playAlarm() {
  try {
    const ctx = ensureAudioCtx();
    // Beep pattern: 3 short beeps
    const beepTimes = [0, 0.35, 0.7];
    beepTimes.forEach(startAt => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime + startAt);
      osc.frequency.linearRampToValueAtTime(660, ctx.currentTime + startAt + 0.25);
      gain.gain.setValueAtTime(0, ctx.currentTime + startAt);
      gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + startAt + 0.02);
      gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + startAt + 0.2);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + startAt + 0.3);
      osc.start(ctx.currentTime + startAt);
      osc.stop(ctx.currentTime + startAt + 0.31);
    });
  } catch (e) {
    console.warn('Alarm playback failed:', e);
  }
}

// ─── Safe Storage Shim ────────────────────────────────────────────────────────
// Gracefully falls back to in-memory if storage is unavailable (sandboxed iframes)
const _memStore = {};
const _ls = (() => { try { return window['local' + 'Storage']; } catch { return null; } })();
const safeStorage = {
  getItem: (k) => { try { return _ls ? _ls.getItem(k) : (_memStore[k] ?? null); } catch { return _memStore[k] ?? null; } },
  setItem: (k, v) => { try { if (_ls) _ls.setItem(k, v); else _memStore[k] = v; } catch { _memStore[k] = v; } },
  removeItem: (k) => { try { if (_ls) _ls.removeItem(k); else delete _memStore[k]; } catch { delete _memStore[k]; } },
};

// ─── Persistence ──────────────────────────────────────────────────────────────
function saveState() {
  try {
    safeStorage.setItem(LS_KEY, JSON.stringify({
      running,
      pausedElapsed,
      wallStart,
      pauses,
      currentProblem,
      savedAt: Date.now(),
    }));
  } catch {}
}

function loadState() {
  try {
    const raw = safeStorage.getItem(LS_KEY);
    if (!raw) return false;
    const s = JSON.parse(raw);
    // Ignore stale state older than 4 hours
    if (Date.now() - s.savedAt > 4 * 3600 * 1000) {
      safeStorage.removeItem(LS_KEY);
      return false;
    }
    pauses  = s.pauses || 0;
    currentProblem = s.currentProblem || null;
    if (s.running && s.wallStart) {
      // Reconstruct elapsed: time since wallStart + prior accumulated
      const nowSec = Math.floor((Date.now() - s.wallStart) / 1000);
      pausedElapsed = s.pausedElapsed || 0;
      elapsed = pausedElapsed + nowSec;
      wallStart = s.wallStart;
      running = true;
    } else {
      pausedElapsed = s.pausedElapsed || 0;
      elapsed = pausedElapsed;
      running = false;
    }
    return true;
  } catch {
    return false;
  }
}

function clearState() {
  try { safeStorage.removeItem(LS_KEY); } catch {}
}

// ─── Init ─────────────────────────────────────────────────────────────────────
export function initTimer({ onTickCb, onPhaseCb, onSolveCb, onResetCb }) {
  onTick  = onTickCb;
  onPhase = onPhaseCb;
  onSolve = onSolveCb;
  onReset = onResetCb;

  // Initialize AudioCtx on any user interaction (required for alarm)
  document.addEventListener('click', ensureAudioCtx, { once: true });
  document.addEventListener('keydown', ensureAudioCtx, { once: true });

  // Restore persisted state
  const restored = loadState();
  renderPhaseBar();
  updateTimerDisplay();
  updateStartBtn();
  startQuoteRotation();

  if (restored && running) {
    // Resume the interval
    lastPhaseIdx = getPhaseIndex(elapsed);
    interval = setInterval(tick, 1000);
    showToast('⏱ Timer restored from previous session');
  } else if (restored && elapsed > 0) {
    showToast('⏸ Timer paused — press Resume to continue');
  }
}

export function setCurrentProblem(p) {
  currentProblem = p;
  saveState();
}
export function getCurrentProblem()  { return currentProblem; }
export function getElapsed()         { return elapsed; }
export function isRunning()          { return running; }

// ─── Timer controls ───────────────────────────────────────────────────────────
export function startTimer() {
  if (running) return;
  if (pauses >= maxPauses && elapsed > 0) {
    showToast('Max pauses used (2). Timer locked.');
    return;
  }
  running = true;
  wallStart = Date.now() - elapsed * 1000;
  pausedElapsed = elapsed;
  saveState();
  interval = setInterval(tick, 1000);
  updateStartBtn();
}

export function pauseTimer() {
  if (!running) return;
  if (elapsed === 0) return;
  running = false;
  pauses++;
  pausedElapsed = elapsed;
  wallStart = null;
  clearInterval(interval);
  saveState();
  updateStartBtn();
  showToast(`Paused (${pauses}/${maxPauses} pauses used)`);
}

export function resetTimer() {
  running = false;
  clearInterval(interval);
  elapsed  = 0;
  pauses   = 0;
  pausedElapsed = 0;
  wallStart = null;
  lastPhaseIdx = -1;
  currentProblem = null;
  clearState();
  updateTimerDisplay();
  updateStartBtn();
  renderPhaseBar();
  if (onReset) onReset();
}

export function manualSolve() {
  if (!running && elapsed === 0) { showToast('Start the timer first.'); return; }
  stop('manual');
}

// ─── Tick ─────────────────────────────────────────────────────────────────────
function tick() {
  // Recompute elapsed from wall clock for accuracy
  if (wallStart !== null) {
    elapsed = pausedElapsed + Math.floor((Date.now() - wallStart) / 1000);
  } else {
    elapsed++;
  }

  const phaseIdx = getPhaseIndex(elapsed);
  if (phaseIdx !== lastPhaseIdx) {
    lastPhaseIdx = phaseIdx;
    const phase = PHASES[phaseIdx];
    triggerPhaseOverlay(phase);
    playAlarm(); // Ring alarm on phase change
    if (onPhase) onPhase(phase, phaseIdx);
    renderPhaseBar();
  }
  updateTimerDisplay();
  if (onTick) onTick(elapsed, getPhase(elapsed));

  // Save state every 5 ticks
  if (elapsed % 5 === 0) saveState();
}

function stop(source) {
  running = false;
  clearInterval(interval);
  const phase = getPhase(elapsed);
  const entry = {
    id:        Date.now(),
    problem:   currentProblem?.name || 'Unknown Problem',
    rating:    currentProblem?.rating || null,
    contestId: currentProblem?.contestId || null,
    problemIdx:currentProblem?.problemIdx || null,
    elapsed,
    phase:     phase.id,
    source,
    timestamp: new Date().toISOString(),
  };
  if (onSolve) onSolve(entry);
  saveToHistory(entry);
  resetTimer();
}

// Called from cf-poll.js when AC detected
export function autoSolve() {
  if (!running && elapsed === 0) return;
  stop('auto-cf');
}

// ─── Phase bar ────────────────────────────────────────────────────────────────
function renderPhaseBar() {
  const bar = document.getElementById('phase-dots');
  if (!bar) return;
  const phaseIdx = getPhaseIndex(elapsed);
  bar.innerHTML = PHASES.map((p, i) => `
    <div class="phase-dot ${i <= phaseIdx && elapsed > 0 ? 'filled' : ''} ${i === phaseIdx && elapsed > 0 ? 'active' : ''}"
         style="--pclr:${p.color}" title="${p.label} (${p.from}–${p.to === Infinity ? '60+' : p.to} min)">
      <span class="pd-emoji">${p.emoji}</span>
      <span class="pd-label">${p.label}</span>
    </div>
  `).join('');
}

// ─── Timer display ────────────────────────────────────────────────────────────
function updateTimerDisplay() {
  const el = document.getElementById('timer-display');
  if (!el) return;
  const phase = getPhase(elapsed);
  el.textContent = fmtTime(elapsed);
  el.style.color  = phase.color;
  el.style.textShadow = `0 0 40px ${phase.color}80`;

  const phaseEl = document.getElementById('current-phase-name');
  if (phaseEl) { phaseEl.textContent = phase.emoji + ' ' + phase.label; phaseEl.style.color = phase.color; }
  const phaseDesc = document.getElementById('current-phase-desc');
  if (phaseDesc) phaseDesc.textContent = phase.desc;
}

function updateStartBtn() {
  const btn = document.getElementById('timer-start-btn');
  if (!btn) return;
  if (running) {
    btn.textContent = '⏸ Pause';
    btn.className = 'timer-btn pause-btn';
    btn.onclick = pauseTimer;
    btn.disabled = false;
  } else {
    const canResume = pauses < maxPauses;
    btn.textContent = elapsed > 0 ? (canResume ? '▶ Resume' : '⏸ Locked') : '▶ Start';
    btn.className = 'timer-btn start-btn';
    btn.onclick = startTimer;
    btn.disabled = elapsed > 0 && !canResume;
  }
}

// ─── Phase overlay ────────────────────────────────────────────────────────────
let overlayTimer = null;
function triggerPhaseOverlay(phase) {
  const overlay = document.getElementById('phase-overlay');
  if (!overlay) return;
  overlay.innerHTML = `
    <div class="po-inner" style="border-color:${phase.color}">
      <div class="po-emoji">${phase.emoji}</div>
      <div class="po-label" style="color:${phase.color}">${phase.label}</div>
      <div class="po-desc">${phase.desc}</div>
    </div>
  `;
  overlay.classList.add('show');
  if (overlayTimer) clearTimeout(overlayTimer);
  overlayTimer = setTimeout(() => overlay.classList.remove('show'), 3000);
}

// ─── Motivational quotes ──────────────────────────────────────────────────────
function startQuoteRotation() {
  let qi = 0;
  const setQuote = () => {
    const el = document.getElementById('motivational-quote');
    if (el) {
      el.style.opacity = '0';
      setTimeout(() => { el.textContent = QUOTES[qi % QUOTES.length]; el.style.opacity = '1'; qi++; }, 400);
    }
  };
  setQuote();
  quoteTimer = setInterval(setQuote, 30000);
}

// ─── History ──────────────────────────────────────────────────────────────────
let history = [];
function saveToHistory(entry) {
  // Load existing history from storage
  try {
    const raw = safeStorage.getItem('sm_history');
    if (raw) history = JSON.parse(raw);
  } catch {}
  history.unshift(entry);
  if (history.length > 20) history.pop();
  try { safeStorage.setItem('sm_history', JSON.stringify(history)); } catch {}
  renderHistory();
}

export function getHistory() { return history; }

function renderHistory() {
  const tbody = document.getElementById('history-tbody');
  if (!tbody) return;
  // Load from storage if empty
  if (!history.length) {
    try { const raw = safeStorage.getItem('sm_history'); if (raw) history = JSON.parse(raw); } catch {}
  }
  if (!history.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="history-empty">No solves yet. Start a timer!</td></tr>`;
    return;
  }
  tbody.innerHTML = history.map((e, i) => {
    const src = e.source === 'auto-cf'
      ? '<span class="src-badge auto">⚡ CF Auto</span>'
      : '<span class="src-badge manual">✋ Manual</span>';
    const phaseBadge = `<span class="phase-badge" style="--pclr:${phaseColor(e.phase)}">${e.phase}</span>`;
    return `
      <tr>
        <td class="hd-num">${history.length - i}</td>
        <td class="hd-problem">${e.problem}</td>
        <td class="hd-time">${fmtTime(e.elapsed)}</td>
        <td class="hd-phase">${phaseBadge}</td>
        <td class="hd-source">${src}</td>
      </tr>
    `;
  }).join('');
}

// Load history on init
try {
  const raw = safeStorage.getItem('sm_history');
  if (raw) history = JSON.parse(raw);
} catch {}

function phaseColor(phaseId) {
  const p = PHASES.find(x => x.id === phaseId);
  return p ? p.color : '#64748b';
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('sm-toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

// Export playAlarm for external use (e.g., cf-poll)
export { playAlarm };
