/* navbar.js — Shared navbar logic */
(function () {
  'use strict';



  // ── Navbar scroll behavior ────────────────────────────────────────────
  // Support both id="navbar" (sub-pages) and class="navbar" (index.html)
  const navbar     = document.getElementById('navbar') || document.querySelector('.navbar');
  // Support both id="nav-progress" and class="nav-progress-bar" / class="nav-progress"
  const progressEl = document.getElementById('nav-progress')
                  || document.querySelector('.nav-progress-bar')
                  || document.querySelector('.nav-progress');

  let ticking = false;

  function onScroll() {
    const scrollY   = window.scrollY;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    if (navbar) navbar.classList.toggle('scrolled', scrollY > 16);
    if (progressEl && maxScroll > 0) {
      const pct = Math.min(100, Math.max(0, (scrollY / maxScroll) * 100));
      progressEl.style.width = `${pct}%`;
      progressEl.setAttribute('aria-valuenow', Math.round(pct));
    }
    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
  }, { passive: true });

  onScroll();

  // ── Hamburger / Mobile Drawer ─────────────────────────────────────────
  // Support both id="nav-mobile-*" (sub-pages) and class-only (index.html)
  const hamburger = document.querySelector('.nav-hamburger');
  const drawer    = document.getElementById('nav-mobile-drawer')    || document.querySelector('.nav-mobile-drawer');
  const overlay   = document.getElementById('nav-mobile-overlay')   || document.querySelector('.nav-mobile-overlay');
  const closeBtn  = document.getElementById('nav-mobile-close')     || document.querySelector('.nav-mobile-close');

  function openDrawer() {
    drawer?.classList.add('open');
    overlay?.classList.add('open');
    document.body.style.overflow = 'hidden';
    hamburger?.setAttribute('aria-expanded', 'true');
  }

  function closeDrawer() {
    drawer?.classList.remove('open');
    overlay?.classList.remove('open');
    document.body.style.overflow = '';
    hamburger?.setAttribute('aria-expanded', 'false');
  }

  hamburger?.addEventListener('click', openDrawer);
  closeBtn?.addEventListener('click', closeDrawer);
  overlay?.addEventListener('click', closeDrawer);
  drawer?.querySelectorAll('a').forEach(a => a.addEventListener('click', closeDrawer));



  // ── Toast system ──────────────────────────────────────────────────────
  window.showToast = function (msg, type = 'info', duration = 4000) {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = { warning: '⚠', success: '✅', error: '❌', info: 'ℹ' };
    toast.textContent = `${icons[type] || ''} ${msg}`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(20px)';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  };

})();
