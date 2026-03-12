/* navbar.js — Shared navbar logic */
(function () {
  'use strict';

  // ── Theme toggle ──────────────────────────────────────────────────────
  const root     = document.documentElement;
  const themeBtn = document.querySelector('[data-theme-toggle]');
  let currentTheme = 'dark';
  root.setAttribute('data-theme', currentTheme);

  function toggleTheme() {
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', currentTheme);
    updateThemeIcon();
  }

  function updateThemeIcon() {
    if (!themeBtn) return;
    themeBtn.innerHTML = currentTheme === 'dark'
      ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`
      : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
    themeBtn.setAttribute('aria-label', currentTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  }

  if (themeBtn) {
    updateThemeIcon();
    themeBtn.addEventListener('click', toggleTheme);
  }

  // Also dispatch event for pages that listen for theme toggle
  document.addEventListener('toggle-theme', toggleTheme);

  // ── Navbar scroll behavior ────────────────────────────────────────────
  // Support both id="navbar" (sub-pages) and class="navbar" (index.html)
  const navbar     = document.getElementById('navbar') || document.querySelector('.navbar');
  // Support both id="nav-progress" and class="nav-progress-bar" / class="nav-progress"
  const progressEl = document.getElementById('nav-progress')
                  || document.querySelector('.nav-progress-bar')
                  || document.querySelector('.nav-progress');

  function onScroll() {
    const scrollY    = window.scrollY;
    const maxScroll  = document.documentElement.scrollHeight - window.innerHeight;
    if (navbar)     navbar.classList.toggle('scrolled', scrollY > 20);
    if (progressEl && maxScroll > 0) {
      progressEl.style.width = `${Math.min(100, (scrollY / maxScroll) * 100)}%`;
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });

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

  // ── Keyboard shortcuts ────────────────────────────────────────────────
  document.addEventListener('keydown', e => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
    switch (e.key.toLowerCase()) {
      case 'd':      toggleTheme(); break;
      case 't':      window.scrollTo({ top: 0, behavior: 'smooth' }); break;
      case 'escape': closeDrawer(); break;
    }
  });

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
