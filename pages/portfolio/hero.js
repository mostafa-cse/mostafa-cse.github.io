/* hero.js — Hero section: particle canvas, typing animation, particle background */

(function () {
  'use strict';

  // ── Particle canvas ─────────────────────────────────────────────────────
  const canvas = document.getElementById('hero-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H, particles = [], animId;

  function resize() {
    W = canvas.width  = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
  }

  function createParticle() {
    return {
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.5 + 0.5,
      dx: (Math.random() - 0.5) * 0.3,
      dy: (Math.random() - 0.5) * 0.3,
      alpha: Math.random() * 0.5 + 0.1,
      color: Math.random() > 0.5 ? '6,182,212' : '139,92,246',
    };
  }

  function initParticles() {
    particles = Array.from({ length: 120 }, createParticle);
  }

  function drawLines() {
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120) {
          ctx.strokeStyle = `rgba(6,182,212,${0.06 * (1 - dist / 120)})`;
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }
    }
  }

  function tick() {
    ctx.clearRect(0, 0, W, H);
    drawLines();
    particles.forEach(p => {
      p.x += p.dx; p.y += p.dy;
      if (p.x < 0 || p.x > W) p.dx *= -1;
      if (p.y < 0 || p.y > H) p.dy *= -1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.color},${p.alpha})`;
      ctx.fill();
    });
    animId = requestAnimationFrame(tick);
  }

  window.addEventListener('resize', () => { resize(); initParticles(); });
  resize(); initParticles(); tick();

  // Mouse parallax on canvas
  document.addEventListener('mousemove', e => {
    const mx = (e.clientX / window.innerWidth - 0.5) * 0.02;
    const my = (e.clientY / window.innerHeight - 0.5) * 0.02;
    particles.forEach(p => {
      p.x += mx * p.r * 2;
      p.y += my * p.r * 2;
    });
  });

  // ── Typing animation ────────────────────────────────────────────────────
  const typingEl = document.querySelector('.hero-typing');
  if (!typingEl) return;

  const phrases = [
    'Algorithm-Driven Developer',
    'Competitive Programmer',
    'Full-Stack Engineer',
    'Codeforces Expert',
    'MERN Stack Developer',
  ];
  let pi = 0, ci = 0, deleting = false, paused = false;

  function type() {
    if (paused) { setTimeout(type, 1800); paused = false; return; }
    const current = phrases[pi];
    if (!deleting) {
      typingEl.textContent = current.slice(0, ++ci);
      if (ci === current.length) { deleting = true; paused = true; }
      setTimeout(type, 60);
    } else {
      typingEl.textContent = current.slice(0, --ci);
      if (ci === 0) { deleting = false; pi = (pi + 1) % phrases.length; }
      setTimeout(type, 35);
    }
  }
  type();

  // ── Animated number counters ─────────────────────────────────────────────
  function animateCounter(el, target, duration = 1500, suffix = '') {
    const start = performance.now();
    const from = 0;
    function step(now) {
      const t = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(from + (target - from) * ease) + suffix;
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  const counterObs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const target = parseInt(el.dataset.target, 10);
        const suffix = el.dataset.suffix || '';
        animateCounter(el, target, 1500, suffix);
        counterObs.unobserve(el);
      }
    });
  }, { threshold: 0.5 });

  document.querySelectorAll('[data-counter]').forEach(el => counterObs.observe(el));

})();
