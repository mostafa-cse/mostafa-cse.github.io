/* scroll-animations.js — Scroll-triggered fade/slide animations */

(function () {
  'use strict';

  const obs = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        const delay = entry.target.dataset.delay || 0;
        setTimeout(() => entry.target.classList.add('visible'), delay);
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.anim-up').forEach((el, i) => {
    // Stagger children if not already set
    if (!el.dataset.delay) {
      const siblings = el.parentElement?.querySelectorAll('.anim-up');
      siblings?.forEach((s, j) => { if (!s.dataset.delay) s.dataset.delay = j * 80; });
    }
    obs.observe(el);
  });

})();
