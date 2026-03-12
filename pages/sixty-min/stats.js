/**
 * stats.js
 * Compute and render stats panel: totals, averages, phase breakdown
 */

import { PHASES, fmtTime } from './phases.js';
import { getHistory } from './timer.js';
import { getStats } from './rule10.js';

export function renderStats() {
  const history = getHistory();
  const container = document.getElementById('stats-container');
  if (!container) return;

  if (history.length === 0) {
    container.innerHTML = `<div class="stats-empty">Solve some problems to see stats!</div>`;
    return;
  }

  const totalSolves    = history.length;
  const avgTime        = Math.round(history.reduce((a,e) => a + e.elapsed, 0) / totalSolves);
  const fastest        = history.reduce((a,e) => e.elapsed < a.elapsed ? e : a, history[0]);
  const autoCount      = history.filter(e => e.source === 'auto-cf').length;
  const editorialCount = history.filter(e => e.phase === 'editorial').length;
  const solveRate      = ((totalSolves - editorialCount) / totalSolves * 100).toFixed(0);

  // Phase breakdown
  const phaseCounts = {};
  PHASES.forEach(p => { phaseCounts[p.id] = 0; });
  history.forEach(e => { if (phaseCounts[e.phase] !== undefined) phaseCounts[e.phase]++; });

  // Personal bests by rating band
  const ratedSolves = history.filter(e => e.rating);
  const pbMap = {};
  ratedSolves.forEach(e => {
    const band = Math.floor(e.rating / 200) * 200;
    if (!pbMap[band] || e.elapsed < pbMap[band].elapsed) pbMap[band] = e;
  });

  const r10 = getStats();

  container.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="sc-val">${totalSolves}</div>
        <div class="sc-label">Total Sessions</div>
      </div>
      <div class="stat-card">
        <div class="sc-val">${fmtTime(avgTime)}</div>
        <div class="sc-label">Avg Time</div>
      </div>
      <div class="stat-card">
        <div class="sc-val" style="color:#22c55e">${solveRate}%</div>
        <div class="sc-label">Solve Rate</div>
      </div>
      <div class="stat-card">
        <div class="sc-val" style="color:#06b6d4">${autoCount}</div>
        <div class="sc-label">CF Auto-Detected</div>
      </div>
    </div>

    ${fastest ? `
    <div class="stat-pb">
      <div class="stat-pb-label">⚡ Fastest Solve</div>
      <div class="stat-pb-val">${fastest.problem} — ${fmtTime(fastest.elapsed)}</div>
    </div>` : ''}

    <div class="stat-section-label">Phase Breakdown</div>
    <div class="phase-breakdown">
      ${PHASES.map(p => {
        const count = phaseCounts[p.id] || 0;
        const pct = totalSolves > 0 ? Math.round(count / totalSolves * 100) : 0;
        return `
          <div class="pb-row">
            <span class="pb-phase" style="color:${p.color}">${p.emoji} ${p.label}</span>
            <div class="pb-bar-wrap">
              <div class="pb-bar" style="width:${pct}%;background:${p.color}80"></div>
            </div>
            <span class="pb-count">${count}</span>
          </div>
        `;
      }).join('')}
    </div>

    ${Object.keys(pbMap).length > 0 ? `
    <div class="stat-section-label">Personal Bests by Rating</div>
    <div class="pb-table">
      ${Object.entries(pbMap).sort((a,b) => a[0]-b[0]).map(([band, e]) => `
        <div class="pb-row">
          <span class="pb-band">${band}–${Number(band)+199}</span>
          <span class="pb-problem">${e.problem}</span>
          <span class="pb-time" style="color:#22c55e">${fmtTime(e.elapsed)}</span>
        </div>
      `).join('')}
    </div>` : ''}
  `;
}
