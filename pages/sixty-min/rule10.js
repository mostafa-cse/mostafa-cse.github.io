/**
 * rule10.js
 * Rule of 10: streak tracking, mastery, freeze tokens
 * ≤45min = +1 streak, >45min = unchanged, editorial = reset
 */

let streak = 0;
let mastery = false;
let freezeTokens = 2;
const MASTERY_THRESHOLD = 10;

export function processResult(entry) {
  const mins = entry.elapsed / 60;
  if (entry.phase === 'editorial') {
    // Editorial used: reset streak, but freeze token can prevent
    if (freezeTokens > 0) {
      // Offer freeze
      return 'offer-freeze';
    }
    resetStreak();
  } else if (mins <= 45) {
    streak = Math.min(streak + 1, MASTERY_THRESHOLD);
    if (streak >= MASTERY_THRESHOLD && !mastery) {
      mastery = true;
      celebrateMastery();
    }
  }
  // >45min: no change
  renderRule10();
  return null;
}

export function useFreeze() {
  if (freezeTokens > 0) {
    freezeTokens--;
    renderRule10();
    return true;
  }
  return false;
}

export function skipFreeze() {
  resetStreak();
}

function resetStreak() {
  streak = 0;
  mastery = false;
  renderRule10();
}

export function getStats() { return { streak, mastery, freezeTokens }; }

function celebrateMastery() {
  const el = document.getElementById('mastery-banner');
  if (el) {
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 6000);
  }
}

export function renderRule10() {
  const container = document.getElementById('rule10-container');
  if (!container) return;

  const dots = Array.from({ length: MASTERY_THRESHOLD }).map((_, i) => `
    <div class="streak-dot ${i < streak ? 'filled' : ''} ${i === streak - 1 && streak > 0 ? 'latest' : ''}">
      ${i < streak ? '✓' : String(i + 1)}
    </div>
  `).join('');

  container.innerHTML = `
    <div class="r10-header">
      <div class="r10-stat">
        <div class="r10-val">${streak}<span>/10</span></div>
        <div class="r10-label">Current Streak</div>
      </div>
      <div class="r10-stat">
        <div class="r10-val" style="color:#f59e0b">${freezeTokens}</div>
        <div class="r10-label">Freeze Tokens</div>
      </div>
      <div class="r10-stat">
        <div class="r10-val" style="color:${mastery ? '#22c55e' : 'var(--text-muted)'}">${mastery ? '🏆' : '—'}</div>
        <div class="r10-label">Mastery</div>
      </div>
    </div>
    <div class="streak-dots">${dots}</div>
    <div class="r10-rules">
      <div class="r10-rule">
        <span class="r10-r-icon" style="color:#22c55e">≤45 min</span>
        <span>Streak +1</span>
      </div>
      <div class="r10-rule">
        <span class="r10-r-icon" style="color:#f59e0b">&gt;45 min</span>
        <span>Streak unchanged</span>
      </div>
      <div class="r10-rule">
        <span class="r10-r-icon" style="color:#ef4444">Editorial</span>
        <span>Streak reset (or use freeze token)</span>
      </div>
    </div>
    <div id="freeze-offer" style="display:none" class="freeze-offer">
      <p>You read the editorial. Use a freeze token to save your streak?</p>
      <div class="freeze-btns">
        <button onclick="useFreeze()" class="btn-freeze">🧊 Use Freeze (${freezeTokens} left)</button>
        <button onclick="skipFreeze()" class="btn-skip">No, reset streak</button>
      </div>
    </div>
  `;
}

// Expose to HTML
window.useFreeze  = () => { useFreeze(); document.getElementById('freeze-offer').style.display = 'none'; };
window.skipFreeze = () => { skipFreeze(); document.getElementById('freeze-offer').style.display = 'none'; };

export function showFreezeOffer() {
  const el = document.getElementById('freeze-offer');
  if (el) el.style.display = 'block';
}
