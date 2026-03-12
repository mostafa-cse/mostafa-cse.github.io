/**
 * charts.js — Chart.js charts for dashboard
 * Supports both static fallback data and live CF API data
 */

let ratingChartInstance = null;
let weekChartInstance   = null;
let tagChartInstance    = null;

export function initCharts(ratingData = null) {
  initRatingChart(ratingData);
  initWeekChart();
  initTagChart();
}

// ─── Rating Trend ─────────────────────────────────────────────────────────────
export function initRatingChart(ratingHistory = null) {
  const ctx = document.getElementById('rating-chart')?.getContext('2d');
  if (!ctx) return;

  if (ratingChartInstance) { ratingChartInstance.destroy(); ratingChartInstance = null; }

  let labels, data, maxRating;

  if (ratingHistory && ratingHistory.length > 0) {
    // Live CF data
    const sorted = [...ratingHistory].sort((a, b) => a.ratingUpdateTimeSeconds - b.ratingUpdateTimeSeconds);
    labels    = sorted.map(r => {
      const d = new Date(r.ratingUpdateTimeSeconds * 1000);
      return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    });
    data      = sorted.map(r => r.newRating);
    maxRating = Math.max(...data);
  } else {
    // Static fallback
    labels    = ['Jan','Mar','May','Jul','Sep','Nov','Jan 26'];
    data      = [1200, 1350, 1480, 1600, 1660, 1700, 1718];
    maxRating = 1718;
  }

  ratingChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Rating',
        data,
        borderColor: '#06b6d4',
        backgroundColor: 'rgba(6,182,212,0.08)',
        borderWidth: 2,
        pointRadius: data.length > 50 ? 2 : 4,
        pointBackgroundColor: data.map((v, i) =>
          v === maxRating ? '#f59e0b' : (i === data.length - 1 ? '#06b6d4' : 'rgba(6,182,212,0.6)')
        ),
        pointHoverRadius: 6,
        fill: true,
        tension: 0.3,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` Rating: ${ctx.parsed.y}`,
          }
        }
      },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#64748b', font: { size: 10 }, maxTicksLimit: 10 } },
        y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#64748b', font: { size: 10 } } }
      }
    }
  });
}

// ─── Problems / Week ──────────────────────────────────────────────────────────
export function initWeekChart(weekData = null) {
  const ctx = document.getElementById('week-chart')?.getContext('2d');
  if (!ctx) return;
  if (weekChartInstance) { weekChartInstance.destroy(); weekChartInstance = null; }

  let labels, probs;
  if (weekData) {
    labels = weekData.map(w => w.label);
    probs  = weekData.map(w => w.count);
  } else {
    labels = Array.from({length:12}, (_,i) => `W${i+1}`);
    probs  = [12,18,14,22,19,25,21,28,24,30,26,32];
  }

  weekChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Problems',
        data: probs,
        backgroundColor: 'rgba(139,92,246,0.45)',
        borderColor: '#8b5cf6',
        borderWidth: 1,
        borderRadius: 4,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 10 } } },
        y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#64748b', font: { size: 10 } } }
      }
    }
  });
}

// ─── Tag Distribution ─────────────────────────────────────────────────────────
export function initTagChart(tagData = null) {
  const ctx = document.getElementById('tag-chart')?.getContext('2d');
  if (!ctx) return;
  if (tagChartInstance) { tagChartInstance.destroy(); tagChartInstance = null; }

  let labels, counts;
  if (tagData && tagData.length > 0) {
    const sorted = tagData.sort((a,b) => b.count - a.count).slice(0, 7);
    labels = sorted.map(t => t.tag);
    counts = sorted.map(t => t.count);
  } else {
    labels = ['DP','Graphs','Greedy','Math','DS','Strings','Other'];
    counts = [520,380,290,240,210,160,700];
  }

  tagChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: counts,
        backgroundColor: ['#06b6d4','#8b5cf6','#f59e0b','#22c55e','#ef4444','#ec4899','#64748b'],
        borderWidth: 0,
        hoverOffset: 6,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { color: '#94a3b8', font: { size: 11 }, padding: 10, boxWidth: 12 } }
      },
      cutout: '65%'
    }
  });
}
