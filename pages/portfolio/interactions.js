/* interactions.js — Pointer spotlight, section tracking, scroll affordances */

(function () {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer  = window.matchMedia('(pointer: fine)').matches;

  const CARD_SELECTOR = [
    '.stat-card', '.whatido-card', '.skill-category', '.cp-card',
    '.achievement-card', '.project-card', '.experience-card',
    '.education-card', '.contact-card'
  ].join(',');

  // ── Cursor spotlight ────────────────────────────────────────────────────
  // One delegated listener drives the --mx/--my custom properties that the
  // cards' ::before gradients read, so hovering lights the card from the cursor.
  if (finePointer && !reduceMotion) {
    let pending = null;

    document.addEventListener('pointermove', (e) => {
      const card = e.target.closest && e.target.closest(CARD_SELECTOR);
      if (!card) return;
      pending = { card, x: e.clientX, y: e.clientY };
      requestAnimationFrame(() => {
        if (!pending) return;
        const { card, x, y } = pending;
        pending = null;
        const rect = card.getBoundingClientRect();
        card.style.setProperty('--mx', `${x - rect.left}px`);
        card.style.setProperty('--my', `${y - rect.top}px`);
      });
    }, { passive: true });
  }

  // ── Section tracking: dots rail + nav links ─────────────────────────────
  const sections = document.querySelectorAll('section[data-section]');
  const dots     = document.querySelectorAll('.section-dot');
  const navLinks = document.querySelectorAll('.nav-links a[href^="#"], .nav-mobile-drawer a[href^="#"]');

  if (sections.length && 'IntersectionObserver' in window) {
    let current = '';

    const setActive = (id) => {
      if (id === current) return;
      current = id;
      dots.forEach(dot => dot.classList.toggle('active', dot.dataset.target === id));
      navLinks.forEach(link => link.classList.toggle('active', link.getAttribute('href') === `#${id}`));
    };

    const visible = new Map();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) visible.set(entry.target.id, entry.intersectionRatio);
        else visible.delete(entry.target.id);
      });
      // The section occupying the most of the viewport wins
      let best = '', bestRatio = 0;
      visible.forEach((ratio, id) => { if (ratio > bestRatio) { bestRatio = ratio; best = id; } });
      if (best) setActive(best);
    }, { threshold: [0.15, 0.35, 0.6], rootMargin: '-15% 0px -35% 0px' });

    sections.forEach(section => observer.observe(section));
  }

  // ── Scroll-to-top ───────────────────────────────────────────────────────
  const scrollTopBtn = document.querySelector('.scroll-top-btn');
  if (scrollTopBtn) {
    let ticking = false;
    const update = () => {
      scrollTopBtn.classList.toggle('visible', window.scrollY > window.innerHeight * 0.75);
      ticking = false;
    };
    window.addEventListener('scroll', () => {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();

    const toTop = () => window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    scrollTopBtn.addEventListener('click', toTop);

    // "T" jumps to the top, as advertised in the button's tooltip
    document.addEventListener('keydown', (e) => {
      if (e.key !== 't' && e.key !== 'T') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) return;
      toTop();
    });
  }

  // ── Close the mobile drawer with Escape ─────────────────────────────────
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const drawer = document.querySelector('.nav-mobile-drawer.open');
    if (drawer) document.querySelector('.nav-mobile-close')?.click();
  });

  // ── Portrait parallax ───────────────────────────────────────────────────
  const portrait = document.querySelector('.hero-image-wrapper');
  if (portrait && finePointer && !reduceMotion) {
    const hero = document.querySelector('.hero');
    hero.addEventListener('pointermove', (e) => {
      const dx = (e.clientX / window.innerWidth - 0.5) * 14;
      const dy = (e.clientY / window.innerHeight - 0.5) * 14;
      portrait.style.translate = `${dx}px ${dy}px`;
    }, { passive: true });
    hero.addEventListener('pointerleave', () => { portrait.style.translate = ''; }, { passive: true });
  }

})();
