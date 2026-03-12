/**
 * handle.js
 * CF handle tracking: fetch user solved problems, display user card
 */

import { fetchUserSolved, fetchUserInfo } from './cf-api.js';
import { setSolvedSet, updateFilter } from './filters.js';

const _cfls = (() => { try { return window['local'+'Storage']; } catch { return null; } })();
const CF_HANDLE_KEY = 'cf_filter_handle';

export async function initHandle() {
  const input  = document.getElementById('handle-input');
  const btn    = document.getElementById('handle-btn');
  const card   = document.getElementById('user-card');
  const errEl  = document.getElementById('handle-error');

  if (!input || !btn) return;

  // Restore saved handle
  const saved = _cfls?.getItem(CF_HANDLE_KEY);
  if (saved) {
    input.value = saved;
    loadHandle(saved, card, errEl);
  }

  btn.addEventListener('click', () => loadHandle(input.value.trim(), card, errEl));
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') loadHandle(input.value.trim(), card, errEl);
  });
}

async function loadHandle(handle, card, errEl) {
  if (!handle) return;
  card.innerHTML = `<div class="user-card-loading">Loading <span class="spinner"></span></div>`;
  card.style.display = 'block';
  if (errEl) errEl.textContent = '';

  try {
    try { if (_cfls) _cfls.setItem(CF_HANDLE_KEY, handle); } catch {}
    const [userInfo, solved] = await Promise.all([
      fetchUserInfo(handle),
      fetchUserSolved(handle),
    ]);
    setSolvedSet(solved);
    renderUserCard(card, userInfo, solved.size);
  } catch (err) {
    card.style.display = 'none';
    if (errEl) errEl.textContent = err.message;
  }
}

function renderUserCard(card, user, solvedCount) {
  const rankColor = {
    'newbie': '#808080', 'pupil': '#008000', 'specialist': '#03a89e',
    'expert': '#0000ff', 'candidate master': '#aa00aa', 'master': '#ff8c00',
    'international master': '#ff8c00', 'grandmaster': '#ff0000',
    'international grandmaster': '#ff0000', 'legendary grandmaster': '#ff0000',
  }[user.rank?.toLowerCase()] || '#06b6d4';

  card.innerHTML = `
    <div class="user-card-inner">
      <img src="${user.avatar}" alt="${user.handle}" class="user-avatar" onerror="this.src='https://userpic.codeforces.org/no-avatar.jpg'">
      <div class="user-info">
        <div class="user-handle" style="color:${rankColor}">${user.handle}</div>
        <div class="user-rank" style="color:${rankColor}">${user.rank || 'Unranked'}</div>
        <div class="user-stats">
          <span>Rating: <strong style="color:${rankColor}">${user.rating || 'N/A'}</strong></span>
          <span>Max: <strong>${user.maxRating || 'N/A'}</strong></span>
          <span>Solved: <strong style="color:#22c55e">${solvedCount}</strong></span>
        </div>
      </div>
      <button class="user-card-close" onclick="this.closest('#user-card').style.display='none'; window.clearHandle()">✕</button>
    </div>
  `;
  card.style.display = 'block';
}

// Expose for inline onclick
window.clearHandle = function() {
  setSolvedSet(new Set());
  document.getElementById('handle-input').value = '';
};
