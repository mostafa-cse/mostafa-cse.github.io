/* hero.js — Hero role rotator, animated counters, live CP data */

(function () {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── Role rotator ────────────────────────────────────────────────────────
  const typingEl = document.querySelector('.hero-typing');
  if (typingEl && !reduceMotion) {
    const phrases = [
      'Competitive Programmer',
      'Codeforces Expert',
      'Problem Setter',
      'Full-Stack Developer',
    ];
    let pi = 0, ci = 0, deleting = false;

    // On wide screens, reserve the longest phrase's width so the line never reflows.
    // Narrow screens wrap anyway, and a reserved box would only add dead space.
    if (window.innerWidth > 900) {
      const longest = phrases.reduce((a, b) => (b.length > a.length ? b : a));
      typingEl.style.minWidth = `${longest.length}ch`;
    }
    typingEl.textContent = '';

    function type() {
      const current = phrases[pi];
      if (!deleting) {
        typingEl.textContent = current.slice(0, ++ci);
        if (ci === current.length) {
          deleting = true;
          return setTimeout(type, 2200);           // hold the finished phrase
        }
        setTimeout(type, 55 + Math.random() * 45); // human-ish keystrokes
      } else {
        typingEl.textContent = current.slice(0, --ci);
        if (ci === 0) {
          deleting = false;
          pi = (pi + 1) % phrases.length;
          return setTimeout(type, 350);
        }
        setTimeout(type, 28);
      }
    }
    setTimeout(type, 700);
  }

  // ── Animated number counters ────────────────────────────────────────────
  const format = n => n.toLocaleString('en-US');

  function animateCounter(el, target, duration = 1600) {
    const suffix = el.dataset.suffix || '';
    if (reduceMotion) { el.textContent = format(target) + suffix; return; }

    const start = performance.now();
    function step(now) {
      const t = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 4);
      el.textContent = format(Math.round(target * ease)) + suffix;
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  const counterObs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      animateCounter(el, parseInt(el.dataset.target, 10) || 0);
      el.dataset.animated = 'true';
      counterObs.unobserve(el);
    });
  }, { threshold: 0.4 });

  document.querySelectorAll('[data-counter]').forEach(el => counterObs.observe(el));

  // ── Live CP total (refreshed daily by the GitHub Action) ────────────────
  fetch('./data/cp_stats.json', { cache: 'no-cache' })
    .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
    .then(data => {
      const total = Number(data && data.total);
      if (!total) return;

      document.querySelectorAll('.cp-total-num[data-counter], .stat-card [data-counter][data-target="3500"]')
        .forEach(el => {
          const previous = parseInt(el.dataset.target, 10);
          el.dataset.target = total;
          // The counter may already have finished — re-run it to land on the live number
          if (el.dataset.animated === 'true' && total !== previous) animateCounter(el, total, 900);
        });
    })
    .catch(err => console.warn('CP stats unavailable:', err));

  // ── Resume link (configurable without touching markup) ──────────────────
  fetch('./data/config.json', { cache: 'no-cache' })
    .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
    .then(data => {
      const resumeBtn = document.getElementById('resume-btn');
      if (!resumeBtn || data.resumeLink === undefined) return;
      if (String(data.resumeLink).trim() === '') {
        resumeBtn.style.display = 'none';
      } else {
        resumeBtn.href = data.resumeLink;
        resumeBtn.style.display = '';
      }
    })
    .catch(err => console.warn('Config unavailable:', err));

})();
