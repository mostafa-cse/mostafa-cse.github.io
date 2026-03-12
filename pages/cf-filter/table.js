/**
 * table.js — Render problem table, KPI strip, pagination, skeletons
 */

import { getSolvedSet } from './filters.js';

export const PAGE_SIZE = 25;

// ── Rating colour class ───────────────────────────────────────────────────────
export function ratingClass(r) {
  if (!r)        return 'rc-none';
  if (r < 1200)  return 'rc-gray';
  if (r < 1400)  return 'rc-green';
  if (r < 1600)  return 'rc-cyan';
  if (r < 1900)  return 'rc-blue';
  if (r < 2100)  return 'rc-violet';
  if (r < 2400)  return 'rc-amber';
  if (r < 2600)  return 'rc-orange';
  if (r < 3000)  return 'rc-red';
  return 'rc-red-bold';
}

// ── KPI Strip ─────────────────────────────────────────────────────────────────
export function renderKPI(totalProblems, totalContests, filteredCount, solvedCount) {
  const ratingVals = [];
  // We'll compute avg from a sample stored externally — just render counts
  setKPI('kpi-total',    totalProblems.toLocaleString());
  setKPI('kpi-contests', totalContests.toLocaleString());
  setKPI('kpi-filtered', filteredCount.toLocaleString());
  setKPI('kpi-solved',   solvedCount > 0 ? solvedCount.toLocaleString() : '—');
}

function setKPI(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
export function showSkeletons() {
  ['kpi-total','kpi-contests','kpi-filtered','kpi-solved'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '<span class="skel-text"></span>';
  });
  const tbody = document.getElementById('cf-table-body');
  if (tbody) {
    tbody.innerHTML = Array.from({length:8}).map(() =>
      `<tr>${Array.from({length:6}).map(() => '<td><span class="skel-text"></span></td>').join('')}</tr>`
    ).join('');
  }
}

// ── Problem Table ─────────────────────────────────────────────────────────────
export function renderTable(filtered, contestMap, page) {
  const tbody = document.getElementById('cf-table-body');
  if (!tbody) return;

  const solved = getSolvedSet();
  const start  = (page - 1) * PAGE_SIZE;
  const slice  = filtered.slice(start, start + PAGE_SIZE);

  if (slice.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="tbl-empty">No problems match the current filters.</td></tr>`;
    renderPagination(0, 1);
    return;
  }

  tbody.innerHTML = slice.map((p, i) => {
    const key      = `${p.contestId}_${p.index}`;
    const isSolved = solved.has(key);
    const cName    = contestMap[p.contestId]?.name || `Contest ${p.contestId}`;
    const cShort   = cName.length > 28 ? cName.slice(0, 28) + '…' : cName;
    const cfUrl    = `https://codeforces.com/contest/${p.contestId}/problem/${p.index}`;
    const rc       = ratingClass(p.rating);
    const tagHtml  = p.tags.slice(0, 3).map(t =>
      `<span class="tag-pill">${t}</span>`).join('');

    return `<tr class="${isSolved ? 'row-solved' : ''}">
      <td class="td-n">${start + i + 1}</td>
      <td class="td-prob">
        <a href="${cfUrl}" target="_blank" rel="noopener" class="prob-link">${escHtml(p.name)}</a>
        ${tagHtml ? `<div class="tag-row">${tagHtml}</div>` : ''}
      </td>
      <td class="td-cont" title="${escHtml(cName)}">${escHtml(cShort)}</td>
      <td class="td-solves">${p.solveCount.toLocaleString()}</td>
      <td class="td-rating"><span class="rc ${rc}">${p.rating || '—'}</span></td>
      <td class="td-act"><a href="${cfUrl}" target="_blank" rel="noopener" class="solve-btn">Solve →</a></td>
    </tr>`;
  }).join('');

  renderPagination(filtered.length, page);
}

// ── Pagination ────────────────────────────────────────────────────────────────
export function renderPagination(total, page) {
  const wrap = document.getElementById('cf-pagination');
  if (!wrap) return;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  if (totalPages <= 1) { wrap.innerHTML = ''; return; }

  const W = 2; // window around current page
  const pages = [];
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || Math.abs(p - page) <= W) {
      pages.push(p);
    } else if (pages[pages.length - 1] !== '…') {
      pages.push('…');
    }
  }

  wrap.innerHTML =
    `<button class="pg-btn" data-p="${page - 1}" ${page <= 1 ? 'disabled' : ''}>‹ Prev</button>` +
    pages.map(p => p === '…'
      ? `<span class="pg-ellipsis">…</span>`
      : `<button class="pg-btn ${p === page ? 'active' : ''}" data-p="${p}">${p}</button>`
    ).join('') +
    `<button class="pg-btn" data-p="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>Next ›</button>`;
}

function escHtml(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}
