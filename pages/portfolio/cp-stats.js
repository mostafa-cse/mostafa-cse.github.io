/* cp-stats.js — Renders the Codeforces panel from data/cp_stats.json
   (refreshed daily by .github/workflows/update_stats.yml).

   Everything drawn here comes from the official Codeforces API. If the data
   file is missing the `cf` block, the whole panel removes itself rather than
   rendering empty chrome. */

(function () {
  'use strict';

  const panel = document.getElementById('cf-panel');
  if (!panel) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Rank ladder. Steps are equal width so every rank keeps a readable label;
  // the marker is placed proportionally *within* the current step.
  const RANKS = [
    { name: 'Newbie',           short: 'Newbie', min: 0,    max: 1199, token: 'newbie' },
    { name: 'Pupil',            short: 'Pupil',  min: 1200, max: 1399, token: 'pupil' },
    { name: 'Specialist',       short: 'Spec',   min: 1400, max: 1599, token: 'specialist' },
    { name: 'Expert',           short: 'Expert', min: 1600, max: 1899, token: 'expert' },
    { name: 'Candidate Master', short: 'CM',     min: 1900, max: 2099, token: 'cm' },
    { name: 'Master',           short: 'Master', min: 2100, max: 2399, token: 'master' },
  ];

  const rankOf   = r => RANKS.find(x => r >= x.min && r <= x.max) || RANKS[RANKS.length - 1];
  const fmt      = n => Number(n).toLocaleString('en-US');
  const esc      = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmtDate  = ts => new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  const fmtFull  = ts => new Date(ts * 1000).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });

  fetch('./data/cp_stats.json', { cache: 'no-cache' })
    .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
    .then(data => {
      const cf = data && data.cf;
      if (!cf || !cf.rating) return panel.remove();
      render(cf, data);
    })
    .catch(err => {
      console.warn('CP stats unavailable:', err);
      panel.remove();
    });

  function render(cf, data) {
    panel.hidden = false;

    // ── Identity ─────────────────────────────────────────────────────────
    const rank = rankOf(cf.rating);
    setText('cf-handle', cf.handle);
    setText('cf-rank-name', titleCase(cf.rank || rank.name));
    setText('cf-rating-now', fmt(cf.rating));
    setText('cf-rating-max', fmt(cf.maxRating));

    const link = document.getElementById('cf-handle-link');
    if (link) link.href = `https://codeforces.com/profile/${cf.handle}`;

    const copyBtn = document.getElementById('cf-copy-handle');
    if (copyBtn) copyBtn.dataset.copy = cf.handle;

    panel.style.setProperty('--rank-color', `var(--rank-${rank.token})`);

    // ── Stat tiles ───────────────────────────────────────────────────────
    setText('cf-stat-solved',   fmt(data.codeforces || 0));
    setText('cf-stat-contests', fmt(cf.contests || 0));
    setText('cf-stat-hardest',  cf.hardest ? fmt(cf.hardest) : '—');
    setText('cf-stat-peak',     fmt(cf.maxRating));

    renderLadder(cf);
    renderChart(cf);
    renderTags(cf);
    renderUpdated(data.updated);
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function titleCase(s) {
    return String(s).replace(/\b\w/g, c => c.toUpperCase());
  }

  // ── Rank ladder ────────────────────────────────────────────────────────
  function renderLadder(cf) {
    const el = document.getElementById('cf-ladder');
    if (!el) return;

    const current = cf.rating;
    const idx     = RANKS.indexOf(rankOf(current));
    const step    = RANKS[idx];
    const within  = (current - step.min) / (step.max - step.min + 1);
    const pos     = ((idx + within) / RANKS.length) * 100;

    el.innerHTML = `
      <div class="ladder-track" role="img"
           aria-label="Codeforces rating ${fmt(current)}, rank ${step.name}">
        ${RANKS.map((r, i) => `
          <div class="ladder-step${i === idx ? ' is-current' : ''}${i < idx ? ' is-passed' : ''}"
               style="--step-color: var(--rank-${r.token})">
            <span class="ladder-step-bar"></span>
            <span class="ladder-step-label">${r.short}</span>
            <span class="ladder-step-min">${r.min}</span>
          </div>`).join('')}
        <div class="ladder-marker" style="left:${pos.toFixed(2)}%">
          <span class="ladder-marker-dot"></span>
          <span class="ladder-marker-value">${fmt(current)}</span>
        </div>
      </div>`;

    const next = RANKS[idx + 1];
    setText('cf-ladder-note', next
      ? `${fmt(next.min - current)} rating points to ${next.name}`
      : `Top of the ladder`);
  }

  // ── Rating history chart ───────────────────────────────────────────────
  // Single series, so no legend: the caption names it. Hover gives a crosshair
  // + tooltip; an equivalent table is exposed to screen readers below.
  function renderChart(cf) {
    const host = document.getElementById('cf-rating-chart');
    const pts  = (cf.ratingHistory || []).filter(p => p && p.t && p.r);
    if (!host || pts.length < 2) { host?.closest('.cf-figure')?.remove(); return; }

    const W = 760, H = 250;
    const P = { t: 20, r: 18, b: 30, l: 44 };
    const iw = W - P.l - P.r;
    const ih = H - P.t - P.b;

    const t0 = pts[0].t, t1 = pts[pts.length - 1].t;
    const ratings = pts.map(p => p.r);
    const yMin = Math.floor((Math.min(...ratings) - 120) / 100) * 100;
    const yMax = Math.ceil((Math.max(...ratings) + 120) / 100) * 100;

    const x = t => P.l + ((t - t0) / (t1 - t0 || 1)) * iw;
    const y = r => P.t + (1 - (r - yMin) / (yMax - yMin)) * ih;

    // Rank thresholds that fall inside the visible range, drawn as reference
    // lines with text labels — context, not a second data series.
    const thresholds = RANKS.filter(r => r.min > yMin && r.min < yMax);

    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.r).toFixed(1)}`).join('');
    const area = `${line}L${x(t1).toFixed(1)},${(P.t + ih).toFixed(1)}L${x(t0).toFixed(1)},${(P.t + ih).toFixed(1)}Z`;

    const peak    = pts.reduce((a, b) => (b.r >= a.r ? b : a), pts[0]);
    const yTicks  = [];
    for (let v = yMin; v <= yMax; v += (yMax - yMin) > 1200 ? 400 : 200) yTicks.push(v);

    host.innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" class="cf-chart-svg" role="img"
           aria-label="Codeforces rating over ${pts.length} rated contests, from ${fmt(pts[0].r)} to ${fmt(pts[pts.length - 1].r)}, peaking at ${fmt(peak.r)}">
        <defs>
          <linearGradient id="cf-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stop-color="var(--color-primary)" stop-opacity="0.28"/>
            <stop offset="100%" stop-color="var(--color-primary)" stop-opacity="0"/>
          </linearGradient>
        </defs>

        ${yTicks.map(v => `
          <line class="cf-grid" x1="${P.l}" x2="${W - P.r}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/>
          <text class="cf-axis" x="${P.l - 10}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${v}</text>`).join('')}

        ${thresholds.map(r => `
          <line class="cf-threshold" x1="${P.l}" x2="${W - P.r}" y1="${y(r.min).toFixed(1)}" y2="${y(r.min).toFixed(1)}"/>
          <text class="cf-threshold-label" x="${P.l + 6}" y="${(y(r.min) - 5).toFixed(1)}">${r.short}</text>`).join('')}

        <path d="${area}" fill="url(#cf-area)"/>
        <path d="${line}" class="cf-line" fill="none"/>

        <circle class="cf-peak" cx="${x(peak.t).toFixed(1)}" cy="${y(peak.r).toFixed(1)}" r="4.5"/>
        <text class="cf-peak-label" x="${x(peak.t).toFixed(1)}" y="${(y(peak.r) - 12).toFixed(1)}" text-anchor="middle">peak ${fmt(peak.r)}</text>

        <text class="cf-axis" x="${P.l}" y="${H - 8}">${fmtDate(t0)}</text>
        <text class="cf-axis" x="${W - P.r}" y="${H - 8}" text-anchor="end">${fmtDate(t1)}</text>

        <g class="cf-hover" hidden>
          <line class="cf-crosshair" x1="-99" x2="-99" y1="${P.t}" y2="${P.t + ih}"/>
          <circle class="cf-hover-dot" cx="-99" cy="-99" r="5"/>
        </g>
      </svg>
      <div class="cf-tooltip" hidden></div>
      <table class="sr-only">
        <caption>Codeforces rating history</caption>
        <thead><tr><th>Date</th><th>Contest</th><th>Rating</th><th>Change</th></tr></thead>
        <tbody>${pts.map(p => `<tr><td>${fmtFull(p.t)}</td><td>${esc(p.name || '')}</td><td>${p.r}</td><td>${p.d > 0 ? '+' : ''}${p.d}</td></tr>`).join('')}</tbody>
      </table>`;

    bindHover(host, pts, x, y, W);
  }

  function bindHover(host, pts, x, y, W) {
    const svg     = host.querySelector('svg');
    const group   = host.querySelector('.cf-hover');
    const cross   = host.querySelector('.cf-crosshair');
    const dot     = host.querySelector('.cf-hover-dot');
    const tooltip = host.querySelector('.cf-tooltip');
    if (!svg || !group) return;

    function move(e) {
      const rect  = svg.getBoundingClientRect();
      const svgX  = ((e.clientX - rect.left) / rect.width) * W;
      // Nearest point by x — hit target is the whole plot, not the 5px dot
      let best = pts[0], bestD = Infinity;
      for (const p of pts) {
        const d = Math.abs(x(p.t) - svgX);
        if (d < bestD) { bestD = d; best = p; }
      }

      group.hidden = false;
      cross.setAttribute('x1', x(best.t));
      cross.setAttribute('x2', x(best.t));
      dot.setAttribute('cx', x(best.t));
      dot.setAttribute('cy', y(best.r));

      tooltip.hidden = false;
      tooltip.innerHTML = `
        <span class="tt-name">${esc(best.name || 'Contest')}</span>
        <span class="tt-row">
          <b>${fmt(best.r)}</b>
          <span class="tt-delta ${best.d >= 0 ? 'up' : 'down'}">${best.d > 0 ? '+' : ''}${best.d}</span>
        </span>
        <span class="tt-meta">${fmtFull(best.t)}${best.place ? ` · rank ${fmt(best.place)}` : ''}</span>`;

      // Follow the point, then clamp inside the figure so edge contests
      // don't push the tooltip out of view.
      const scale = rect.width / W;
      const tip   = tooltip.getBoundingClientRect();
      const halfW = tip.width / 2;
      const px    = Math.min(Math.max(x(best.t) * scale, halfW), rect.width - halfW);
      const py    = Math.max(y(best.r) * scale - 14, tip.height + 4);
      tooltip.style.left = `${px}px`;
      tooltip.style.top  = `${py}px`;
    }

    function leave() {
      group.hidden = true;
      tooltip.hidden = true;
    }

    svg.addEventListener('pointermove', move, { passive: true });
    svg.addEventListener('pointerleave', leave, { passive: true });
  }

  // ── Topic bars ─────────────────────────────────────────────────────────
  function renderTags(cf) {
    const el   = document.getElementById('cf-tag-bars');
    const tags = (cf.topTags || []).slice(0, 8);
    if (!el || !tags.length) { el?.closest('.cf-figure')?.remove(); return; }

    const max = tags[0][1];
    el.innerHTML = tags.map(([name, count], i) => `
      <li class="tag-row" style="--delay:${reduceMotion ? 0 : i * 60}ms">
        <span class="tag-name">${esc(name)}</span>
        <span class="tag-track"><span class="tag-bar" style="--w:${((count / max) * 100).toFixed(1)}%"></span></span>
        <span class="tag-count">${fmt(count)}</span>
      </li>`).join('');

    // Grow the bars once the section scrolls into view
    if (reduceMotion || !('IntersectionObserver' in window)) {
      el.classList.add('is-visible');
      return;
    }
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        el.classList.add('is-visible');
        obs.disconnect();
      });
    }, { threshold: 0.25 });
    obs.observe(el);
  }

  function renderUpdated(updated) {
    if (!updated) return;
    const el = document.getElementById('cf-updated');
    if (!el) return;
    const d = new Date(updated);
    if (isNaN(d)) return;
    el.textContent = `Synced ${d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  }

})();
