/* scroll-animations.js — Scroll-triggered reveals with per-group stagger */

(function () {
  'use strict';

  const items = document.querySelectorAll('.anim-up');
  if (!items.length) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // No IntersectionObserver (or motion turned off): show everything immediately.
  if (reduceMotion || !('IntersectionObserver' in window)) {
    items.forEach(el => el.classList.add('visible'));
    return;
  }

  // Stagger siblings so a grid ripples in rather than popping all at once.
  const STEP = 70;   // ms between siblings
  const CAP  = 350;  // never delay a card more than this
  document.querySelectorAll('.anim-up').forEach(el => {
    if (el.dataset.delay !== undefined) return;
    const siblings = Array.from(el.parentElement ? el.parentElement.children : [])
      .filter(child => child.classList.contains('anim-up'));
    siblings.forEach((sibling, i) => {
      if (sibling.dataset.delay === undefined) sibling.dataset.delay = Math.min(i * STEP, CAP);
    });
  });

  const obs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      el.style.transitionDelay = `${el.dataset.delay || 0}ms`;
      el.classList.add('visible');
      obs.unobserve(el);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

  items.forEach(el => obs.observe(el));

  // Safety net: if anything is still hidden after the page settles, reveal it.
  window.addEventListener('load', () => {
    setTimeout(() => {
      document.querySelectorAll('.anim-up:not(.visible)').forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) el.classList.add('visible');
      });
    }, 400);
  });

})();
