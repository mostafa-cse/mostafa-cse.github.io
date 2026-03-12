/**
 * heatmap.js — GitHub-style solve heatmap (in-memory mock data)
 */
export function renderHeatmap(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  // Generate 52 weeks of simulated data (in-memory, session-only)
  const cells = [];
  const now = new Date();
  for (let w = 51; w >= 0; w--) {
    for (let d = 6; d >= 0; d--) {
      const date = new Date(now);
      date.setDate(date.getDate() - (w * 7 + d));
      // Simulate solve activity (higher probability in recent weeks)
      const prob = Math.max(0, 0.6 - w * 0.008);
      const count = Math.random() < prob ? Math.floor(Math.random() * 8) : 0;
      const level = count === 0 ? 0 : count <= 1 ? 1 : count <= 3 ? 2 : count <= 5 ? 3 : 4;
      cells.push({ date: date.toISOString().slice(0,10), count, level });
    }
  }

  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const monthLabels = document.createElement('div');
  monthLabels.className = 'hm-months';
  // Simple month markers
  let lastMonth = -1;
  const monthSpans = [];
  for (let w = 0; w < 52; w++) {
    const cellIdx = w * 7;
    if (cellIdx < cells.length) {
      const m = new Date(cells[cellIdx].date).getMonth();
      if (m !== lastMonth) {
        monthSpans.push(`<span class="hm-month">${months[m]}</span>`);
        lastMonth = m;
      }
    }
  }
  monthLabels.innerHTML = monthSpans.join('');

  const heatmap = document.createElement('div');
  heatmap.className = 'heatmap';
  cells.forEach(c => {
    const cell = document.createElement('div');
    cell.className = `hm-cell hm-${c.level}`;
    cell.title = `${c.date}: ${c.count} solves`;
    heatmap.appendChild(cell);
  });

  const legend = document.createElement('div');
  legend.className = 'heatmap-legend';
  legend.innerHTML = 'Less <span class="hm-leg-cell hm-0"></span><span class="hm-leg-cell hm-1"></span><span class="hm-leg-cell hm-2"></span><span class="hm-leg-cell hm-3"></span><span class="hm-leg-cell hm-4"></span> More';

  container.innerHTML = '';
  container.appendChild(monthLabels);
  const wrap = document.createElement('div');
  wrap.className = 'heatmap-wrap';
  wrap.appendChild(heatmap);
  container.appendChild(wrap);
  container.appendChild(legend);

  const total = cells.reduce((s,c) => s + c.count, 0);
  const el = document.getElementById('hm-total');
  if (el) el.textContent = total + ' solves in past year';
}
