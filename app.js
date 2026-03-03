/* ═══════════════════════════════════════════════════════════════════════════
   CP Routine — app.js
   All classes: AuroraWaves, ThreeJSBackground, NextPrayerWatch, RealTimeClock,
   RoutineEngine, TimelineView, PrayerTimeService, RamadanCountdown,
   AudioAlertService, Stopwatch, CountdownTimer
════════════════════════════════════════════════════════════════════════════ */
'use strict';

// ── Helpers ──────────────────────────────────────────────────────────────────
const APP_TIMEZONE = 'Asia/Dhaka';

function zonedNow(timeZone = APP_TIMEZONE) {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour12: false,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).formatToParts(now).reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value;
    return acc;
  }, {});

  return new Date(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
    now.getMilliseconds()
  );
}

function pad(n, d = 2) { return String(n).padStart(d, '0'); }
function hhmm(h, m) { return pad(h) + ':' + pad(m); }
function parseHHMM(str) {
  const [h, m] = str.split(':').map(Number);
  return h * 60 + m;
}
function minsToHHMM(mins) { return hhmm(Math.floor(mins / 60), mins % 60); }
function addMinutes(timeStr, delta) {
  let t = parseHHMM(timeStr) + delta;
  if (t < 0) t += 1440;
  if (t >= 1440) t -= 1440;
  return minsToHHMM(t);
}
function nowMinutes(d = zonedNow()) { return d.getHours() * 60 + d.getMinutes(); }
function secondsUntil(targetHHMM, now = zonedNow()) {
  const tm = parseHHMM(targetHHMM) * 60;
  const nm = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  let diff = tm - nm;
  if (diff < 0) diff += 86400;
  return diff;
}
function formatHMS(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return pad(h) + ':' + pad(m) + ':' + pad(s);
}
function getCSSVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
function dispatch(name, detail = {}) {
  document.dispatchEvent(new CustomEvent(name, { detail }));
}

// ══════════════════════════════════════════════════════════════════════════════
// CANVAS 2D AURORA WAVES (smooth continuous gradient animation)
// ══════════════════════════════════════════════════════════════════════════════
class AuroraWaves {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.mouse = { x: 0.5, y: 0.5 };
    this.time = 0;
    this._resize();

    window.addEventListener('resize', () => this._resize());

    const hero = this.canvas.closest('.hero') || this.canvas.parentElement;
    if (hero) {
      hero.addEventListener('mousemove', e => {
        const r = this.canvas.getBoundingClientRect();
        this.mouse.x = (e.clientX - r.left) / this.W;
        this.mouse.y = (e.clientY - r.top) / this.H;
      });
    }

    // Wave layers — unified deep blue palette
    this.waves = [
      { color: [15, 40, 120],  amp: 0.20, freq: 0.7,  speed: 0.010, phase: 0,    yOff: 0.30 },
      { color: [30, 65, 160],  amp: 0.16, freq: 1.1,  speed: 0.016, phase: 1.8,  yOff: 0.40 },
      { color: [83, 131, 220], amp: 0.13, freq: 1.4,  speed: 0.013, phase: 3.5,  yOff: 0.50 },
      { color: [45, 90, 180],  amp: 0.18, freq: 0.5,  speed: 0.007, phase: 1.0,  yOff: 0.62 },
      { color: [20, 55, 140],  amp: 0.11, freq: 1.8,  speed: 0.020, phase: 2.8,  yOff: 0.72 },
      { color: [60, 110, 200], amp: 0.09, freq: 2.2,  speed: 0.025, phase: 4.5,  yOff: 0.82 },
    ];

    // Floating orbs — all blue tones
    this.orbs = [];
    const orbColors = [
      [20, 55, 180], [45, 90, 200], [83, 131, 220],
      [13, 36, 120], [55, 100, 190], [30, 70, 170],
      [70, 120, 210], [40, 80, 160],
    ];
    for (let i = 0; i < 8; i++) {
      this.orbs.push({
        x: Math.random(),
        y: Math.random(),
        r: 50 + Math.random() * 120,
        vx: (Math.random() - 0.5) * 0.0003,
        vy: (Math.random() - 0.5) * 0.00025,
        color: orbColors[i],
        alpha: 0.04 + Math.random() * 0.06,
      });
    }

    // Floating star particles
    this.stars = [];
    for (let i = 0; i < 60; i++) {
      this.stars.push({
        x: Math.random(),
        y: Math.random(),
        size: 0.5 + Math.random() * 2,
        speed: 0.0001 + Math.random() * 0.0003,
        twinkleSpeed: 0.02 + Math.random() * 0.04,
        twinklePhase: Math.random() * Math.PI * 2,
        alpha: 0.15 + Math.random() * 0.35,
      });
    }

    this._raf = null;
    this._loop();
  }

  _resize() {
    this.W = this.canvas.offsetWidth  || this.canvas.parentElement.offsetWidth;
    this.H = this.canvas.offsetHeight || this.canvas.parentElement.offsetHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width  = this.W * dpr;
    this.canvas.height = this.H * dpr;
    this.ctx.scale(dpr, dpr);
  }

  _loop() {
    this._raf = requestAnimationFrame(() => this._loop());
    this._draw();
  }

  _waveY(w, nx, H) {
    const mouseBend = Math.sin((nx - this.mouse.x) * Math.PI) * (this.mouse.y - 0.5) * 0.05;
    return w.yOff * H +
      Math.sin(nx * Math.PI * 2 * w.freq + w.phase) * w.amp * H * 0.5 +
      Math.sin(nx * Math.PI * 3.7 + w.phase * 1.3) * w.amp * H * 0.25 +
      Math.cos(nx * Math.PI * 1.3 - w.phase * 0.7) * w.amp * H * 0.15 +
      Math.sin(nx * Math.PI * 5.1 + w.phase * 0.5) * w.amp * H * 0.08 +
      mouseBend * H;
  }

  _draw() {
    const { ctx, W, H } = this;
    this.time += 1;

    ctx.clearRect(0, 0, W, H);

    // ── Ambient background glow ───────────────────────────────────────────
    const bgGlow = ctx.createRadialGradient(W * 0.3, H * 0.3, 0, W * 0.3, H * 0.3, W * 0.6);
    bgGlow.addColorStop(0, 'rgba(20,55,120,0.06)');
    bgGlow.addColorStop(1, 'rgba(10,22,40,0)');
    ctx.fillStyle = bgGlow;
    ctx.fillRect(0, 0, W, H);

    // ── Twinkling star particles ──────────────────────────────────────────
    for (const s of this.stars) {
      s.y -= s.speed;
      if (s.y < -0.02) { s.y = 1.02; s.x = Math.random(); }
      const twinkle = 0.5 + Math.sin(this.time * s.twinkleSpeed + s.twinklePhase) * 0.5;
      const a = s.alpha * twinkle;
      if (a < 0.02) continue;
      const sx = s.x * W, sy = s.y * H;
      ctx.beginPath();
      ctx.arc(sx, sy, s.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(180,200,255,${a.toFixed(3)})`;
      ctx.fill();
      // Tiny glow around brighter stars
      if (s.size > 1.2 && a > 0.2) {
        const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, s.size * 4);
        glow.addColorStop(0, `rgba(130,170,255,${(a * 0.2).toFixed(3)})`);
        glow.addColorStop(1, 'rgba(130,170,255,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(sx - s.size * 4, sy - s.size * 4, s.size * 8, s.size * 8);
      }
    }

    // ── Floating gradient orbs ────────────────────────────────────────────
    for (const orb of this.orbs) {
      orb.x += orb.vx + (this.mouse.x - 0.5) * 0.0001;
      orb.y += orb.vy + (this.mouse.y - 0.5) * 0.00008;
      if (orb.x < -0.15) orb.x = 1.15;
      if (orb.x > 1.15) orb.x = -0.15;
      if (orb.y < -0.15) orb.y = 1.15;
      if (orb.y > 1.15) orb.y = -0.15;

      const cx = orb.x * W;
      const cy = orb.y * H;
      const rScale = orb.r * (1 + Math.sin(this.time * 0.006 + orb.x * 4) * 0.25);
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rScale);
      grad.addColorStop(0, `rgba(${orb.color[0]},${orb.color[1]},${orb.color[2]},${orb.alpha})`);
      grad.addColorStop(0.6, `rgba(${orb.color[0]},${orb.color[1]},${orb.color[2]},${(orb.alpha * 0.3).toFixed(4)})`);
      grad.addColorStop(1, `rgba(${orb.color[0]},${orb.color[1]},${orb.color[2]},0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(cx - rScale, cy - rScale, rScale * 2, rScale * 2);
    }

    // ── Flowing wave layers ───────────────────────────────────────────────
    for (const w of this.waves) {
      w.phase += w.speed;
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let x = 0; x <= W; x += 3) {
        ctx.lineTo(x, this._waveY(w, x / W, H));
      }
      ctx.lineTo(W, H);
      ctx.closePath();

      const grad = ctx.createLinearGradient(0, w.yOff * H - w.amp * H, 0, H);
      grad.addColorStop(0, `rgba(${w.color[0]},${w.color[1]},${w.color[2]},0.14)`);
      grad.addColorStop(0.35, `rgba(${w.color[0]},${w.color[1]},${w.color[2]},0.07)`);
      grad.addColorStop(1, `rgba(${w.color[0]},${w.color[1]},${w.color[2]},0)`);
      ctx.fillStyle = grad;
      ctx.fill();

      // Glowing crest line
      ctx.beginPath();
      for (let x = 0; x <= W; x += 3) {
        const y = this._waveY(w, x / W, H);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      const pulse = 0.5 + Math.sin(this.time * 0.018 + w.phase) * 0.35;
      ctx.strokeStyle = `rgba(${w.color[0]},${w.color[1]},${w.color[2]},${(0.18 + pulse * 0.12).toFixed(3)})`;
      ctx.lineWidth = 1.8;
      ctx.shadowBlur = 8;
      ctx.shadowColor = `rgba(${w.color[0]},${w.color[1]},${w.color[2]},0.15)`;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // ── Mouse-following spotlight ──────────────────────────────────────────
    const spotX = this.mouse.x * W;
    const spotY = this.mouse.y * H;
    const spotR = 200 + Math.sin(this.time * 0.012) * 50;
    const spotGrad = ctx.createRadialGradient(spotX, spotY, 0, spotX, spotY, spotR);
    spotGrad.addColorStop(0, 'rgba(83,131,220,0.09)');
    spotGrad.addColorStop(0.5, 'rgba(45,90,170,0.03)');
    spotGrad.addColorStop(1, 'rgba(83,131,220,0)');
    ctx.fillStyle = spotGrad;
    ctx.fillRect(0, 0, W, H);

    // ── Gentle vignette ───────────────────────────────────────────────────
    const vig = ctx.createRadialGradient(W / 2, H / 2, W * 0.25, W / 2, H / 2, W * 0.75);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(6,14,36,0.15)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
  }

  setTheme() { /* AuroraWaves is theme-agnostic — no-op so midnight mode-switch doesn't throw */ }

  destroy() {
    if (this._raf) cancelAnimationFrame(this._raf);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// THREE.JS HERO BACKGROUND
// ══════════════════════════════════════════════════════════════════════════════
class ThreeJSBackground {
  constructor(canvasId, theme) {
    if (typeof THREE === 'undefined') return; // graceful if offline
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);
    this.camera.position.z = 30;
    this._mouse = { x: 0, y: 0 };
    this._objects = [];
    this._resize();
    this.buildScene(theme);
    window.addEventListener('resize', () => this._resize());
    document.addEventListener('mousemove', e => {
      this._mouse.x = (e.clientX / window.innerWidth - 0.5) * 2;
      this._mouse.y = (e.clientY / window.innerHeight - 0.5) * 2;
    });
    this.renderer.setAnimationLoop(() => this._animate());
  }

  _resize() {
    if (!this.canvas) return;
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  buildScene(theme) {
    if (!this.scene) return;
    // Dispose old objects
    this._objects.forEach(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
      this.scene.remove(o);
    });
    this._objects = [];

    if (theme === 'ramadan') {
      this._buildRamadanScene();
    } else {
      this._buildGeneralScene();
    }
  }

  _buildRamadanScene() {
    // 1. Gold star field
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(1200 * 3);
    for (let i = 0; i < 1200 * 3; i++) positions[i] = (Math.random() - 0.5) * 160;
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const stars = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x5383DC, size: 0.15, transparent: true, opacity: 0.8 }));
    this.scene.add(stars); this._objects.push(stars);

    // 2. Octagram rings (3 sizes)
    [6, 9, 12].forEach((r, i) => {
      const icoGeo = new THREE.IcosahedronGeometry(r, 1);
      const edges = new THREE.EdgesGeometry(icoGeo);
      const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({
        color: 0x5383DC, transparent: true, opacity: 0.22 - i * 0.04
      }));
      line._speed = [0.001 + i * 0.0005, 0.0007 + i * 0.0004, 0.0003 + i * 0.0006];
      this.scene.add(line); this._objects.push(line);
      icoGeo.dispose();
    });

    // 3. Crescent moon (torus arc)
    const torusGeo = new THREE.TorusGeometry(4, 0.55, 16, 60, Math.PI * 1.3);
    const moon = new THREE.Mesh(torusGeo, new THREE.MeshBasicMaterial({ color: 0x7eb8ff, transparent: true, opacity: 0.7 }));
    moon.position.set(10, 5, -5);
    moon._isMoon = true; moon._baseY = 5;
    this.scene.add(moon); this._objects.push(moon);
  }

  _buildGeneralScene() {
    // 1. Particle cloud
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(800 * 3);
    for (let i = 0; i < 800 * 3; i++) pos[i] = (Math.random() - 0.5) * 120;
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const cloud = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x5383DC, size: 0.12, transparent: true, opacity: 0.65 }));
    this.scene.add(cloud); this._objects.push(cloud);

    // 2. Two wireframe icosahedra
    [5, 8].forEach((r, i) => {
      const iGeo = new THREE.IcosahedronGeometry(r, 0);
      const wire = new THREE.WireframeGeometry(iGeo);
      const mesh = new THREE.LineSegments(wire, new THREE.LineBasicMaterial({
        color: 0x2D5AAA, transparent: true, opacity: 0.28
      }));
      mesh._speed = [(i === 0 ? 1 : -1) * 0.003, (i === 0 ? -1 : 1) * 0.002, 0.001];
      this.scene.add(mesh); this._objects.push(mesh);
      iGeo.dispose();
    });

    // 3. Floating code glyphs
    const glyphs = ['{','}','<','>','∑','∀','∩','∈','≤','≥','→','⊆','λ','π','∞','⊕','∧','∨','⊗','≡'];
    for (let i = 0; i < 20; i++) {
      const cnv = document.createElement('canvas');
      cnv.width = 64; cnv.height = 64;
      const ctx = cnv.getContext('2d');
      ctx.fillStyle = 'rgba(83,131,220,0.75)';
      ctx.font = 'bold 38px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(glyphs[i % glyphs.length], 32, 32);
      const tex = new THREE.CanvasTexture(cnv);
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(1.5, 1.5),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
      );
      plane.position.set((Math.random() - 0.5) * 50, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 10);
      plane._glyph = true;
      plane._driftSpeed = 0.005 + Math.random() * 0.01;
      this.scene.add(plane); this._objects.push(plane);
    }
  }

  _animate() {
    const t = performance.now() * 0.001;
    // Parallax camera
    this.camera.rotation.y += (this._mouse.x * 0.04 - this.camera.rotation.y) * 0.05;
    this.camera.rotation.x += (-this._mouse.y * 0.04 - this.camera.rotation.x) * 0.05;

    this._objects.forEach(o => {
      if (o._speed) {
        o.rotation.x += o._speed[0];
        o.rotation.y += o._speed[1];
        o.rotation.z += o._speed[2];
      }
      if (o._isMoon) {
        o.position.y = o._baseY + Math.sin(t * 0.4) * 0.6;
      }
      if (o._glyph) {
        o.position.y += o._driftSpeed;
        if (o.position.y > 20) o.position.y = -20;
        o.rotation.z = Math.sin(t * 0.3 + o.position.x) * 0.1;
      }
    });
    this.renderer.render(this.scene, this.camera);
  }

  setTheme(theme) { this.buildScene(theme); }
}

// ══════════════════════════════════════════════════════════════════════════════
// NEXT PRAYER 3D WATCH
// ══════════════════════════════════════════════════════════════════════════════
class NextPrayerWatch {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.prayerNames = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
    this._prayerOrder = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
    if (typeof THREE === 'undefined' || !this.canvas) {
      this._fallback();
      return;
    }
    this._buildWatch();
    document.addEventListener('prayer:resolved', () => this._refreshPrayer());
    this._loop();
  }

  _fallback() {
    // Without Three.js just show digital countdown
    if (!document.getElementById('next-prayer-countdown')) return;
    setInterval(() => this._updateDigital(), 1000);
  }

  _buildWatch() {
    const W = 200, H = 200;
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true });
    this.renderer.setSize(W, H);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 100);
    this.camera.position.set(0, 0, 9);

    // Lights
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    const dLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dLight.position.set(5, 5, 5);
    this.scene.add(dLight);

    // Dial
    const dialColor = parseInt(getCSSVar('--primary').replace('#', ''), 16) || 0x143778;
    const dialGeo = new THREE.CylinderGeometry(2.2, 2.2, 0.28, 64);
    this.dial = new THREE.Mesh(dialGeo, new THREE.MeshStandardMaterial({ color: dialColor, metalness: 0.3, roughness: 0.6 }));
    this.dial.rotation.x = Math.PI / 2;
    this.scene.add(this.dial);

    // Bevel ring
    const bevelGeo = new THREE.TorusGeometry(2.3, 0.08, 8, 64);
    const bevel = new THREE.Mesh(bevelGeo, new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.9, roughness: 0.2 }));
    this.scene.add(bevel);

    // Hour markers
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const markerGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.1, 8);
      const m = new THREE.Mesh(markerGeo, new THREE.MeshStandardMaterial({ color: 0xaaaaaa }));
      m.position.set(Math.sin(a) * 1.85, Math.cos(a) * 1.85, 0.2);
      this.scene.add(m);
    }

    // Hands
    this.hourHand = this._makeHand(0.08, 1.1, 0.04, 0xffffff);
    this.minuteHand = this._makeHand(0.05, 1.55, 0.04, 0xdddddd);
    this.secondHand = this._makeHand(0.03, 1.75, 0.04, 0xff4444);
    this.scene.add(this.hourHand, this.minuteHand, this.secondHand);

    // Prayer arc (ring segment on top of dial)
    this.prayerArcMat = new THREE.MeshBasicMaterial({ color: 0x2D5AAA, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
    this.prayerArc = null; // built by _updatePrayerArc()
  }

  _makeHand(w, h, d, color) {
    const geo = new THREE.BoxGeometry(w, h, d);
    geo.translate(0, h / 2, 0);
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, metalness: 0.4, roughness: 0.5 }));
    mesh.position.z = 0.25;
    return mesh;
  }

  _updateHands(now) {
    const h = now.getHours() % 12;
    const m = now.getMinutes();
    const s = now.getSeconds();
    const hAngle = -((h + m / 60) / 12) * Math.PI * 2;
    const mAngle = -((m + s / 60) / 60) * Math.PI * 2;
    const sAngle = -(s / 60) * Math.PI * 2;
    this.hourHand.rotation.z   = hAngle;
    this.minuteHand.rotation.z = mAngle;
    this.secondHand.rotation.z = sAngle;
  }

  _getNextPrayer(now) {
    const pt = window.PRAYER_TIMES || {};
    const nowSecs = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    for (const key of this._prayerOrder) {
      const t = pt[key];
      if (!t) continue;
      const [ph, pm] = t.split(':').map(Number);
      const ts = ph * 3600 + pm * 60;
      if (ts > nowSecs) return { key, name: key.charAt(0).toUpperCase() + key.slice(1), time: t, seconds: ts - nowSecs };
    }
    // next is Fajr tomorrow
    const fajr = pt.fajr || '04:30';
    const [fh, fm] = fajr.split(':').map(Number);
    const fs = fh * 3600 + fm * 60;
    const rem = 86400 - nowSecs + fs;
    return { key: 'fajr', name: 'Fajr', time: fajr, seconds: rem };
  }

  _updatePrayerArc(now) {
    if (!this.scene) return;
    const next = this._getNextPrayer(now);
    // Map next prayer time onto 12-hour dial as an arc
    const [ph, pm] = next.time.split(':').map(Number);
    const frac = ((ph % 12) + pm / 60) / 12;
    const theta = frac * Math.PI * 2;

    if (this.prayerArc) {
      this.scene.remove(this.prayerArc);
      this.prayerArc.geometry.dispose();
    }
    const arcGeo = new THREE.RingGeometry(2.0, 2.2, 32, 1, -Math.PI / 2, theta);
    const urgent = next.seconds < 300;
    this.prayerArcMat.color.setHex(urgent ? 0xe63300 : 0x2D5AAA);
    this.prayerArcMat.opacity = urgent ? (0.5 + 0.5 * Math.sin(performance.now() / 200)) : 0.85;
    this.prayerArc = new THREE.Mesh(arcGeo, this.prayerArcMat);
    this.prayerArc.position.z = 0.22;
    this.scene.add(this.prayerArc);
  }

  _updateDigital(now = zonedNow()) {
    const next = this._getNextPrayer(now);
    const nameEl = document.getElementById('next-prayer-name');
    const cdEl = document.getElementById('next-prayer-countdown');
    const lblEl = document.getElementById('next-prayer-label');
    if (nameEl) nameEl.textContent = next.name;
    if (cdEl) {
      cdEl.textContent = formatHMS(next.seconds);
      cdEl.classList.toggle('urgent', next.seconds < 300);
    }
    if (lblEl) lblEl.textContent = `at ${next.time}`;
    // Keep navbar pill in sync
    dispatch('prayer:tick', { name: next.name, countdown: formatHMS(next.seconds) });
  }

  _refreshPrayer() { /* prayer:resolved — watch already reads window.PRAYER_TIMES live */ }

  _loop() {
    const tick = () => {
      const now = zonedNow();
      if (this.renderer && this.scene) {
        this._updateHands(now);
        this._updatePrayerArc(now);
        this.renderer.render(this.scene, this.camera);
      }
      this._updateDigital(now);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// REAL-TIME CLOCK
// ══════════════════════════════════════════════════════════════════════════════
class RealTimeClock {
  constructor() {
    this._last = -1;
    this._clockEl = document.getElementById('clock-display');
    this._dateEl  = document.getElementById('date-display');
    setInterval(() => this._tick(), 100);
  }
  _tick() {
    const now = zonedNow();
    const s = now.getSeconds();
    if (s !== this._last) {
      this._last = s;
      const time = pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(s);
      const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
      const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      const date = days[now.getDay()] + ', ' + now.getDate() + ' ' + months[now.getMonth()] + ' ' + now.getFullYear();
      if (this._clockEl) this._clockEl.textContent = time;
      if (this._dateEl)  this._dateEl.textContent  = date;
      dispatch('clock:tick', { now });
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// ANALOG CLOCK
// ══════════════════════════════════════════════════════════════════════════════
class AnalogClock {
  constructor(canvasId) {
    this._canvas = document.getElementById(canvasId);
    if (!this._canvas) return;
    this._ctx = this._canvas.getContext('2d');
    // Retina/HiDPI support
    const dpr = window.devicePixelRatio || 1;
    const size = 380;
    this._canvas.width  = size * dpr;
    this._canvas.height = size * dpr;
    this._canvas.style.width  = size + 'px';
    this._canvas.style.height = size + 'px';
    this._ctx.scale(dpr, dpr);
    this._size = size;
    this._raf = null;
    this._draw();
  }

  _isDark() {
    return document.documentElement.getAttribute('data-dark') === 'true';
  }

  _draw() {
    const ctx  = this._ctx;
    const S    = this._size;
    const cx   = S / 2, cy = S / 2;
    const R    = S / 2 - 6; // outer radius
    const dark = this._isDark();
    const now  = zonedNow();
    const hrs  = now.getHours() % 12 + now.getMinutes() / 60 + now.getSeconds() / 3600;
    const min  = now.getMinutes() + now.getSeconds() / 60;
    const sec  = now.getSeconds() + now.getMilliseconds() / 1000;

    ctx.clearRect(0, 0, S, S);

    // ── Face background ───────────────────────────────────────────────────
    const faceGrad = ctx.createRadialGradient(cx, cy - R * 0.2, R * 0.1, cx, cy, R);
    if (dark) {
      faceGrad.addColorStop(0, 'rgba(15, 30, 70, 0.92)');
      faceGrad.addColorStop(1, 'rgba(6, 14, 36, 0.95)');
    } else {
      faceGrad.addColorStop(0, 'rgba(232, 238, 248, 0.92)');
      faceGrad.addColorStop(1, 'rgba(210, 225, 248, 0.88)');
    }
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = faceGrad;
    ctx.fill();

    // ── Outer ring ────────────────────────────────────────────────────────
    const ringGrad = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
    ringGrad.addColorStop(0, dark ? 'rgba(83,131,220,0.6)' : 'rgba(20,55,120,0.5)');
    ringGrad.addColorStop(0.5, dark ? 'rgba(20,55,120,0.4)' : 'rgba(20,55,120,0.25)');
    ringGrad.addColorStop(1, dark ? 'rgba(83,131,220,0.6)' : 'rgba(20,55,120,0.5)');
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.strokeStyle = ringGrad;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // ── Tick marks ────────────────────────────────────────────────────────
    for (let i = 0; i < 60; i++) {
      const angle = (i / 60) * Math.PI * 2 - Math.PI / 2;
      const isHour = i % 5 === 0;
      const tickOuter = R - 2;
      const tickInner = isHour ? R - 14 : R - 8;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * tickOuter, cy + Math.sin(angle) * tickOuter);
      ctx.lineTo(cx + Math.cos(angle) * tickInner, cy + Math.sin(angle) * tickInner);
      ctx.strokeStyle = isHour
        ? (dark ? 'rgba(83,131,220,0.9)' : 'rgba(20,55,120,0.85)')
        : (dark ? 'rgba(83,131,220,0.35)' : 'rgba(20,55,120,0.25)');
      ctx.lineWidth = isHour ? 2.2 : 1;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    // ── Hour numbers (12, 3, 6, 9) ───────────────────────────────────────
    const numRadius = R - 26;
    const numColor  = dark ? 'rgba(180,210,255,0.9)' : 'rgba(13,36,80,0.85)';
    ctx.font = `bold 15px 'Lora', Georgia, serif`;
    ctx.fillStyle = numColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    [[12, -Math.PI / 2], [3, 0], [6, Math.PI / 2], [9, Math.PI]].forEach(([num, ang]) => {
      ctx.fillText(num, cx + Math.cos(ang) * numRadius, cy + Math.sin(ang) * numRadius);
    });

    // ── Helper to draw a hand ─────────────────────────────────────────────
    const drawHand = (angle, length, width, color, shadowBlur = 0, shadowColor = 'transparent') => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.shadowBlur   = shadowBlur;
      ctx.shadowColor  = shadowColor;
      ctx.beginPath();
      ctx.moveTo(-width * 0.5, length * 0.18);  // slight tail
      ctx.lineTo(0, -length);
      ctx.strokeStyle = color;
      ctx.lineWidth   = width;
      ctx.lineCap     = 'round';
      ctx.stroke();
      ctx.restore();
    };

    const hourAngle   = (hrs / 12) * Math.PI * 2 - Math.PI / 2;
    const minAngle    = (min / 60) * Math.PI * 2 - Math.PI / 2;
    const secAngle    = (sec / 60) * Math.PI * 2 - Math.PI / 2;

    const hourColor = dark ? '#a8c8f0' : '#143778';
    const minColor  = dark ? '#7eb8ff' : '#2D5AAA';
    const secColor  = '#5383DC';

    drawHand(hourAngle, R * 0.52, 5.5, hourColor, 8, dark ? 'rgba(83,131,220,0.4)' : 'rgba(20,55,120,0.3)');
    drawHand(minAngle,  R * 0.75, 3.5, minColor,  6, dark ? 'rgba(83,131,220,0.3)' : 'rgba(20,55,120,0.25)');
    drawHand(secAngle,  R * 0.82, 1.5, secColor,  10, 'rgba(83,131,220,0.55)');

    // ── Second hand tail ──────────────────────────────────────────────────
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(secAngle);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, R * 0.18);
    ctx.strokeStyle = secColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    // ── Center cap ────────────────────────────────────────────────────────
    // Outer ring
    ctx.beginPath();
    ctx.arc(cx, cy, 7, 0, Math.PI * 2);
    ctx.fillStyle = dark ? '#7eb8ff' : '#2D5AAA';
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'rgba(83,131,220,0.6)';
    ctx.fill();
    ctx.shadowBlur = 0;
    // Inner dot
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fillStyle = dark ? '#041a10' : '#fff';
    ctx.fill();

    this._raf = requestAnimationFrame(() => this._draw());
  }

  destroy() { if (this._raf) cancelAnimationFrame(this._raf); }
}

// ══════════════════════════════════════════════════════════════════════════════
// ROUTINE ENGINE
// ══════════════════════════════════════════════════════════════════════════════
class RoutineEngine {
  constructor() {
    this._activeId = null;
    document.addEventListener('clock:tick', e => this._check(e.detail.now));
  }
  _check(now) {
    const mins = nowMinutes(now);
    const routine = window.ROUTINE || [];
    let found = null;
    for (const block of routine) {
      if (block.ramadanOnly && !window._isRamadan) continue;
      const s = parseHHMM(block.start);
      const e = parseHHMM(block.end);
      if (mins >= s && mins < e) { found = block; break; }
    }
    if (found?.id !== this._activeId) {
      this._activeId = found?.id || null;
      if (found) {
        const secs = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
        const blockStart = parseHHMM(found.start) * 60;
        const blockEnd   = parseHHMM(found.end) * 60;
        dispatch('routine:block-changed', {
          block: found,
          elapsedSeconds: secs - blockStart,
          totalSeconds: blockEnd - blockStart
        });
      }
    } else if (found) {
      const secs = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
      const blockStart = parseHHMM(found.start) * 60;
      const blockEnd   = parseHHMM(found.end) * 60;
      dispatch('routine:progress', {
        block: found,
        elapsedSeconds: secs - blockStart,
        totalSeconds: blockEnd - blockStart
      });
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// TIMELINE VIEW
// ══════════════════════════════════════════════════════════════════════════════
class TimelineView {
  constructor() {
    this._tbody = document.getElementById('routine-body');
    this._activeRowId = null;
    document.addEventListener('routine:block-changed', e => this._onChanged(e.detail));
    document.addEventListener('routine:progress',      e => this._onProgress(e.detail));
    document.addEventListener('prayer:resolved',       () => this.render());
    this.render();
  }

  render() {
    if (!this._tbody) return;
    this._tbody.innerHTML = '';
    const routine = window.ROUTINE || [];
    const nowMins = nowMinutes(zonedNow());
    for (const b of routine) {
      if (b.ramadanOnly && !window._isRamadan) continue;
      const blockEnd = parseHHMM(b.end);
      const isPast   = nowMins >= blockEnd;
      const statusHtml = isPast
        ? `<span class="status-done" title="Completed">
            <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" width="22" height="22">
              <circle cx="10" cy="10" r="9" fill="#22c55e" stroke="#16a34a" stroke-width="1"/>
              <path d="M6 10.5l2.8 2.8 5-5.5" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
           </span>`
        : `<span class="status-pending">—</span>`;
      const tr = document.createElement('tr');
      tr.dataset.id = b.id;
      if (b.isContestBlock) tr.classList.add('contest-block-row');
      if (b.id === 'contest_live') tr.classList.add('contest-live-row');
      tr.innerHTML = `
        <td class="time-tag">${b.start}–${b.end}<div class="progress-bar-wrap" id="pb-${b.id}"><div class="progress-bar" id="bar-${b.id}" style="width:0%"></div></div></td>
        <td><span class="phase-dot" style="background:${b.color}"></span>${b.phase}</td>
        <td>${b.activity}<span class="here-pill" id="here-${b.id}" style="display:none">▶ You are here</span></td>
        <td id="status-${b.id}">${statusHtml}</td>
      `;
      this._tbody.appendChild(tr);
    }
    // Re-activate current if known (initial render — do NOT scroll)
    if (this._activeRowId) this._setActive(this._activeRowId, 0, 1, true);
  }

  _markDone(id) {
    const cell = document.getElementById('status-' + id);
    if (!cell) return;
    cell.innerHTML = `<span class="status-done" title="Completed">
      <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" width="22" height="22">
        <circle cx="10" cy="10" r="9" fill="#22c55e" stroke="#16a34a" stroke-width="1"/>
        <path d="M6 10.5l2.8 2.8 5-5.5" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </span>`;
  }

  _setActive(id, elapsed, total, isInitial = false) {
    // Remove old active
    this._tbody.querySelectorAll('tr.active').forEach(r => r.classList.remove('active'));
    this._tbody.querySelectorAll('.here-pill').forEach(p => p.style.display = 'none');
    const tr = this._tbody.querySelector(`tr[data-id="${id}"]`);
    if (!tr) return;
    tr.classList.add('active');
    const pill = document.getElementById('here-' + id);
    if (pill) pill.style.display = '';
    this._updateProgress(id, elapsed, total);
    // Only auto-scroll when the block changes mid-session, not on initial page load
    if (!isInitial) tr.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  _updateProgress(id, elapsed, total) {
    const bar = document.getElementById('bar-' + id);
    if (bar) bar.style.width = (total > 0 ? Math.min(100, (elapsed / total) * 100) : 0) + '%';
  }

  _onChanged(detail) {
    // Mark the previously active block as completed
    if (this._activeRowId && this._activeRowId !== detail.block.id) {
      this._markDone(this._activeRowId);
    }
    this._activeRowId = detail.block.id;
    this._setActive(detail.block.id, detail.elapsedSeconds, detail.totalSeconds, false);
  }

  _onProgress(detail) {
    this._updateProgress(detail.block.id, detail.elapsedSeconds, detail.totalSeconds);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// PRAYER TIME SERVICE
// ══════════════════════════════════════════════════════════════════════════════
class PrayerTimeService {

  // Fetch from Aladhan API given lat/lon
  static async _fetchAladhan(lat, lng) {
    const method = window.PRAYER_METHOD || 2;
    const today  = zonedNow();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    const url = `https://api.aladhan.com/v1/timings/${dd}-${mm}-${yyyy}?latitude=${lat}&longitude=${lng}&method=${method}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(7000) });
    if (!r.ok) throw new Error('Aladhan HTTP ' + r.status);
    const j = await r.json();
    if (j.code !== 200) throw new Error('Aladhan error: ' + j.status);
    const t = j.data.timings;
    const tz = j.data.meta?.timezone || '';
    return {
      fajr: t.Fajr.slice(0, 5), dhuhr: t.Dhuhr.slice(0, 5),
      asr: t.Asr.slice(0, 5),   maghrib: t.Maghrib.slice(0, 5),
      isha: t.Isha.slice(0, 5), city: '', timezone: tz, source: 'Aladhan API',
      lat: +lat, lon: +lng
    };
  }

  // Reverse geocode lat/lon to get actual city/district name
  static async _reverseGeocode(lat, lon) {
    const geoServices = [
      {
        url: `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=10&accept-language=en`,
        parse: j => {
          const a = j.address || {};
          return a.city || a.town || a.district || a.county || a.state_district || a.state || null;
        }
      },
      {
        url: `https://geocode.maps.co/reverse?lat=${lat}&lon=${lon}&format=json`,
        parse: j => {
          const a = j.address || {};
          return a.city || a.town || a.district || a.county || a.state || null;
        }
      }
    ];
    for (const svc of geoServices) {
      try {
        const r = await fetch(svc.url, { signal: AbortSignal.timeout(5000) });
        if (!r.ok) continue;
        const j = await r.json();
        const city = svc.parse(j);
        if (city) return city;
      } catch (_) {}
    }
    return null;
  }

  // Resolve lat/lon via IP geolocation, trying multiple services
  static async _ipCoords() {
    const services = [
      { url: 'https://ipwho.is/',                                   parse: j => j.success ? { lat: j.latitude, lon: j.longitude, city: j.city } : null },
      { url: 'https://ipinfo.io/json',                              parse: j => { if (!j.loc) return null; const [lat,lon]=j.loc.split(','); return { lat:+lat, lon:+lon, city: j.city }; } },
      { url: 'https://ip-api.com/json/?fields=lat,lon,city,status', parse: j => j.status === 'success' ? { lat: j.lat, lon: j.lon, city: j.city } : null },
      { url: 'https://ipapi.co/json/',                              parse: j => j.latitude ? { lat: j.latitude, lon: j.longitude, city: j.city } : null },
      { url: 'https://freeipapi.com/api/json',                      parse: j => ({ lat: j.latitude, lon: j.longitude, city: j.cityName }) }
    ];
    for (const svc of services) {
      try {
        const r = await fetch(svc.url, { signal: AbortSignal.timeout(5000) });
        if (!r.ok) continue;
        const j = await r.json();
        const c = svc.parse(j);
        if (c && c.lat && c.lon) return c;
      } catch (_) {}
    }
    return null;
  }

  // Main entry: GPS → IP geolocation → Aladhan
  static fromGeolocation() {
    return new Promise(async resolve => {
      // Use LOCAL date (not UTC) as cache key — avoids timezone-crossing cache miss
      const now   = zonedNow();
      const local = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
      const cacheKey = 'prayer_' + local;
      const FALLBACK_DEFAULTS = ['04:30', '12:30', '15:45', '18:10', '20:00'];

      // Purge any UTC-keyed stale entries from previous sessions
      const utcKey = 'prayer_' + zonedNow().toISOString().slice(0, 10);
      if (utcKey !== cacheKey) localStorage.removeItem(utcKey);

      // Check local-date cache — skip if it holds the hardcoded defaults
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const d = JSON.parse(cached);
        const vals = [d.fajr, d.dhuhr, d.asr, d.maghrib, d.isha];
        const isDefault = vals.every((v, i) => v === FALLBACK_DEFAULTS[i]);
        if (!isDefault) {
          window.PRAYER_TIMES = d;
          PrayerTimeService._patch(d);
          const cachedCity = d.city || '';
          const cachedCoord = (d.lat && d.lon) ? ` (${d.lat.toFixed(2)}°, ${d.lon.toFixed(2)}°)` : '';
          PrayerTimeService._setLabel('📡 ' + (cachedCity || 'Cached') + cachedCoord, true);
          dispatch('prayer:resolved', d);
          return resolve(d);
        }
        localStorage.removeItem(cacheKey); // stale — refetch
      }

      const save = data => {
        localStorage.setItem(cacheKey, JSON.stringify(data));
        window.PRAYER_TIMES = data;
        PrayerTimeService._patch(data);
        dispatch('prayer:resolved', data);
        resolve(data);
      };

      const tryWithCoords = async (lat, lon, label, cityHint) => {
        try {
          const data = await PrayerTimeService._fetchAladhan(lat, lon);
          data.source = label;
          // Try reverse geocoding to get actual city name
          if (cityHint) {
            data.city = cityHint;
          } else {
            const geoCity = await PrayerTimeService._reverseGeocode(lat, lon).catch(() => null);
            data.city = geoCity || '';
          }
          const displayCity = data.city || data.timezone || '';
          const coordStr = `(${(+lat).toFixed(2)}°, ${(+lon).toFixed(2)}°)`;
          PrayerTimeService._setLabel('📍 ' + label + (displayCity ? ' · ' + displayCity : '') + ' ' + coordStr, true);
          save(data);
          return true;
        } catch (e) { console.warn('Prayer fetch failed:', label, e); return false; }
      };

      // 1. Try browser GPS (high accuracy for correct city-level coords)
      if (navigator.geolocation) {
        const gpsResult = await new Promise(res => {
          navigator.geolocation.getCurrentPosition(
            p => res({ lat: p.coords.latitude, lon: p.coords.longitude }),
            err => {
              if (err.code === 1) {
                console.warn('Geolocation permission denied');
              } else {
                console.warn('Geolocation error:', err.message);
              }
              res(null);
            },
            { timeout: 15000, enableHighAccuracy: true, maximumAge: 300000 }
          );
        });
        if (gpsResult) {
          if (await tryWithCoords(gpsResult.lat, gpsResult.lon, 'GPS', null)) return;
        }
      }

      // 2. Try IP geolocation → Aladhan
      PrayerTimeService._setLabel('🌐 Locating via IP…', false);
      const ipCoords = await PrayerTimeService._ipCoords();
      if (ipCoords) {
        // IP city is often the ISP hub (e.g. Dhaka), not the user's actual city
        // Pass it as a hint but prefer reverse geocoding from coords
        if (await tryWithCoords(ipCoords.lat, ipCoords.lon, 'IP', null)) return;
      }

      // 3. All failed — use hardcoded defaults
      PrayerTimeService._fallback();
      resolve(window.PRAYER_TIMES);
    });
  }

  static _setLabel(text, showRefresh) {
    const loc = document.getElementById('prayer-location');
    if (!loc) return;
    loc.textContent = text;
    const btn = document.getElementById('prayer-refresh-btn');
    if (btn) btn.style.display = showRefresh ? 'none' : 'inline-block';
  }

  static _fallback() {
    // Only show banner + use defaults if we have no real prayer data yet
    const hasCachedReal = window.PRAYER_TIMES &&
      window.PRAYER_TIMES.fajr !== '04:30';
    if (!hasCachedReal) {
      const banner = document.getElementById('geo-banner');
      if (banner) banner.hidden = false; // stays visible until user dismisses or retries
      const fallback = { fajr:'04:30', dhuhr:'12:30', asr:'15:45', maghrib:'18:10', isha:'20:00', city: null };
      window.PRAYER_TIMES = fallback;
      PrayerTimeService._setLabel('⚠ Could not fetch prayer times — using defaults', false);
      dispatch('prayer:resolved', fallback);
      return fallback;
    }
    // Real times already loaded — just quietly return them without showing banner
    PrayerTimeService._setLabel('📡 Using cached prayer times', true);
    dispatch('prayer:resolved', window.PRAYER_TIMES);
    return window.PRAYER_TIMES;
  }

  static _patch(data) {
    const routine = window.ROUTINE || [];
    const suhoor = routine.find(b => b.id === 'suhoor');
    const boot   = routine.find(b => b.id === 'boot');
    const iftar  = routine.find(b => b.id === 'iftar');
    const suhoorTime = addMinutes(data.fajr, -30);
    // Suhoor: 30 min before Fajr → Fajr
    if (suhoor) { suhoor.start = suhoorTime; suhoor.end = data.fajr; }
    // Boot: starts right at Fajr, ends at its original time — no overlap with suhoor
    if (boot) { boot.start = data.fajr; }
    // Iftar: Maghrib → Maghrib+50min
    if (iftar)  { iftar.start = data.maghrib; iftar.end = addMinutes(data.maghrib, 50); }

    // Hero prayer-time grid
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('pt-fajr',    data.fajr);
    set('pt-dhuhr',   data.dhuhr);
    set('pt-asr',     data.asr);
    set('pt-maghrib', data.maghrib);
    set('pt-isha',    data.isha);

    // Legacy hero pills (kept for compatibility)
    set('hero-suhoor', suhoorTime);
    set('hero-iftar',  data.maghrib);

    // Suhoor / Iftar card badges
    set('suhoor-time-badge', '🌙 Suhoor at ' + suhoorTime + '  │  Fajr at ' + data.fajr);
    set('iftar-time-badge',  '🌅 Iftar (Maghrib) at ' + data.maghrib);

    // Source label
    const city = data.city || '';
    const src  = data.source || 'Aladhan API';
    const coordInfo = (data.lat && data.lon) ? ` (${data.lat.toFixed(2)}°, ${data.lon.toFixed(2)}°)` : '';
    set('prayer-src-label', '📍 ' + src + (city ? ' · ' + city : '') + coordInfo);
    const srcEl = document.getElementById('prayer-src-label');
    if (srcEl) srcEl.hidden = false;

    // Highlight the currently-next prayer pill
    const now = zonedNow();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const toMins = t => { const [h,m] = t.split(':').map(Number); return h*60+m; };
    const prayers = [
      { id:'pt-pill-fajr',    t: data.fajr    },
      { id:'pt-pill-dhuhr',   t: data.dhuhr   },
      { id:'pt-pill-asr',     t: data.asr     },
      { id:'pt-pill-maghrib', t: data.maghrib },
      { id:'pt-pill-isha',    t: data.isha    }
    ];
    let nextIdx = prayers.findIndex(p => toMins(p.t) > nowMins);
    if (nextIdx === -1) nextIdx = 0; // after Isha, next is Fajr tomorrow
    prayers.forEach((p, i) => {
      const el = document.getElementById(p.id);
      if (el) el.classList.toggle('pt-pill-next', i === nextIdx);
    });
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// RAMADAN COUNTDOWN
// ══════════════════════════════════════════════════════════════════════════════
class RamadanCountdown {
  constructor() {
    this._lastMin = -1;
    document.addEventListener('clock:tick', e => this._tick(e.detail.now));
    document.addEventListener('prayer:resolved', () => {}); // PRAYER_TIMES updated globally
  }
  _tick(now) {
    if (!window._isRamadan) return;
    const pt = window.PRAYER_TIMES || {};
    const fajr    = pt.fajr    || '04:30';
    const dhuhr   = pt.dhuhr   || '12:30';
    const asr     = pt.asr     || '15:45';
    const maghrib = pt.maghrib || '18:10';
    const isha    = pt.isha    || '20:00';
    const nowSecs = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    const [fh, fm] = fajr.split(':').map(Number);
    const [mh, mm] = maghrib.split(':').map(Number);
    const fajrSecs    = fh * 3600 + fm * 60;
    const maghribSecs = mh * 3600 + mm * 60;

    const suhoorEl    = document.getElementById('suhoor-countdown');
    const iftarEl     = document.getElementById('iftar-countdown');
    const suhoorLabel = document.getElementById('suhoor-label');
    const iftarLabel  = document.getElementById('iftar-label');

    // Suhoor card countdown
    if (suhoorEl) {
      if (nowSecs < fajrSecs) {
        suhoorEl.textContent = formatHMS(fajrSecs - nowSecs);
        if (suhoorLabel) suhoorLabel.textContent = 'until Fajr at ' + fajr;
      } else {
        suhoorEl.textContent = formatHMS(86400 - nowSecs + fajrSecs);
        if (suhoorLabel) suhoorLabel.textContent = 'tomorrow Fajr at ' + fajr;
      }
    }

    // Iftar card countdown (always visible)
    const iftarCard = document.getElementById('iftar-card');
    if (iftarCard) iftarCard.hidden = false;
    if (iftarEl) {
      if (nowSecs < maghribSecs) {
        iftarEl.textContent = formatHMS(maghribSecs - nowSecs);
        if (iftarLabel) iftarLabel.textContent = 'until Maghrib at ' + maghrib;
      } else {
        iftarEl.textContent = formatHMS(86400 - nowSecs + maghribSecs);
        if (iftarLabel) iftarLabel.textContent = 'until tomorrow Iftar at ' + maghrib;
      }
    }

    // Update "next prayer" pill highlight once per minute
    const curMin = now.getHours() * 60 + now.getMinutes();
    if (curMin !== this._lastMin) {
      this._lastMin = curMin;
      const toMins = t => { const [h,m] = t.split(':').map(Number); return h*60+m; };
      const prayers = [
        { id:'pt-pill-fajr',    t: fajr    },
        { id:'pt-pill-dhuhr',   t: dhuhr   },
        { id:'pt-pill-asr',     t: asr     },
        { id:'pt-pill-maghrib', t: maghrib },
        { id:'pt-pill-isha',    t: isha    }
      ];
      let nextIdx = prayers.findIndex(p => toMins(p.t) > curMin);
      if (nextIdx === -1) nextIdx = 0;
      prayers.forEach((p, i) => {
        const el = document.getElementById(p.id);
        if (el) el.classList.toggle('pt-pill-next', i === nextIdx);
      });
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// AUDIO ALERT SERVICE
// ══════════════════════════════════════════════════════════════════════════════
class AudioAlertService {
  constructor() {
    this._ctx = null;
    this._ids = [];
    this._load();
    this._setupUI();
  }

  _load() {
    this.enabled  = localStorage.getItem('alarms_enabled')  !== 'false';
    this.azanOn   = localStorage.getItem('alarms_azan')     !== 'false';
    this.blocksOn = localStorage.getItem('alarms_blocks')   !== 'false';
    this.warnOn   = localStorage.getItem('alarms_warning')  !== 'false';
    this.volume   = Number(localStorage.getItem('alarms_volume') ?? 80) / 100;
  }

  _ctx_get() {
    if (!this._ctx) this._ctx = new (window.AudioContext || window.webkitAudioContext)();
    return this._ctx;
  }

  play(type) {
    if (!this.enabled) return;
    if (['fajr','dhuhr','asr','maghrib','isha'].includes(type) && !this.azanOn) return;
    if (['work','break','contest','shutdown'].includes(type) && !this.blocksOn) return;
    if (type === 'warning' && !this.warnOn) return;
    const ctx = this._ctx_get();
    const vol = this.volume;
    const t = ctx.currentTime;
    const g = ctx.createGain();
    g.connect(ctx.destination);

    const osc = (freq, wave, start, dur, gain = vol) => {
      const o = ctx.createOscillator();
      const gn = ctx.createGain();
      o.type = wave; o.frequency.value = freq;
      gn.gain.setValueAtTime(gain, t + start);
      gn.gain.exponentialRampToValueAtTime(0.001, t + start + dur);
      o.connect(gn); gn.connect(ctx.destination);
      o.start(t + start); o.stop(t + start + dur + 0.05);
    };

    switch (type) {
      // ── AZAN TONES ──────────────────────────────────────────────────────
      case 'fajr':    // Slow ascending C4→E4→G4 pentatonic, sine
        [[261.6, 0], [329.6, 0.55], [392.0, 1.1]].forEach(([f, s]) => osc(f, 'sine', s, 0.5, vol * 0.25));
        break;
      case 'dhuhr':   // Two struck A3, triangle
        [0, 0.4].forEach(s => osc(220, 'triangle', s, 0.35, vol * 0.3));
        break;
      case 'asr':     // Triple staccato G4, sine
        [0, 0.28, 0.56].forEach(s => osc(392, 'sine', s, 0.2, vol * 0.3));
        break;
      case 'maghrib': // Joyful C4+E4+G4 chord then G4 solo
        [261.6, 329.6, 392.0].forEach(f => osc(f, 'sine', 0, 0.4, vol * 0.28));
        osc(392.0, 'sine', 0.55, 0.5, vol * 0.35);
        break;
      case 'isha':    // Slow E4→B3 descend, sawtooth with fade
        osc(329.6, 'sawtooth', 0,   0.8, vol * 0.2);
        osc(246.9, 'sawtooth', 0.9, 0.8, vol * 0.2);
        break;
      // ── ROUTINE BLOCK TONES ─────────────────────────────────────────────
      case 'work':    // Double ascending E5+G5, square
        osc(659.3, 'square', 0,    0.15, vol * 0.22);
        osc(784.0, 'square', 0.25, 0.15, vol * 0.22);
        break;
      case 'break':   // Single C5 chime, sine with fade
        osc(523.3, 'sine', 0, 0.6, vol * 0.2);
        break;
      case 'warning': // Three rapid A5 pings, sine
        [0, 0.18, 0.36].forEach(s => osc(880, 'sine', s, 0.1, vol * 0.22));
        break;
      case 'contest': // C5→E5→G5 fast arpeggio, square
        [[523.3, 0], [659.3, 0.14], [784.0, 0.28]].forEach(([f, s]) => osc(f, 'square', s, 0.12, vol * 0.28));
        break;
      case 'shutdown': // G4→E4→C4 lullaby, sine
        [[392.0, 0], [329.6, 0.45], [261.6, 0.9]].forEach(([f, s]) => osc(f, 'sine', s, 0.4, vol * 0.2));
        break;
    }
    this._notify(type);
  }

  _notify(type) {
    if (Notification.permission !== 'granted') return;
    const labels = {
      fajr:    { title: '🌙 Fajr',    body: 'Time to pray Fajr' },
      dhuhr:   { title: '🕛 Dhuhr',   body: 'Midday prayer time' },
      asr:     { title: '🕓 Asr',     body: 'Afternoon prayer time' },
      maghrib: { title: '🌅 Maghrib', body: 'Time to break fast — Maghrib prayer' },
      isha:    { title: '🌙 Isha',    body: 'Night prayer time' },
      work:    { title: '⌨ Work block starts', body: 'Focus time — let\'s go!' },
      break:   { title: '☕ Break',   body: 'Rest, no screens' },
      warning: { title: '⏰ 5 min left', body: 'Wrap up your current block' },
      contest: { title: '🏆 Contest time', body: 'Evening contest simulation starts' },
      shutdown:{ title: '🌙 Shutdown', body: 'Pack up and sleep' }
    };
    const l = labels[type];
    if (l) new Notification(l.title, { body: l.body, silent: true });
  }

  scheduleAzanAlarms(pt) {
    const keys = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
    keys.forEach(k => {
      const t = pt[k]; if (!t) return;
      const ms = secondsUntil(t) * 1000;
      if (ms > 0 && ms < 86400000) {
        const id = setTimeout(() => { this.play(k); }, ms);
        this._ids.push(id);
      }
    });
  }

  scheduleBlockAlarms(routine) {
    (routine || []).forEach(b => {
      if (b.ramadanOnly && !window._isRamadan) return;
      // Block start alarm
      if (b.notify) {
        const ms = secondsUntil(b.start) * 1000;
        if (ms > 0 && ms < 86400000) {
          const id = setTimeout(() => this.play(b.notify), ms);
          this._ids.push(id);
        }
      }
      // 5-min warning — only if block duration > 10 minutes (spec requirement)
      if (b.warn5min) {
        const blockDurationMins = parseHHMM(b.end) - parseHHMM(b.start);
        if (blockDurationMins > 10) {
          const warnTime = addMinutes(b.end, -5);
          const ms = secondsUntil(warnTime) * 1000;
          if (ms > 0 && ms < 86400000) {
            const id = setTimeout(() => this.play('warning'), ms);
            this._ids.push(id);
          }
        }
      }
    });
  }

  cancelAll() {
    this._ids.forEach(id => clearTimeout(id));
    this._ids = [];
  }

  _setupUI() {
    const master  = document.getElementById('alarm-master');
    const azan    = document.getElementById('alarm-azan');
    const blocks  = document.getElementById('alarm-blocks');
    const warn    = document.getElementById('alarm-warning');
    const vol     = document.getElementById('alarm-volume');

    if (master)  { master.checked  = this.enabled;  master.addEventListener('change', () => { this.enabled  = master.checked;  localStorage.setItem('alarms_enabled', master.checked); }); }
    if (azan)    { azan.checked    = this.azanOn;    azan.addEventListener('change',   () => { this.azanOn   = azan.checked;    localStorage.setItem('alarms_azan',    azan.checked); }); }
    if (blocks)  { blocks.checked  = this.blocksOn;  blocks.addEventListener('change', () => { this.blocksOn = blocks.checked;  localStorage.setItem('alarms_blocks',  blocks.checked); }); }
    if (warn)    { warn.checked    = this.warnOn;    warn.addEventListener('change',   () => { this.warnOn   = warn.checked;    localStorage.setItem('alarms_warning', warn.checked); }); }
    if (vol)     { vol.value       = this.volume * 100; vol.addEventListener('input', () => { this.volume = vol.value / 100; localStorage.setItem('alarms_volume', vol.value); }); }

    // Test buttons
    document.querySelectorAll('[data-test]').forEach(btn => {
      btn.addEventListener('click', () => {
        const saved = this.enabled; this.enabled = true;
        const savedAzan = this.azanOn; this.azanOn = true;
        const savedBlocks = this.blocksOn; this.blocksOn = true;
        const savedWarn = this.warnOn; this.warnOn = true;
        this.play(btn.dataset.test);
        this.enabled = saved; this.azanOn = savedAzan;
        this.blocksOn = savedBlocks; this.warnOn = savedWarn;
      });
    });
    // Alarm panel toggle
    const alarmBtn = document.getElementById('alarm-toggle-btn');
    const panel    = document.getElementById('alarm-panel');
    const closeBtn = document.getElementById('alarm-panel-close');
    const closePanel = () => panel.classList.remove('open');
    if (alarmBtn && panel) {
      alarmBtn.addEventListener('click', e => {
        e.stopPropagation();
        panel.classList.toggle('open');
      });
    }
    if (closeBtn) closeBtn.addEventListener('click', closePanel);
    // Click outside to close
    document.addEventListener('click', e => {
      if (panel.classList.contains('open') &&
          !panel.contains(e.target) &&
          e.target !== alarmBtn) {
        closePanel();
      }
    });
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// STOPWATCH
// ══════════════════════════════════════════════════════════════════════════════
class Stopwatch {
  constructor() {
    this._state = 'idle'; // idle | running | paused
    this._elapsed = 0;
    this._startAt = 0;
    this._laps = [];
    this._interval = null;
    this._display = document.getElementById('stopwatch-display');
    this._lapBody = document.getElementById('lap-body');
    document.getElementById('sw-start')?.addEventListener('click', () => this.start());
    document.getElementById('sw-pause')?.addEventListener('click', () => this.pause());
    document.getElementById('sw-lap')?.addEventListener('click',   () => this.lap());
    document.getElementById('sw-reset')?.addEventListener('click', () => this.reset());
  }

  start() {
    if (this._state === 'running') return;
    this._startAt = performance.now() - this._elapsed;
    this._state = 'running';
    this._render();
    this._interval = setInterval(() => this._render(), 50);
    this._display?.classList.add('running');
    this._setBtn('sw-start', true); this._setBtn('sw-pause', false); this._setBtn('sw-lap', false);
  }

  pause() {
    if (this._state !== 'running') return;
    this._elapsed = performance.now() - this._startAt;
    clearInterval(this._interval);
    this._state = 'paused';
    this._display?.classList.remove('running');
    this._setBtn('sw-start', false); this._setBtn('sw-pause', true);
  }

  lap() {
    if (this._state !== 'running') return;
    const cum = performance.now() - this._startAt;
    const prev = this._laps.length > 0 ? this._laps[this._laps.length - 1].cum : 0;
    this._laps.push({ n: this._laps.length + 1, split: cum - prev, cum });
    this._renderLaps();
  }

  reset() {
    clearInterval(this._interval);
    this._elapsed = 0; this._state = 'idle'; this._laps = [];
    this._display?.classList.remove('running');
    if (this._display) this._display.textContent = '00:00:00.00';
    if (this._lapBody) this._lapBody.innerHTML = '';
    this._setBtn('sw-start', false); this._setBtn('sw-pause', true); this._setBtn('sw-lap', true);
  }

  _render() {
    const ms = this._state === 'running' ? performance.now() - this._startAt : this._elapsed;
    const h = Math.floor(ms / 3600000), rem1 = ms % 3600000;
    const m = Math.floor(rem1 / 60000), rem2 = rem1 % 60000;
    const s = Math.floor(rem2 / 1000), cc = Math.floor((rem2 % 1000) / 10);
    if (this._display) this._display.textContent = pad(h)+':'+pad(m)+':'+pad(s)+'.'+pad(cc);
  }

  _renderLaps() {
    if (!this._lapBody) return;
    this._lapBody.innerHTML = this._laps.slice().reverse().map(l => `<tr><td>${l.n}</td><td>${this._fmtMs(l.split)}</td><td>${this._fmtMs(l.cum)}</td></tr>`).join('');
  }

  _fmtMs(ms) {
    const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000), cc = Math.floor((ms % 1000) / 10);
    return pad(m)+':'+pad(s)+'.'+pad(cc);
  }

  _setBtn(id, disabled) {
    const el = document.getElementById(id);
    if (el) el.disabled = disabled;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// COUNTDOWN TIMER
// ══════════════════════════════════════════════════════════════════════════════
class CountdownTimer {
  constructor() {
    this._total = 0; this._remaining = 0;
    this._running = false; this._raf = null;
    this._lastFrame = 0;
    this._display = document.getElementById('timer-display');
    this._ring    = document.getElementById('ring-progress');
    this._circumf = 2 * Math.PI * 54; // 339.29

    // Preset buttons
    document.querySelectorAll('[data-preset]').forEach(btn =>
      btn.addEventListener('click', () => { this._set(+btn.dataset.preset); }));
    document.getElementById('timer-set')?.addEventListener('click', () => {
      const v = document.getElementById('timer-custom')?.value || '';
      const parts = v.split(':').map(Number);
      let secs = 0;
      if (parts.length === 3) secs = parts[0]*3600 + parts[1]*60 + parts[2];
      else if (parts.length === 2) secs = parts[0]*60 + parts[1];
      else secs = parts[0] || 0;
      if (secs > 0) this._set(secs);
    });
    document.getElementById('timer-start')?.addEventListener('click', () => this._startOrResume());
    document.getElementById('timer-pause')?.addEventListener('click', () => this._pause());
    document.getElementById('timer-reset')?.addEventListener('click', () => this._reset());

    // Restore from localStorage
    this._restore();
  }

  _set(seconds) {
    this._reset();
    this._total = this._remaining = seconds;
    this._renderDisplay();
    this._renderRing();
    const s = document.getElementById('timer-start');
    if (s) s.disabled = false;
    this._save();
  }

  _startOrResume() {
    if (this._remaining <= 0) return;
    this._running = true;
    this._lastFrame = performance.now();
    this._display?.classList.add('running');
    document.getElementById('timer-start').disabled = true;
    document.getElementById('timer-pause').disabled = false;
    this._tick();
    this._save();
  }

  _tick() {
    if (!this._running) return;
    const now = performance.now();
    this._remaining -= (now - this._lastFrame) / 1000;
    this._lastFrame = now;
    if (this._remaining <= 0) {
      this._remaining = 0;
      this._running = false;
      this._display?.classList.remove('running');
      this._renderDisplay(); this._renderRing();
      this._beep();
      localStorage.removeItem('cp_timer');
      document.getElementById('timer-start').disabled = false;
      document.getElementById('timer-pause').disabled = true;
      return;
    }
    this._renderDisplay(); this._renderRing();
    this._save();
    this._raf = requestAnimationFrame(() => this._tick());
  }

  _pause() {
    this._running = false;
    cancelAnimationFrame(this._raf);
    this._display?.classList.remove('running');
    document.getElementById('timer-start').disabled = false;
    document.getElementById('timer-pause').disabled = true;
    this._save();
  }

  _reset() {
    this._running = false;
    cancelAnimationFrame(this._raf);
    this._display?.classList.remove('running');
    this._remaining = this._total;
    this._renderDisplay(); this._renderRing();
    const s = document.getElementById('timer-start');
    const p = document.getElementById('timer-pause');
    if (s) s.disabled = (this._total === 0);
    if (p) p.disabled = true;
    localStorage.removeItem('cp_timer');
  }

  _renderDisplay() {
    if (!this._display) return;
    const r = Math.max(0, Math.ceil(this._remaining));
    this._display.textContent = formatHMS(r);
  }

  _renderRing() {
    if (!this._ring) return;
    const frac = this._total > 0 ? this._remaining / this._total : 0;
    this._ring.style.strokeDashoffset = (this._circumf * (1 - frac));
    this._ring.style.stroke = frac < 0.2 ? '#e63300' : 'var(--accent)';
  }

  _save() {
    localStorage.setItem('cp_timer', JSON.stringify({
      total: this._total, remaining: this._remaining, running: this._running,
      savedAt: Date.now()
    }));
  }

  _restore() {
    const raw = localStorage.getItem('cp_timer');
    if (!raw) return;
    try {
      const d = JSON.parse(raw);
      const elapsed = (Date.now() - d.savedAt) / 1000;
      this._total = d.total;
      this._remaining = d.running ? Math.max(0, d.remaining - elapsed) : d.remaining;
      this._renderDisplay(); this._renderRing();
      if (d.running && this._remaining > 0) this._startOrResume();
    } catch (e) { localStorage.removeItem('cp_timer'); }
  }

  _beep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [880, 660].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const g   = ctx.createGain();
        osc.frequency.value = freq;
        g.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.35);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.35 + 0.3);
        osc.connect(g); g.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.35);
        osc.stop(ctx.currentTime + i * 0.35 + 0.35);
      });
    } catch (e) {}
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// CONTEST SERVICE  —  Codeforces live API + generated schedules (no auth needed)
// ══════════════════════════════════════════════════════════════════════════════
class ContestService {
  static CACHE_KEY = 'contests_v3_cache';
  static CACHE_TTL = 30 * 60 * 1000; // 30 minutes

  static clearCache() {
    localStorage.removeItem(this.CACHE_KEY);
  }

  // ── Time helpers ──────────────────────────────────────────────────────────
  static toLocalDate(isoString) {
    const d = new Date(isoString.endsWith('Z') ? isoString : isoString + 'Z');
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: APP_TIMEZONE, hour12: false, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    }).formatToParts(d).reduce((a, p) => { if (p.type !== 'literal') a[p.type] = p.value; return a; }, {});
    return new Date(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  }
  static toLocalHHMM(isoString) {
    const d = this.toLocalDate(isoString);
    return pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  static toLocalDateStr(isoString) {
    const d = this.toLocalDate(isoString);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  static todayStr() {
    const n = zonedNow();
    return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`;
  }
  static formatDuration(seconds) {
    const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60);
    if (h && m) return `${h}h ${m}m`;
    return h ? `${h}h` : `${m}m`;
  }
  static platformInfo(resource) {
    const map = {
      'codeforces.com':  { name: 'Codeforces', color: '#1a73e8', abbr: 'CF' },
      'codechef.com':    { name: 'CodeChef',   color: '#5b4638', abbr: 'CC' },
      'atcoder.jp':      { name: 'AtCoder',    color: '#1f8b00', abbr: 'AT' },
      'leetcode.com':    { name: 'LeetCode',   color: '#e85d00', abbr: 'LC' },
      'hackerearth.com': { name: 'HackerEarth',color: '#2c95ff', abbr: 'HE' },
    };
    return map[resource] || { name: resource, color: '#143778', abbr: '??' };
  }

  // ── Codeforces live (official public API, no key required) ────────────────
  static async _fetchCodeforces() {
    const r = await fetch('https://codeforces.com/api/contest.list?gym=false', {
      signal: AbortSignal.timeout(9000)
    });
    if (!r.ok) throw new Error('CF HTTP ' + r.status);
    const { status, result } = await r.json();
    if (status !== 'OK') throw new Error('CF API status: ' + status);
    const now = Date.now();
    return result
      .filter(c => c.phase === 'BEFORE' || c.phase === 'CODING')
      .slice(0, 12)
      .map(c => ({
        event:    c.name,
        href:     `https://codeforces.com/contest/${c.id}`,
        start:    new Date(c.startTimeSeconds * 1000).toISOString(),
        end:      new Date((c.startTimeSeconds + c.durationSeconds) * 1000).toISOString(),
        duration: c.durationSeconds,
        resource: 'codeforces.com',
        site:     'CodeForces',
        status:   c.phase === 'CODING' ? 'CODING' : 'BEFORE',
      }));
  }

  // ── Generated schedule for platforms without a public API ─────────────────
  // anchorISO : a known UTC datetime when the contest occurs
  // intervalDays : repeat every N days (7 = weekly, 14 = biweekly)
  // durationSecs : contest length in seconds
  static _recurring(site, name, href, resource, durationSecs, anchorISO, intervalDays, count = 8) {
    const interval = intervalDays * 86400000;
    const now      = Date.now();
    let   t        = new Date(anchorISO).getTime();
    // Advance anchor to the next occurrence that hasn't fully ended yet
    while (t + durationSecs * 1000 < now) t += interval;
    const results = [];
    for (let i = 0; i < count; i++, t += interval) {
      if (new Date(t + durationSecs * 1000) <= new Date()) continue;
      results.push({
        event:    name,
        href,
        start:    new Date(t).toISOString(),
        end:      new Date(t + durationSecs * 1000).toISOString(),
        duration: durationSecs,
        resource,
        site,
        status:   now >= t && now < t + durationSecs * 1000 ? 'CODING' : 'BEFORE',
      });
    }
    return results;
  }

  // ── Main fetch ────────────────────────────────────────────────────────────
  static async fetch() {
    const cached = localStorage.getItem(this.CACHE_KEY);
    if (cached) {
      try {
        const d = JSON.parse(cached);
        if (Date.now() - d.timestamp < this.CACHE_TTL) return d.data;
      } catch (_) {}
    }

    // 1. Codeforces — live from their public API
    let cfContests = [];
    try { cfContests = await this._fetchCodeforces(); }
    catch (e) { console.warn('[ContestService] Codeforces fetch failed:', e.message); }

    // 2. CodeChef Starter — every Wednesday 14:30 UTC (8:30 PM BST / 8:00 PM IST)
    const ccContests = this._recurring(
      'CodeChef', 'CodeChef Starter Contest',
      'https://www.codechef.com/contests',
      'codechef.com', 7200,           // 2 hours
      '2026-03-04T14:30:00.000Z', 7   // anchor = Wednesday Mar 4 2026
    );

    // 3. LeetCode Weekly — every Sunday 02:30 UTC (8:30 AM BST)
    const lcWeekly = this._recurring(
      'LeetCode', 'LeetCode Weekly Contest',
      'https://leetcode.com/contest/',
      'leetcode.com', 5400,           // 1.5 hours
      '2026-03-08T02:30:00.000Z', 7   // anchor = Sunday Mar 8 2026
    );

    // 4. LeetCode Biweekly — every other Saturday 14:30 UTC (8:30 PM BST)
    const lcBiweekly = this._recurring(
      'LeetCode', 'LeetCode Biweekly Contest',
      'https://leetcode.com/contest/',
      'leetcode.com', 5400,
      '2026-03-14T14:30:00.000Z', 14  // anchor = Saturday Mar 14 2026
    );

    // 5. AtCoder ABC — every other Saturday 13:00 UTC (7:00 PM BST)
    const atContests = this._recurring(
      'AtCoder', 'AtCoder Beginner Contest',
      'https://atcoder.jp/contests/',
      'atcoder.jp', 6000,             // 100 minutes
      '2026-03-07T13:00:00.000Z', 14  // anchor = Saturday Mar 7 2026
    );

    // ───────────────────────────────────────────────────────────────────────

    const data = [...cfContests, ...ccContests, ...lcWeekly, ...lcBiweekly, ...atContests]
      .filter(c => new Date(c.end) > new Date())
      .sort((a, b) => new Date(a.start) - new Date(b.start));

    localStorage.setItem(this.CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
    return data;
  }

  static getTodayFrom(all) {
    const today = this.todayStr();
    return all.filter(c => this.toLocalDateStr(c.start) === today);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// DYNAMIC ROUTINE BUILDER — injects contest blocks into the daily schedule
// ══════════════════════════════════════════════════════════════════════════════
class DynamicRoutineBuilder {
  /**
   * Build a routine that slots ALL of today's contests into the base schedule.
   * For each contest three blocks are inserted: Prep → Live → Upsolve.
   * Base blocks that overlap any contest window are trimmed or removed.
   */
  static build(baseRoutine, todayContests) {
    if (!todayContests || todayContests.length === 0) return [...baseRoutine];

    // Sort contests by their local start time
    const contests = [...todayContests].sort((a, b) =>
      parseHHMM(ContestService.toLocalHHMM(a.start)) -
      parseHHMM(ContestService.toLocalHHMM(b.start))
    );

    // Build a blocked window for each contest: [prepStart, postEnd]
    const windows = contests.map(c => {
      const startMins = parseHHMM(ContestService.toLocalHHMM(c.start));
      const endMins   = parseHHMM(ContestService.toLocalHHMM(c.end));
      return {
        prepStart : Math.max(startMins - 60, 0),
        startMins,
        endMins,
        postEnd   : Math.min(endMins + 90, parseHHMM('23:45')),
        contest   : c,
      };
    });

    // -------------------------------------------------------------------
    // Pass 1: copy base-routine blocks, slicing around every window
    // -------------------------------------------------------------------
    const built = [];

    for (const block of baseRoutine) {
      if (block.ramadanOnly && !window._isRamadan) continue;

      // A block may be split into multiple segments after applying all windows
      let segments = [{ s: parseHHMM(block.start), e: parseHHMM(block.end) }];

      for (const w of windows) {
        const out = [];
        for (const seg of segments) {
          if (seg.e <= w.prepStart || seg.s >= w.postEnd) {
            out.push(seg);                                      // entirely outside → keep
          } else {
            if (seg.s < w.prepStart)                           // left tail → keep
              out.push({ s: seg.s, e: w.prepStart });
            if (seg.e > w.postEnd)                             // right tail → keep
              out.push({ s: w.postEnd, e: seg.e });
            // anything inside the window is dropped
          }
        }
        segments = out;
      }

      for (const seg of segments) {
        if (seg.e - seg.s >= 5)                                // drop tiny slivers
          built.push({ ...block, start: minsToHHMM(seg.s), end: minsToHHMM(seg.e) });
      }
    }

    // -------------------------------------------------------------------
    // Pass 2: insert contest blocks for every contest
    // -------------------------------------------------------------------
    for (const w of windows) {
      const { prepStart, startMins, endMins, postEnd, contest: c } = w;
      const pi           = ContestService.platformInfo(c.resource);
      const contestStart = ContestService.toLocalHHMM(c.start);
      const contestEnd   = ContestService.toLocalHHMM(c.end);
      const slug         = c.resource.replace(/\./g, '_');

      // Prep (only if there's at least 10 minutes before contest)
      if (startMins - prepStart >= 10) {
        built.push({
          id       : `contest_prep_${slug}`,
          start    : minsToHHMM(prepStart),
          end      : contestStart,
          phase    : '⚡ Contest Prep',
          activity : `⚡ Contest Prep — review templates, mental warmup for <strong>${pi.name}</strong>`,
          color    : '#fde68a', notify: 'warning', isContestBlock: true,
        });
      }

      // Live contest
      built.push({
        id       : `contest_live_${slug}`,
        start    : contestStart,
        end      : contestEnd,
        phase    : `🏆 ${pi.name} LIVE`,
        activity : `🏆 <a href="${c.href}" target="_blank" rel="noopener" class="contest-link-inline">${c.event} ↗</a>
                    &nbsp;<span class="contest-platform-inline" style="--pcolor:${pi.color}">${pi.name}</span>`,
        color    : '#fbbf24', notify: 'contest', isContestBlock: true, contestData: c,
      });

      // Upsolve (only if contest ends before 23:00)
      if (endMins < parseHHMM('23:00')) {
        built.push({
          id       : `contest_upsolve_${slug}`,
          start    : contestEnd,
          end      : minsToHHMM(postEnd),
          phase    : '📓 Upsolve',
          activity : '📓 Upsolve &amp; Editorial Review — solve missed problems, add contest notes',
          color    : '#a5b4fc', notify: 'break', isContestBlock: true,
        });
      }
    }

    built.sort((a, b) => parseHHMM(a.start) - parseHHMM(b.start));
    return built;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// CONTEST RENDERER — renders the #contests section and today's banner
// ══════════════════════════════════════════════════════════════════════════════
class ContestRenderer {
  constructor() {
    this._upcoming    = [];
    this._today       = [];
    this._activeFilter = 'all';
    this._grid        = document.getElementById('contests-grid');
    this._banner      = document.getElementById('contest-today-banner');
    this._statusEl    = document.getElementById('contest-status-label');
    this._refreshBtn  = document.getElementById('contest-refresh-btn');
    this._filterBar   = document.getElementById('contest-filters');

    this._refreshBtn?.addEventListener('click', () => this.refresh());
    this._filterBar?.addEventListener('click', e => {
      const btn = e.target.closest('.contest-filter-btn');
      if (!btn) return;
      this._filterBar.querySelectorAll('.contest-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      this._activeFilter = btn.dataset.res;
      this._renderGrid();
    });
    document.addEventListener('clock:tick', e => this._tick(e.detail.now));
  }

  async load() {
    this._setStatus('⏳ Loading contest schedule…', false);
    try {
      const all = await ContestService.fetch();
      this._upcoming = all;
      this._today    = ContestService.getTodayFrom(all);
      this._renderBanner();
      this._renderGrid();
      dispatch('contests:loaded', { today: this._today, upcoming: this._upcoming });
    } catch (e) {
      this._setStatus('❌ Failed to load contests. Check your connection.', true);
    }
  }

  async refresh() {
    ContestService.clearCache();
    await this.load();
  }

  _setStatus(text, showRefresh) {
    if (this._statusEl) this._statusEl.textContent = text;
    if (this._refreshBtn) this._refreshBtn.style.display = showRefresh ? 'inline-flex' : 'none';
  }

  _renderBanner() {
    if (!this._banner) return;
    if (this._today.length === 0) { this._banner.hidden = true; return; }
    const c   = this._today[0];
    const pi  = ContestService.platformInfo(c.resource);
    const startHHMM = ContestService.toLocalHHMM(c.start);
    const endHHMM   = ContestService.toLocalHHMM(c.end);
    const dur       = ContestService.formatDuration(c.duration);
    const now       = zonedNow();
    const nowSecs   = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    const startSecs = parseHHMM(startHHMM) * 60;
    const endSecs   = parseHHMM(endHHMM) * 60;
    const isLive    = nowSecs >= startSecs && nowSecs < endSecs;
    this._banner.hidden = false;
    this._banner.className = 'contest-today-banner' + (isLive ? ' is-live' : '');
    this._banner.innerHTML = `
      <div class="contest-today-inner">
        <div class="contest-today-badge" style="background:${pi.color}">${pi.abbr}</div>
        <div class="contest-today-info">
          <div class="contest-today-platform">${isLive ? '🔴 LIVE NOW' : '📅 TODAY'} · ${pi.name}</div>
          <div class="contest-today-name">${c.event}</div>
          <div class="contest-today-meta">${startHHMM} – ${endHHMM} &nbsp;·&nbsp; ${dur}</div>
        </div>
        <div class="contest-today-actions">
          <span id="contest-today-countdown" class="contest-today-countdown ${isLive ? 'live' : ''}">--:--:--</span>
          <a href="${c.href}" target="_blank" rel="noopener" class="btn btn-primary btn-sm">Open&nbsp;↗</a>
        </div>
      </div>`;
  }

  _renderGrid() {
    if (!this._grid) return;
    this._grid.innerHTML = '';
    const list = this._activeFilter === 'all'
      ? this._upcoming
      : this._upcoming.filter(c => c.resource === this._activeFilter);

    if (list.length === 0) {
      this._grid.innerHTML = `<p class="contest-empty">No contests found${this._activeFilter !== 'all' ? ' for this platform' : ''} in the next 7 days.</p>`;
      this._setStatus(`✅ 0 contests (${this._upcoming.length} total)`, true);
      return;
    }
    const today  = ContestService.todayStr();
    const now    = zonedNow();
    const days   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    const MAX_VISIBLE = 10;
    const visible = list.slice(0, MAX_VISIBLE);
    const hidden  = list.slice(MAX_VISIBLE);

    visible.forEach(c => {
      const pi          = ContestService.platformInfo(c.resource);
      const startLocal  = ContestService.toLocalDate(c.start);
      const startHHMM   = ContestService.toLocalHHMM(c.start);
      const endHHMM     = ContestService.toLocalHHMM(c.end);
      const dur         = ContestService.formatDuration(c.duration);
      const startStr    = ContestService.toLocalDateStr(c.start);
      const isToday     = startStr === today;
      const nowSecs     = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
      const startSecs   = parseHHMM(startHHMM) * 60;
      const endSecs     = parseHHMM(endHHMM) * 60;
      const isLive      = isToday && nowSecs >= startSecs && nowSecs < endSecs;
      const isOver      = isToday && nowSecs >= endSecs;
      const dateLabel   = isToday ? 'Today' : `${days[startLocal.getDay()]}, ${startLocal.getDate()} ${months[startLocal.getMonth()]}`;
      const card = document.createElement('div');
      card.className = `contest-card${isToday ? ' contest-today-card' : ''}${isLive ? ' contest-live-card' : ''}${isOver ? ' contest-over' : ''}`;
      card.dataset.contestStart = c.start;
      card.dataset.contestEnd   = c.end;
      card.dataset.resource     = c.resource;
      card.innerHTML = `
        <div class="contest-card-header">
          <span class="contest-platform-badge" style="--pcolor:${pi.color}">${pi.name}</span>
          ${isLive ? '<span class="contest-status-pip live">🔴 LIVE</span>' : ''}
          ${isToday && !isLive && !isOver ? '<span class="contest-status-pip today">Today</span>' : ''}
          ${isOver ? '<span class="contest-status-pip over">Ended</span>' : ''}
        </div>
        <div class="contest-card-name">${c.event}</div>
        <div class="contest-card-meta">
          <span>📅 ${dateLabel}</span>
          <span>🕐 ${startHHMM} – ${endHHMM}</span>
          <span>⏱ ${dur}</span>
        </div>
        <a href="${c.href}" target="_blank" rel="noopener" class="contest-card-link">Open Contest ↗</a>`;
      this._grid.appendChild(card);
    });

    if (hidden.length > 0) {
      // hidden cards container
      const moreWrap = document.createElement('div');
      moreWrap.id = 'contest-more-wrap';
      moreWrap.style.display = 'none';
      // render hidden cards into a fragment then append
      const renderCard = (c) => {
        const pi          = ContestService.platformInfo(c.resource);
        const startLocal  = ContestService.toLocalDate(c.start);
        const startHHMM   = ContestService.toLocalHHMM(c.start);
        const endHHMM     = ContestService.toLocalHHMM(c.end);
        const dur         = ContestService.formatDuration(c.duration);
        const startStr    = ContestService.toLocalDateStr(c.start);
        const isToday     = startStr === today;
        const nowSecs     = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
        const startSecs   = parseHHMM(startHHMM) * 60;
        const endSecs     = parseHHMM(endHHMM) * 60;
        const isLive      = isToday && nowSecs >= startSecs && nowSecs < endSecs;
        const isOver      = isToday && nowSecs >= endSecs;
        const dateLabel   = isToday ? 'Today' : `${days[startLocal.getDay()]}, ${startLocal.getDate()} ${months[startLocal.getMonth()]}`;
        const card = document.createElement('div');
        card.className = `contest-card${isToday ? ' contest-today-card' : ''}${isLive ? ' contest-live-card' : ''}${isOver ? ' contest-over' : ''}`;
        card.dataset.contestStart = c.start;
        card.dataset.contestEnd   = c.end;
        card.dataset.resource     = c.resource;
        card.innerHTML = `
          <div class="contest-card-header">
            <span class="contest-platform-badge" style="--pcolor:${pi.color}">${pi.name}</span>
            ${isLive ? '<span class="contest-status-pip live">🔴 LIVE</span>' : ''}
            ${isToday && !isLive && !isOver ? '<span class="contest-status-pip today">Today</span>' : ''}
            ${isOver ? '<span class="contest-status-pip over">Ended</span>' : ''}
          </div>
          <div class="contest-card-name">${c.event}</div>
          <div class="contest-card-meta">
            <span>📅 ${dateLabel}</span>
            <span>🕐 ${startHHMM} – ${endHHMM}</span>
            <span>⏱ ${dur}</span>
          </div>
          <a href="${c.href}" target="_blank" rel="noopener" class="contest-card-link">Open Contest ↗</a>`;
        return card;
      };
      hidden.forEach(c => moreWrap.appendChild(renderCard(c)));
      this._grid.appendChild(moreWrap);

      // "Show more / Show less" toggle button spanning full grid width
      const toggleBtn = document.createElement('button');
      toggleBtn.className = 'btn btn-secondary contest-show-more-btn';
      toggleBtn.textContent = `Show ${hidden.length} more contest${hidden.length !== 1 ? 's' : ''} ▾`;
      toggleBtn.addEventListener('click', () => {
        const expanded = moreWrap.style.display !== 'none';
        moreWrap.style.display = expanded ? 'none' : 'contents';
        toggleBtn.textContent = expanded
          ? `Show ${hidden.length} more contest${hidden.length !== 1 ? 's' : ''} ▾`
          : 'Show less ▴';
      });
      this._grid.appendChild(toggleBtn);
    }

    this._setStatus(`✅ ${this._upcoming.length} upcoming contest${this._upcoming.length !== 1 ? 's' : ''}`, true);
  }

  _tick(now) {
    if (this._today.length === 0) return;
    const c         = this._today[0];
    const startHHMM = ContestService.toLocalHHMM(c.start);
    const endHHMM   = ContestService.toLocalHHMM(c.end);
    const nowSecs   = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    const startSecs = parseHHMM(startHHMM) * 60;
    const endSecs   = parseHHMM(endHHMM) * 60;
    const cdEl      = document.getElementById('contest-today-countdown');
    if (!cdEl) return;
    if (nowSecs < startSecs) {
      const rem = startSecs - nowSecs;
      cdEl.textContent = formatHMS(rem);
      cdEl.title = 'Starts in';
    } else if (nowSecs < endSecs) {
      const rem = endSecs - nowSecs;
      cdEl.textContent = formatHMS(rem);
      cdEl.classList.add('live');
      cdEl.title = 'Time remaining';
    } else {
      cdEl.textContent = 'Ended';
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// CONTENT RENDERER
// ══════════════════════════════════════════════════════════════════════════════
function renderContent() {
  const c = window.CONTENT;
  if (!c) return;

  // Techniques
  const hl = document.getElementById('harsh-truths-grid');
  const gl = document.getElementById('golden-list');
  if (hl && c.techniques) c.techniques.harshTruths.forEach((t, i) => {
    const card = document.createElement('div');
    card.className = 'truth-card';
    card.innerHTML = `<div class="truth-number">${String(i + 1).padStart(2, '0')}</div>
      <div class="truth-body"><strong class="truth-title">${t.title}:</strong> <span class="truth-text">${t.body}</span></div>`;
    hl.appendChild(card);
  });
  if (gl && c.techniques) c.techniques.goldenTechniques.forEach(t => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="golden-bullet">▶</span><span>${t}</span>`;
    gl.appendChild(li);
  });

  // Micro60
  const mt = document.getElementById('micro-timeline');
  if (mt && c.micro60) c.micro60.forEach((step, i) => {
    // Support both old string format and new {time,label,body} object format
    if (typeof step === 'string') {
      const [time, ...rest] = step.split('  ');
      mt.innerHTML += `<div class="micro-step"><span class="micro-step-time">${time}</span><span class="micro-step-text">${rest.join('  ')}</span></div>`;
    } else {
      // phase 1 = steps 1-2, phase 2 = steps 3-4, phase 3 = steps 5-6 (all blue shades)
      const phase = i < 2 ? 1 : i < 4 ? 2 : 3;
      mt.innerHTML += `
        <div class="micro-step" data-phase="${phase}" style="--i:${i}">
          <div class="micro-step-head">
            <span class="micro-step-num">${String(i+1).padStart(2,'0')}</span>
            <div class="micro-step-meta">
              <span class="micro-step-label">${step.label}</span>
              <span class="micro-step-time">${step.time}</span>
            </div>
          </div>
          <div class="micro-step-divider"></div>
          <p class="micro-step-body">${step.body}</p>
        </div>`;
    }
  });

  // Glossary
  const gg = document.getElementById('glossary-grid');
  if (gg && c.glossary) c.glossary.forEach(item => {
    gg.innerHTML += `<div class="glossary-card"><div class="glossary-term">${item.term}</div><div class="glossary-def">${item.def}</div></div>`;
  });

  // Most Important Keywords
  const kg = document.getElementById('keywords-grid');
  if (kg && c.keywords) c.keywords.forEach(item => {
    kg.innerHTML += `
      <div class="keyword-card">
        <div class="keyword-word">${item.word}</div>
        <blockquote class="keyword-quote">${item.quote}</blockquote>
        <p class="keyword-body">${item.body}</p>
      </div>`;
  });

  // Growth
  const GROWTH_ICONS = ['🔥','📈','📓','⭐','🎯','🔍','⚡'];
  const grl = document.getElementById('growth-list');
  if (grl && c.growth) {
    c.growth.forEach((g, i) => {
      const li = document.createElement('li');
      li.innerHTML = `
        <span class="growth-num">${i + 1}</span>
        <span class="growth-text">${g}</span>
        <span class="growth-icon">${GROWTH_ICONS[i] || '✦'}</span>`;
      grl.appendChild(li);
    });
  }

  // CF Rating Strategy
  const sb = document.getElementById('strategy-block');
  if (sb && c.strategy) {
    const s = c.strategy;
    sb.innerHTML = `
      <div class="strategy-inner">
        <div class="strategy-rule10">
          <div class="strategy-rule10-badge">10</div>
          <div class="strategy-rule10-text">
            <div class="strategy-rule10-sub">${s.rule10.subtitle}</div>
            <div class="strategy-rule10-title">${s.rule10.title}</div>
            <p class="strategy-rule10-body">${s.rule10.body}</p>
            <span class="strategy-rule10-action">${s.rule10.action}</span>
          </div>
        </div>
        <div class="strategy-cf-heading">Strategy for CF Rating Growth</div>
        <div class="strategy-tips">${s.cfTips.map((t, i) => `
          <div class="strategy-tip">
            <div class="strategy-tip-inner">
              <div class="strategy-tip-header">
                <div class="strategy-tip-icon-wrap">${t.icon}</div>
                <div class="strategy-tip-title">${t.title}</div>
              </div>
              <p class="strategy-tip-body">${t.body}</p>
              <div class="strategy-tip-footer">Tip ${i + 1} of ${s.cfTips.length}</div>
            </div>
          </div>`).join('')}
        </div>
      </div>`;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// THEME / MODE DETECTION
// ══════════════════════════════════════════════════════════════════════════════
async function detectRamadan() {
  const today = zonedNow();
  // Use local date (not UTC) to avoid timezone-crossing false negatives
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

  try {
    // Convert today's Gregorian date to Hijri via Aladhan gToH
    // If the Hijri month is 9 (Ramaḍān), it's Ramadan — no other endpoint needed.
    const d = today.getDate(), mo = today.getMonth() + 1, yr = today.getFullYear();
    const resp = await fetch(
      `https://api.aladhan.com/v1/gToH/${d}-${mo}-${yr}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!resp.ok) throw new Error('gToH HTTP ' + resp.status);
    const json = await resp.json();
    if (json.code !== 200) throw new Error('gToH error: ' + json.status);
    const hijri = json.data.hijri;
    const hijriMonth = hijri.month.number; // 9 = Ramaḍān
    const hijriDay   = parseInt(hijri.day, 10);
    const monthDays  = hijri.month.days || 30;

    if (hijriMonth === 9) {
      // Dynamically compute Gregorian Ramadan start & end from today's position
      const addDays = (base, n) => {
        const dt = new Date(base);
        dt.setDate(dt.getDate() + n);
        return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
      };
      const ramStart = addDays(today, -(hijriDay - 1));
      const ramEnd   = addDays(today,  (monthDays - hijriDay));
      window.RAMADAN_START = ramStart;
      window.RAMADAN_END   = ramEnd;
      console.info(`[Ramadan] Dynamic: ${ramStart} → ${ramEnd} (day ${hijriDay}/${monthDays})`);
      return true;
    }

    console.info(`[Ramadan] Hijri month=${hijriMonth}, not Ramadan.`);
    return false;
  } catch (e) {
    console.warn('[Ramadan] gToH failed, using fallback constants:', e.message);
  }

  // Fallback: use constants from data/ramadan.js
  const start = window.RAMADAN_START || '2026-03-01';
  const end   = window.RAMADAN_END   || '2026-03-30';
  return todayStr >= start && todayStr <= end;
}

function applyTheme(isRamadan) {
  window._isRamadan = isRamadan;
  const html = document.documentElement;
  html.setAttribute('data-theme', isRamadan ? 'ramadan' : 'general');

  // Show/hide Ramadan-only elements
  document.querySelectorAll('.ramadan-only').forEach(el => { el.hidden = !isRamadan; });

  // Mode badge
  const badge = document.getElementById('mode-badge');
  if (badge) badge.textContent = isRamadan ? '🌙 Ramadan Mode' : 'General Mode';

  // Hero title/sub
  const title = document.getElementById('hero-title');
  const sub   = document.getElementById('hero-sub');
  if (title) title.textContent = isRamadan ? 'Ramadan CP Plan' : 'CP Routine';
  if (sub)   sub.textContent   = isRamadan ? 'Ramadan 1447 · March 2026' : 'General Reference Guide';
}

// ══════════════════════════════════════════════════════════════════════════════
// STREAK TRACKER
// ══════════════════════════════════════════════════════════════════════════════
class StreakTracker {
  constructor() {
    this._load();
    this._checkIn();
    this._render();
  }
  _load() {
    const d = JSON.parse(localStorage.getItem('cp_streak') || '{"count":0,"lastDate":""}');
    this.count = d.count || 0;
    this.lastDate = d.lastDate || '';
  }
  _save() { localStorage.setItem('cp_streak', JSON.stringify({ count: this.count, lastDate: this.lastDate })); }
  _todayStr() {
    const d = zonedNow();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  _checkIn() {
    const today = this._todayStr();
    if (this.lastDate === today) return;
    const y = new Date(zonedNow()); y.setDate(y.getDate() - 1);
    const yStr = `${y.getFullYear()}-${String(y.getMonth()+1).padStart(2,'0')}-${String(y.getDate()).padStart(2,'0')}`;
    this.count = this.lastDate === yStr ? this.count + 1 : 1;
    this.lastDate = today;
    this._save();
  }
  _render() {
    const el = document.getElementById('streak-num');
    const flame = document.getElementById('streak-flame');
    if (el) {
      el.textContent = this.count;
      // animate number on first render
      el.classList.add('animate');
      setTimeout(() => el.classList.remove('animate'), 600);
    }
    if (flame && this.count >= 7) flame.classList.add('streak-hot');
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// QUOTE ROTATOR
// ══════════════════════════════════════════════════════════════════════════════
class QuoteRotator {
  constructor() {
    this.quotes = [
      'The only way to learn CP is to practice daily. \u2014 Tourist',
      'Competitive programming is about thinking, not just coding.',
      'Don\'t just solve problems, understand them deeply.',
      'Consistency beats talent when talent doesn\'t show up.',
      'Every unsolved problem teaches more than an easy AC.',
      'Think on paper first, code second.',
      'Rating is a byproduct of learning, not the goal.',
      'One hour of focused practice beats five hours of random solving.',
      'Read editorials. Re-solve. That\'s how you grow.',
      'The best time to start was yesterday. The next best time is now.',
      'Upsolving is where the real learning happens.',
      'Focus on understanding, not on the number of problems solved.',
      'Every contest is a learning opportunity, win or lose.',
      'Build a strong foundation before chasing hard problems.',
      'Discipline is the bridge between goals and accomplishments.',
    ];
    this.el = document.getElementById('quote-text');
    this._show();
    setInterval(() => this._show(), 30000);
  }
  _show() {
    if (!this.el) return;
    const idx = Math.floor(Math.random() * this.quotes.length);
    this.el.style.opacity = '0';
    setTimeout(() => { this.el.textContent = this.quotes[idx]; this.el.style.opacity = '1'; }, 400);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// POMODORO TIMER
// ══════════════════════════════════════════════════════════════════════════════
class PomodoroTimer {
  constructor() {
    this.WORK = 25 * 60; this.SHORT_BREAK = 5 * 60; this.LONG_BREAK = 15 * 60;
    this.session = 1; this.maxSessions = 4; this.isWork = true;
    this.remaining = this.WORK; this.total = this.WORK;
    this.running = false; this.raf = null; this.lastFrame = 0;
    this.CIRCUMFERENCE = 2 * Math.PI * 54; // matches ring radius
    this.display = document.getElementById('pomo-display');
    this.ringProgress = document.getElementById('pomo-ring-progress');
    this.sessionLabel = document.getElementById('pomo-session-count');
    this.phaseLabel = document.getElementById('pomo-phase-label');
    this.overlay = document.getElementById('pomo-overlay');
    this.overlayTime = document.getElementById('pomo-overlay-time');
    this.overlayPhase = document.getElementById('pomo-overlay-phase');
    // Setup ring
    if (this.ringProgress) {
      this.ringProgress.style.strokeDasharray = this.CIRCUMFERENCE;
      this.ringProgress.style.strokeDashoffset = '0';
    }
    document.getElementById('pomo-start')?.addEventListener('click', () => this.start());
    document.getElementById('pomo-pause')?.addEventListener('click', () => this.pause());
    document.getElementById('pomo-reset')?.addEventListener('click', () => this.reset());
    document.getElementById('pomo-overlay-close')?.addEventListener('click', () => this._hideOverlay());
    this._render();
  }
  start() {
    if (this.remaining <= 0) return;
    this.running = true; this.lastFrame = performance.now();
    this.display?.classList.add('running');
    document.getElementById('pomo-start').disabled = true;
    document.getElementById('pomo-pause').disabled = false;
    if (this.isWork) this._showOverlay();
    this._tick();
    dispatch('pomo:start');
  }
  pause() {
    this.running = false; cancelAnimationFrame(this.raf);
    this.display?.classList.remove('running');
    document.getElementById('pomo-start').disabled = false;
    document.getElementById('pomo-pause').disabled = true;
    dispatch('pomo:pause');
  }
  reset() {
    this.running = false; cancelAnimationFrame(this.raf);
    this.session = 1; this.isWork = true;
    this.remaining = this.WORK; this.total = this.WORK;
    this.display?.classList.remove('running');
    document.getElementById('pomo-start').disabled = false;
    document.getElementById('pomo-pause').disabled = true;
    this._hideOverlay(); this._render();
    dispatch('pomo:reset');
  }
  _tick() {
    if (!this.running) return;
    const now = performance.now();
    this.remaining -= (now - this.lastFrame) / 1000;
    this.lastFrame = now;
    if (this.remaining <= 0) {
      this.remaining = 0; this.running = false;
      this._beep(); this._hideOverlay();
      if (this.isWork) {
        this.isWork = false;
        if (this.session >= this.maxSessions) {
          this.remaining = this.LONG_BREAK; this.total = this.LONG_BREAK; this.session = 1;
        } else {
          this.remaining = this.SHORT_BREAK; this.total = this.SHORT_BREAK;
        }
      } else {
        this.isWork = true; this.session++;
        this.remaining = this.WORK; this.total = this.WORK;
      }
      this.display?.classList.remove('running');
      document.getElementById('pomo-start').disabled = false;
      document.getElementById('pomo-pause').disabled = true;
      this._render(); return;
    }
    this._render();
    this.raf = requestAnimationFrame(() => this._tick());
  }
  _render() {
    const r = Math.max(0, Math.ceil(this.remaining));
    const m = Math.floor(r / 60), s = r % 60;
    const text = pad(m) + ':' + pad(s);
    if (this.display) this.display.textContent = text;
    if (this.overlayTime) this.overlayTime.textContent = text;
    if (this.sessionLabel) this.sessionLabel.textContent = `Session ${this.session} of ${this.maxSessions}`;
    if (this.phaseLabel) {
      this.phaseLabel.textContent = this.isWork ? 'Work' : 'Break';
      this.phaseLabel.className = 'pomo-phase-label ' + (this.isWork ? 'pomo-work' : 'pomo-break');
    }
    if (this.overlayPhase) this.overlayPhase.textContent = this.isWork ? '\ud83c\udfaf Focus Time' : '\u2615 Break Time';
    // Update ring progress
    if (this.ringProgress) {
      const fraction = this.total > 0 ? (this.total - this.remaining) / this.total : 0;
      const offset = this.CIRCUMFERENCE * (1 - fraction);
      this.ringProgress.style.strokeDashoffset = offset;
      // Change ring color based on phase
      this.ringProgress.style.stroke = this.isWork ? 'var(--accent)' : '#16a34a';
    }
  }
  _showOverlay() { if (this.overlay) this.overlay.hidden = false; }
  _hideOverlay() { if (this.overlay) this.overlay.hidden = true; }
  _beep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [523.3, 659.3, 784.0].forEach((freq, i) => {
        const osc = ctx.createOscillator(), g = ctx.createGain();
        osc.frequency.value = freq;
        g.gain.setValueAtTime(0.2, ctx.currentTime + i * 0.2);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.2 + 0.3);
        osc.connect(g); g.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.2); osc.stop(ctx.currentTime + i * 0.2 + 0.35);
      });
    } catch (e) {}
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// SUBMISSION FETCHER  — auto-fetch from Codeforces, LeetCode, AtCoder APIs
// ══════════════════════════════════════════════════════════════════════════════
class SubmissionFetcher {
  constructor() {
    this.CACHE_KEY = 'cp_fetch_cache';
    this.HANDLES_KEY = 'cp_handles';
    this.CACHE_TTL = 60 * 60 * 1000; // 1 hour
  }

  getHandles() {
    try { return JSON.parse(localStorage.getItem(this.HANDLES_KEY) || '{}'); }
    catch { return {}; }
  }

  saveHandles(handles) {
    localStorage.setItem(this.HANDLES_KEY, JSON.stringify(handles));
  }

  getCachedData() {
    try {
      const raw = localStorage.getItem(this.CACHE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (Date.now() - data.fetchedAt > this.CACHE_TTL) return null;
      return data.submissions;
    } catch { return null; }
  }

  clearCache() { localStorage.removeItem(this.CACHE_KEY); }

  async fetchAll(handles, onProgress) {
    const results = [];
    const platforms = [
      { key: 'cf', name: 'Codeforces', fn: this._fetchCF.bind(this) },
      { key: 'lc', name: 'LeetCode',   fn: this._fetchLC.bind(this) },
      { key: 'ac', name: 'AtCoder',    fn: this._fetchAC.bind(this) },
      { key: 'vj', name: 'VJudge',     fn: this._fetchVJ.bind(this) },
    ];

    for (const p of platforms) {
      const h = handles[p.key]?.trim();
      const dot = document.getElementById(`status-${p.key}`);
      if (!h) { if (dot) dot.className = 'handle-card-status'; continue; }
      if (dot) { dot.className = 'handle-card-status loading'; }
      onProgress?.(`Fetching ${p.name}…`);
      try {
        const subs = await p.fn(h);
        results.push(...subs);
        if (dot) { dot.className = 'handle-card-status connected'; }
        onProgress?.(`✓ ${p.name}: ${subs.length.toLocaleString()} submissions`);
      } catch (e) {
        console.warn(`[Fetcher] ${p.name}:`, e);
        if (dot) { dot.className = 'handle-card-status error'; }
        onProgress?.(`⚠ ${p.name}: ${e.message}`);
      }
    }

    try {
      localStorage.setItem(this.CACHE_KEY, JSON.stringify({
        fetchedAt: Date.now(),
        submissions: results,
      }));
    } catch (e) { console.warn('[Fetcher] cache write failed', e); }

    return results;
  }

  /* ── Codeforces ────────────────────────────────────────────────────────── */
  async _fetchCF(handle) {
    const resp = await fetch(
      `https://codeforces.com/api/user.status?handle=${encodeURIComponent(handle)}&from=1&count=10000`,
      { signal: AbortSignal.timeout(15000) }
    );
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    if (data.status !== 'OK') throw new Error(data.comment || 'API error');
    return data.result.map(s => ({
      timestamp: s.creationTimeSeconds * 1000,
      date: this._epochToDate(s.creationTimeSeconds),
      platform: 'Codeforces',
      name: s.problem?.name || 'Unknown',
      rating: s.problem?.rating || null,
      verdict: this._verdict(s.verdict),
      link: s.contestId
        ? `https://codeforces.com/contest/${s.contestId}/problem/${s.problem?.index || ''}`
        : null,
      auto: true,
    }));
  }

  /* ── AtCoder (kenkoooo API) ────────────────────────────────────────────── */
  async _fetchAC(handle) {
    const resp = await fetch(
      `https://kenkoooo.com/atcoder/atcoder-api/v3/user/submissions?user=${encodeURIComponent(handle)}&from_second=0`,
      { signal: AbortSignal.timeout(15000) }
    );
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    if (!Array.isArray(data)) throw new Error('Invalid response');
    return data.map(s => ({
      timestamp: s.epoch_second * 1000,
      date: this._epochToDate(s.epoch_second),
      platform: 'AtCoder',
      name: s.problem_id || 'Unknown',
      rating: null,
      verdict: this._verdict(s.result),
      link: s.contest_id && s.problem_id
        ? `https://atcoder.jp/contests/${s.contest_id}/tasks/${s.problem_id}`
        : null,
      auto: true,
    }));
  }

  /* ── LeetCode (proxy API — may cold-start for ~30 s) ──────────────────── */
  async _fetchLC(handle) {
    const resp = await fetch(
      `https://alfa-leetcode-api.onrender.com/${encodeURIComponent(handle)}/submission?limit=200`,
      { signal: AbortSignal.timeout(35000) }
    );
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    const subs = Array.isArray(data) ? data
      : data.submission ? data.submission
      : data.acSubmission ? data.acSubmission
      : [];
    if (!Array.isArray(subs)) throw new Error('Unexpected format');
    return subs.filter(s => s.timestamp).map(s => ({
      timestamp: Number(s.timestamp) * 1000,
      date: this._epochToDate(Number(s.timestamp)),
      platform: 'LeetCode',
      name: s.title || s.titleSlug || 'Unknown',
      rating: null,
      verdict: this._verdict(s.statusDisplay || 'Accepted'),
      link: s.titleSlug
        ? `https://leetcode.com/problems/${s.titleSlug}/`
        : null,
      auto: true,
    }));
  }

  /* ── VJudge (solveDetail — public, no auth) ────────────────────────────── */
  async _fetchVJ(handle) {
    const resp = await fetch(
      `https://vjudge.net/user/solveDetail/${encodeURIComponent(handle)}`,
      { signal: AbortSignal.timeout(15000) }
    );
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    const results = [];
    const now = Date.now();
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    // acRecords: { "POJ": ["1000","1001"], "CodeForces": ["71A"], ... }
    if (data.acRecords) {
      for (const [oj, problems] of Object.entries(data.acRecords)) {
        for (const pid of problems) {
          results.push({
            timestamp: now,
            date: dateStr,
            platform: 'VJudge',
            name: `${oj}-${pid}`,
            rating: null,
            verdict: 'AC',
            link: `https://vjudge.net/user/${encodeURIComponent(handle)}`,
            auto: true,
          });
        }
      }
    }
    // failRecords: same structure but non-AC
    if (data.failRecords) {
      for (const [oj, problems] of Object.entries(data.failRecords)) {
        for (const pid of problems) {
          results.push({
            timestamp: now,
            date: dateStr,
            platform: 'VJudge',
            name: `${oj}-${pid}`,
            rating: null,
            verdict: 'WA',
            link: `https://vjudge.net/user/${encodeURIComponent(handle)}`,
            auto: true,
          });
        }
      }
    }
    return results;
  }

  /* ── helpers ───────────────────────────────────────────────────────────── */
  _verdict(v) {
    if (!v) return '?';
    const u = v.toUpperCase();
    if (u === 'OK' || u === 'ACCEPTED' || u === 'AC') return 'AC';
    if (u === 'WRONG_ANSWER' || u === 'WRONG ANSWER' || u === 'WA') return 'WA';
    if (u.includes('TIME_LIMIT') || u.includes('TIME LIMIT') || u === 'TLE') return 'TLE';
    if (u.includes('MEMORY_LIMIT') || u.includes('MEMORY LIMIT') || u === 'MLE') return 'MLE';
    if (u.includes('RUNTIME') || u === 'RE') return 'RE';
    if (u.includes('COMPILATION') || u === 'CE') return 'CE';
    return v.length > 10 ? v.substring(0, 8) + '…' : v;
  }

  _epochToDate(epoch) {
    const d = new Date(epoch * 1000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// PROBLEM TRACKER  — merges auto-fetched + manual submissions
// ══════════════════════════════════════════════════════════════════════════════
class ProblemTracker {
  constructor() {
    this.KEY = 'cp_problems';
    this.problems = JSON.parse(localStorage.getItem(this.KEY) || '[]');
    this.fetcher = new SubmissionFetcher();
    this._setupHandles();
    this._setupForm();
    this._loadAndRender();
  }

  _save() { localStorage.setItem(this.KEY, JSON.stringify(this.problems)); }

  /* ── handle inputs + sync button ───────────────────────────────────────── */
  _setupHandles() {
    const handles = this.fetcher.getHandles();
    const fill = (id, key, fallback) => {
      const el = document.getElementById(id);
      if (el) el.value = handles[key] || fallback || '';
    };
    fill('handle-cf', 'cf', 'm0stafa');
    fill('handle-lc', 'lc', '');
    fill('handle-ac', 'ac', '');
    fill('handle-vj', 'vj', '');

    document.getElementById('tracker-sync-btn')
      ?.addEventListener('click', () => this._syncSubmissions());
  }

  /* ── manual form ───────────────────────────────────────────────────────── */
  _setupForm() {
    document.getElementById('tracker-form')?.addEventListener('submit', e => {
      e.preventDefault();
      const p = {
        id: Date.now(),
        timestamp: Date.now(),
        date: this._todayStr(),
        platform: document.getElementById('tf-platform').value,
        link:     document.getElementById('tf-link').value,
        name:     document.getElementById('tf-name').value,
        rating:   document.getElementById('tf-rating').value,
        verdict:  document.getElementById('tf-verdict').value,
        time:     document.getElementById('tf-time').value,
        auto: false,
      };
      this.problems.unshift(p);
      this._save();
      this._renderAll();
      e.target.reset();
    });
  }

  /* ── sync from APIs ────────────────────────────────────────────────────── */
  async _syncSubmissions() {
    const statusEl = document.getElementById('tracker-sync-status');
    const syncBtn  = document.getElementById('tracker-sync-btn');

    const handles = {
      cf: document.getElementById('handle-cf')?.value?.trim() || '',
      lc: document.getElementById('handle-lc')?.value?.trim() || '',
      ac: document.getElementById('handle-ac')?.value?.trim() || '',
      vj: document.getElementById('handle-vj')?.value?.trim() || '',
    };

    if (!handles.cf && !handles.lc && !handles.ac && !handles.vj) {
      if (statusEl) { statusEl.textContent = '⚠ Enter at least one handle'; statusEl.className = 'tracker-sync-status error'; }
      return;
    }

    this.fetcher.saveHandles(handles);
    if (syncBtn) { syncBtn.disabled = true; syncBtn.classList.add('syncing'); }
    if (statusEl) { statusEl.className = 'tracker-sync-status'; }

    try {
      const subs = await this.fetcher.fetchAll(handles, msg => {
        if (statusEl) statusEl.textContent = msg;
      });
      // Show unique problem count after dedup
      this._renderAll();
      const uniqueCount = this._getAllSubmissions().length - this.problems.length;
      if (statusEl) {
        statusEl.textContent = `✓ ${uniqueCount.toLocaleString()} unique problems synced`;
        statusEl.className = 'tracker-sync-status success';
      }
    } catch (e) {
      if (statusEl) {
        statusEl.textContent = `⚠ Sync failed: ${e.message}`;
        statusEl.className = 'tracker-sync-status error';
      }
    } finally {
      if (syncBtn) { syncBtn.disabled = false; syncBtn.classList.remove('syncing'); }
    }
  }

  /* ── initial load ──────────────────────────────────────────────────────── */
  async _loadAndRender() {
    this._renderAll();                         // render cached/manual data immediately
    const handles = this.fetcher.getHandles();
    const cached  = this.fetcher.getCachedData();
    if ((handles.cf || handles.lc || handles.ac || handles.vj) && !cached) {
      await this._syncSubmissions();           // auto-sync if cache is stale
    }
  }

  /* ── merge fetched + manual, deduplicate ─────────────────────────────── */
  _getAllSubmissions() {
    const fetched = this.fetcher.getCachedData() || [];
    const manual  = this.problems.map(p => ({ ...p, timestamp: p.timestamp || p.id }));

    // Deduplicate auto-fetched: keep best verdict per (platform + problem name)
    // Priority: AC > Upsolve > everything else (keep highest-priority)
    const VP = { AC: 3, Upsolve: 2 }; // others default to 1
    const deduped = new Map();
    for (const s of fetched) {
      const key = `${s.platform}::${(s.name || '').toLowerCase()}`;
      const existing = deduped.get(key);
      if (!existing || (VP[s.verdict] || 1) > (VP[existing.verdict] || 1)
          || ((VP[s.verdict] || 1) === (VP[existing.verdict] || 1) && s.timestamp > existing.timestamp)) {
        deduped.set(key, s);
      }
    }

    const all = [...manual, ...deduped.values()];
    all.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    return all;
  }

  _todayStr() {
    const d = zonedNow();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  _renderAll() { this._renderStats(); this._renderHeatmap(); this._renderLog(); }

  /* ── stats cards ───────────────────────────────────────────────────────── */
  _renderStats() {
    const all   = this._getAllSubmissions();
    const today = this._todayStr();
    const d = zonedNow(); const wa = new Date(d); wa.setDate(wa.getDate() - 7);
    const weekStr = `${wa.getFullYear()}-${String(wa.getMonth()+1).padStart(2,'0')}-${String(wa.getDate()).padStart(2,'0')}`;

    const solved     = all.filter(p => p.verdict === 'AC');
    const todayCount = solved.filter(p => p.date === today).length;
    const weekCount  = solved.filter(p => p.date >= weekStr).length;
    const acRate     = all.length ? Math.round((solved.length / all.length) * 100) : 0;

    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('ts-total',   solved.length.toLocaleString());
    set('ts-today',   todayCount);
    set('ts-week',    weekCount);
    set('ts-ac-rate', acRate + '%');
  }

  /* ── heatmap ───────────────────────────────────────────────────────────── */
  _renderHeatmap() {
    const el = document.getElementById('tracker-heatmap');
    if (!el) return;
    const all    = this._getAllSubmissions();
    const counts = {};
    all.forEach(p => { counts[p.date] = (counts[p.date] || 0) + 1; });

    const today = zonedNow();
    const cells = [];
    for (let i = 83; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const c = counts[ds] || 0;
      const level = c === 0 ? 0 : c <= 2 ? 1 : c <= 5 ? 2 : c <= 10 ? 3 : 4;
      cells.push(`<div class="hm-cell hm-${level}" title="${ds}: ${c} submission${c !== 1 ? 's' : ''}"></div>`);
    }
    el.innerHTML = cells.join('');
  }

  /* ── log table ─────────────────────────────────────────────────────────── */
  _renderLog() {
    const tbody = document.getElementById('tracker-log-body');
    if (!tbody) return;
    const recent = this._getAllSubmissions().slice(0, 30);
    tbody.innerHTML = recent.map(p => {
      const vClass   = p.verdict === 'AC' ? 'v-ac' : p.verdict === 'Upsolve' ? 'v-up' : 'v-fail';
      const safe     = this._esc(p.name);
      const nameHtml = p.link ? `<a href="${p.link}" target="_blank" rel="noopener">${safe}</a>` : safe;
      const delBtn   = p.auto ? '' : `<button class="btn-icon tracker-del" data-id="${p.id}" title="Delete">\u2715</button>`;
      const plat     = (p.platform || 'Other').toLowerCase();
      return `<tr${p.auto ? ' class="auto-row"' : ''}>
        <td class="time-tag">${p.date}</td>
        <td><span class="platform-pill platform-${plat}">${p.platform || 'Other'}</span></td>
        <td class="problem-name-cell">${nameHtml}</td>
        <td>${p.rating || '\u2014'}</td>
        <td><span class="verdict-badge ${vClass}">${p.verdict}</span></td>
        <td>${p.time ? p.time + 'm' : '\u2014'}</td>
        <td>${delBtn}</td>
      </tr>`;
    }).join('');

    tbody.querySelectorAll('.tracker-del').forEach(btn => {
      btn.addEventListener('click', () => {
        this.problems = this.problems.filter(p => p.id !== +btn.dataset.id);
        this._save(); this._renderAll();
      });
    });
  }

  _esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }
}


// ══════════════════════════════════════════════════════════════════════════════
// KEYBOARD SHORTCUTS
// ══════════════════════════════════════════════════════════════════════════════
class KeyboardShortcuts {
  constructor() {
    this.overlay = document.getElementById('kb-overlay');
    document.addEventListener('keydown', e => this._handle(e));
    document.getElementById('kb-close')?.addEventListener('click', () => this._hide());
  }
  _handle(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
    switch (e.key) {
      case '?': this._toggle(); break;
      case 'Escape': this._hide(); break;
      case 'd': case 'D': document.getElementById('dark-toggle')?.click(); break;
      case '1': document.getElementById('routine')?.scrollIntoView({ behavior: 'smooth' }); break;
      case '2': document.getElementById('contests')?.scrollIntoView({ behavior: 'smooth' }); break;
      case '3': document.getElementById('tools')?.scrollIntoView({ behavior: 'smooth' }); break;
      case '4': document.getElementById('techniques')?.scrollIntoView({ behavior: 'smooth' }); break;
      case '5': document.getElementById('growth')?.scrollIntoView({ behavior: 'smooth' }); break;
      case '6': document.getElementById('tracker')?.scrollIntoView({ behavior: 'smooth' }); break;
      case 't': case 'T': window.scrollTo({ top: 0, behavior: 'smooth' }); break;
    }
  }
  _toggle() { if (this.overlay) this.overlay.hidden = !this.overlay.hidden; }
  _hide() { if (this.overlay) this.overlay.hidden = true; }
}


// ══════════════════════════════════════════════════════════════════════════════
// BACK TO TOP
// ══════════════════════════════════════════════════════════════════════════════
class BackToTop {
  constructor() {
    this.btn = document.getElementById('back-to-top');
    if (!this.btn) return;
    this.btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    window.addEventListener('scroll', () => {
      this.btn.classList.toggle('visible', window.scrollY > 400);
    }, { passive: true });
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// FAVICON BADGE (title prefix when Pomodoro is running)
// ══════════════════════════════════════════════════════════════════════════════
class FaviconBadge {
  constructor() {
    this._title = document.title;
    document.addEventListener('pomo:start', () => this._set(true));
    document.addEventListener('pomo:pause', () => this._set(false));
    document.addEventListener('pomo:reset', () => this._set(false));
  }
  _set(active) { document.title = active ? '\ud83c\udf45 ' + this._title : this._title; }
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN ENTRY
// ══════════════════════════════════════════════════════════════════════════════
let _bg = null, _alarms = null, _timeline = null, _ramadanCD = null;

// Prevent browser from restoring scroll position on reload — always start at hero
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

document.addEventListener('DOMContentLoaded', async () => {
  // Always land at the top of the page (hero section)
  window.scrollTo({ top: 0, behavior: 'instant' });

  // Footer year
  const yearEl = document.getElementById('footer-year');
  if (yearEl) yearEl.textContent = zonedNow().getFullYear();

  // 1. Detect mode
  const isRamadan = await detectRamadan();
  applyTheme(isRamadan);

  // 2. Swap routine data — both scripts are pre-loaded as static <script> tags,
  //    so this works on file:// protocol with no server required.
  if (!isRamadan && window.GENERAL_ROUTINE) {
    window.ROUTINE = window.GENERAL_ROUTINE;
    // Use general fallback prayer times if Ramadan ones don't apply
    if (window.GENERAL_PRAYER_TIMES) {
      window.PRAYER_TIMES = window.GENERAL_PRAYER_TIMES;
    }
  }

  // 3. Render content sections
  renderContent();

  // 4. Aurora waves animation (smooth continuous flowing background)
  _bg = new AuroraWaves('hero-canvas');
  new AnalogClock('analog-clock');

  // 5. Prayer watch widget
  const watch = new NextPrayerWatch('prayer-watch-canvas');

  // 6. Clock, Engine, View
  new RealTimeClock();
  new RoutineEngine();
  _timeline = new TimelineView();

  // 7. Alarm service
  _alarms = new AudioAlertService();
  _alarms.scheduleBlockAlarms(window.ROUTINE);

  // 9. Get prayer times (always — needed for watch widget in both modes)
  const runPrayerFetch = () => PrayerTimeService.fromGeolocation().then(pt => {
    if (isRamadan && !_ramadanCD) {
      _ramadanCD = new RamadanCountdown();
    }
    _alarms.cancelAll();
    _alarms.scheduleAzanAlarms(pt);
    _alarms.scheduleBlockAlarms(window.ROUTINE);
  });
  runPrayerFetch();

  // Refresh button — clears today's cache and re-fetches
  document.getElementById('prayer-refresh-btn')?.addEventListener('click', () => {
    const d = zonedNow();
    const local = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    localStorage.removeItem('prayer_' + local);
    localStorage.removeItem('prayer_' + zonedNow().toISOString().slice(0, 10)); // also clear UTC key
    PrayerTimeService._setLabel('🔄 Refreshing prayer times…', false);
    runPrayerFetch();
  });

  // Banner retry button
  document.getElementById('geo-banner-retry')?.addEventListener('click', () => {
    const d = zonedNow();
    const local = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    localStorage.removeItem('prayer_' + local);
    document.getElementById('geo-banner').hidden = true;
    PrayerTimeService._setLabel('🔄 Fetching prayer times…', false);
    runPrayerFetch();
  });

  // Banner close button
  document.getElementById('geo-banner-close')?.addEventListener('click', () => {
    document.getElementById('geo-banner').hidden = true;
  });

  // 10. Stopwatch + Timer
  new Stopwatch();
  new CountdownTimer();

  // 11. Contest Tracker — load from Clist.by and wire up dynamic routine
  const contestRenderer = new ContestRenderer();

  // When contests load → rebuild routine if there are today contests
  let _useContestRoutine = true; // user can override back to regular
  let _baseRoutineBackup = [...(window.ROUTINE || [])];

  function rebuildRoutineForContests(todayContests) {
    if (!_useContestRoutine || !todayContests || todayContests.length === 0) return;
    const built = DynamicRoutineBuilder.build(_baseRoutineBackup, todayContests);
    window.ROUTINE = built;
    if (_timeline) _timeline.render();
    // Show badge listing all today's contests
    const badge    = document.getElementById('contest-routine-badge');
    const badgeTxt = document.getElementById('contest-routine-badge-text');
    if (badge && badgeTxt) {
      const sorted = [...todayContests].sort((a, b) =>
        parseHHMM(ContestService.toLocalHHMM(a.start)) -
        parseHHMM(ContestService.toLocalHHMM(b.start))
      );
      const summary = sorted.map(c => {
        const pi = ContestService.platformInfo(c.resource);
        return `${pi.name} @ ${ContestService.toLocalHHMM(c.start)}`;
      }).join(' · ');
      badgeTxt.textContent = `📅 Contest day! Routine adjusted — ${summary}`;
      badge.hidden = false;
    }
    // Reschedule alarms for the new routine
    _alarms.cancelAll();
    _alarms.scheduleBlockAlarms(window.ROUTINE);
    _alarms.scheduleAzanAlarms(window.PRAYER_TIMES || {});
  }

  document.addEventListener('contests:loaded', e => {
    rebuildRoutineForContests(e.detail.today);

    // Contest-day nav alert pill
    const alertBtn  = document.getElementById('contest-nav-alert');
    const alertText = document.getElementById('contest-nav-alert-text');
    const navLogo = document.querySelector('.nav-logo');
    if (navLogo) navLogo.classList.toggle('contest-day', !!(e.detail.today && e.detail.today.length > 0));

    if (alertBtn && alertText && e.detail.today && e.detail.today.length > 0) {
      const sorted = [...e.detail.today].sort((a, b) =>
        parseHHMM(ContestService.toLocalHHMM(a.start)) -
        parseHHMM(ContestService.toLocalHHMM(b.start))
      );
      const first = sorted[0];
      const pi    = ContestService.platformInfo(first.resource);
      const count = sorted.length;
      alertText.textContent = count > 1
        ? `${count} Contests Today`
        : `${pi.name} @ ${ContestService.toLocalHHMM(first.start)}`;
      alertBtn.hidden = false;
      alertBtn.onclick = () => {
        document.getElementById('contests')?.scrollIntoView({ behavior: 'smooth' });
      };
    } else if (alertBtn) {
      alertBtn.hidden = true;
    }
  });

  // "Use Regular Schedule" button
  document.getElementById('contest-routine-reset-btn')?.addEventListener('click', () => {
    _useContestRoutine = false;
    window.ROUTINE = [..._baseRoutineBackup];
    if (_timeline) _timeline.render();
    document.getElementById('contest-routine-badge').hidden = true;
    _alarms.cancelAll();
    _alarms.scheduleBlockAlarms(window.ROUTINE);
    _alarms.scheduleAzanAlarms(window.PRAYER_TIMES || {});
  });

  // Load contests (after a tiny delay to not block first-paint)
  setTimeout(() => contestRenderer.load(), 800);

  // 11. (Theme is fully automatic via detectRamadan() — no manual toggle needed)

  // 12. Dark mode toggle — also request notification permission on first user gesture
  const _requestNotifOnce = () => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    document.removeEventListener('click', _requestNotifOnce);
  };
  document.addEventListener('click', _requestNotifOnce, { once: true });

  document.getElementById('dark-toggle')?.addEventListener('click', () => {
    const dark = document.documentElement.getAttribute('data-dark') === 'true';
    document.documentElement.setAttribute('data-dark', dark ? 'false' : 'true');
  });

  // 13. Prayer watch collapse ↔ navbar pill
  const pwCard     = document.getElementById('prayer-watch-card');
  const pwCollapse = document.getElementById('pw-collapse');
  const pwNavPill  = document.getElementById('pw-nav-pill');

  function setPWCollapsed(collapsed) {
    pwCard.classList.toggle('collapsed', collapsed);
    pwCollapse.textContent = collapsed ? '+' : '−';
    if (pwNavPill) pwNavPill.hidden = !collapsed;
    localStorage.setItem('pw_collapsed', collapsed ? '1' : '0');
  }

  const isMobile = () => window.innerWidth <= 768;

  if (pwCollapse && pwCard) {
    const savedCollapsed = localStorage.getItem('pw_collapsed') === '1';
    // Hand off from the pre-paint data attribute to JS class control
    document.documentElement.removeAttribute('data-pw-collapsed');
    setPWCollapsed(savedCollapsed);
    pwCollapse.addEventListener('click', () => {
      if (isMobile()) {
        // On mobile: just close the card panel; keep fab visible
        pwCard.classList.remove('mobile-open');
      } else {
        // Desktop: toggle — collapse when open, expand when already collapsed
        const isCollapsed = pwCard.classList.contains('collapsed');
        setPWCollapsed(!isCollapsed);
      }
    });
  }
  if (pwNavPill) {
    pwNavPill.addEventListener('click', () => setPWCollapsed(false));
  }

  // Keep navbar pill text in sync with the watch countdown
  document.addEventListener('prayer:tick', e => {
    const pillName = document.getElementById('pw-pill-name');
    const pillTime = document.getElementById('pw-pill-countdown');
    if (pillName) pillName.textContent = e.detail.name || '—';
    if (pillTime) pillTime.textContent = e.detail.countdown || '--:--:--';
    // Keep FAB label in sync
    const fabLabel = document.getElementById('prayer-fab-label');
    if (fabLabel) fabLabel.textContent = e.detail.name || '';
  });

  // 14. Prayer FAB (mobile)
  const fab = document.getElementById('prayer-fab');
  if (fab && pwCard) {
    fab.addEventListener('click', () => {
      const opening = !pwCard.classList.contains('mobile-open');
      if (opening) {
        // Strip the desktop-collapsed state so .collapsed doesn't block display
        pwCard.classList.remove('collapsed');
        if (pwNavPill) pwNavPill.hidden = true;
      }
      pwCard.classList.toggle('mobile-open');
      // Show × when open, and reset to − when closed (matches desktop default)
      if (pwCollapse) pwCollapse.textContent = opening ? '×' : '−';
    });
  }

  // 16. Nav scroll effect
  window.addEventListener('scroll', () => {
    const nav = document.getElementById('topnav');
    if (nav) nav.style.boxShadow = window.scrollY > 10 ? '0 2px 20px rgba(0,0,0,0.3)' : '';
  });

  // 17. Auto-switch mode at midnight (Ramadan start/end transitions without reload)
  const schedMidnightCheck = () => {
    const now = zonedNow();
    const msUntilMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) - now;
    setTimeout(async () => {
      const wasRamadan = window._isRamadan;
      const nowRamadan = await detectRamadan();
      if (nowRamadan !== wasRamadan) {
        // Mode changed — swap routine data and re-render everything
        if (!nowRamadan && window.GENERAL_ROUTINE) {
          window.ROUTINE = window.GENERAL_ROUTINE;
          if (window.GENERAL_PRAYER_TIMES) window.PRAYER_TIMES = window.GENERAL_PRAYER_TIMES;
        } else if (nowRamadan) {
          // Restore Ramadan routine from ramadan.js
          window.ROUTINE = window._ramadanRoutineBackup || window.ROUTINE;
        }
        _baseRoutineBackup = [...(window.ROUTINE || [])];  // keep contest builder in sync
        _useContestRoutine = true;
        applyTheme(nowRamadan);
        if (_bg) _bg.setTheme(nowRamadan ? 'ramadan' : 'general');
        if (nowRamadan && !_ramadanCD) _ramadanCD = new RamadanCountdown();
        else if (!nowRamadan) _ramadanCD = null;
        if (_timeline) _timeline.render();
        _alarms.cancelAll();
        runPrayerFetch();
      }
      schedMidnightCheck(); // reschedule for next midnight
    }, msUntilMidnight + 1000);
  };
  // Back up the Ramadan routine so we can restore it if switching back
  window._ramadanRoutineBackup = [...(window.ROUTINE || [])];
  schedMidnightCheck();

  // ── New Features ──────────────────────────────────────────────────────────
  new StreakTracker();
  new QuoteRotator();
  new PomodoroTimer();
  new ProblemTracker();
  new KeyboardShortcuts();
  new BackToTop();
  new FaviconBadge();

  // ══════════════════════════════════════════════════════════════════════════
  // ANIMATION ENGINE
  // ══════════════════════════════════════════════════════════════════════════

  // 1. Mark elements for scroll-reveal
  const markReveal = (sel, cls = '') => document.querySelectorAll(sel).forEach(el => {
    el.classList.add('reveal'); if (cls) el.classList.add(cls);
  });
  markReveal('.section-heading');
  markReveal('.tool-card', 'scale-in');
  markReveal('.truth-card');
  markReveal('.golden-list li');
  markReveal('.content-card');
  markReveal('.prayer-watch-card', 'from-right');
  markReveal('.footer-inner');
  markReveal('#micro-timeline', 'reveal-stagger');
  markReveal('.keyword-card');
  markReveal('.strategy-rule10');
  markReveal('.strategy-tip', 'scale-in');
  markReveal('.subsection-header', 'from-left');
  markReveal('.table-wrap');
  markReveal('.micro60-sub');
  // Prayer time pills stagger
  document.querySelector('.prayer-times-hero')?.classList.add('reveal-stagger');
  // Tools grid stagger
  document.querySelector('#tools-grid')?.classList.add('reveal-stagger');
  // Growth list stagger
  document.querySelector('#growth-list')?.classList.add('reveal-stagger');
  // Keywords grid stagger
  document.querySelector('#keywords-grid')?.classList.add('reveal-stagger');
  // New feature sections
  markReveal('.tracker-stat', 'scale-in');
  markReveal('.tracker-heatmap-wrap');
  markReveal('.tracker-form-wrap');
  markReveal('.tracker-log-wrap');
  markReveal('.cf-stat', 'scale-in');
  markReveal('.cf-chart-wrap');
  document.querySelector('#tracker-stats')?.classList.add('reveal-stagger');
  document.querySelector('#cf-rating-stats')?.classList.add('reveal-stagger');

  // 2. Intersection Observer — fires once per element
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      el.classList.add('visible');
      // Section headings: also animate underline
      if (el.classList.contains('section-heading')) el.classList.add('visible');
      observer.unobserve(el);
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -60px 0px' });

  document.querySelectorAll('.reveal, .reveal-stagger, .section-heading').forEach(el => observer.observe(el));

  // Also observe contest cards when they load (rendered after DOMContentLoaded)
  document.addEventListener('contests:loaded', () => {
    document.querySelectorAll('.contest-card, .contest-today-banner').forEach(el => {
      el.classList.add('reveal', 'scale-in');
      observer.observe(el);
    });
    document.querySelector('#contests-grid')?.classList.add('reveal-stagger');
    observer.observe(document.querySelector('#contests-grid'));
  });

  // 3. Stagger routine table rows by adding animation-delay inline
  const addRowDelays = () => {
    document.querySelectorAll('#routine-body tr').forEach((tr, i) => {
      tr.style.animationDelay = `${i * 0.05}s`;
    });
  };
  addRowDelays();
  // Re-apply after table re-render
  document.addEventListener('prayer:resolved', () => setTimeout(addRowDelays, 50));

  // 4. Number counter animation for hero stats
  const animateCounter = (el, target, duration = 1200) => {
    el.classList.add('counting');
    const start = performance.now();
    const step = ts => {
      const p = Math.min(1, (ts - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      el.textContent = Math.round(eased * target);
      if (p < 1) requestAnimationFrame(step);
      else { el.textContent = target; el.classList.add('counted'); }
    };
    requestAnimationFrame(step);
  };

  const statObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const target = parseInt(el.dataset.target || el.textContent, 10);
      if (!isNaN(target)) { el.dataset.target = target; animateCounter(el, target); }
      statObserver.unobserve(el);
    });
  }, { threshold: 0.5 });
  document.querySelectorAll('.stat-num').forEach(el => statObserver.observe(el));

  // 5. Clock flip tick on second change
  const clockEl = document.getElementById('clock-display');
  let lastSec = -1;
  const addTickOnSecond = () => {
    const s = zonedNow().getSeconds();
    if (s !== lastSec && clockEl) {
      lastSec = s;
      clockEl.classList.remove('tick');
      void clockEl.offsetWidth; // reflow to restart animation
      clockEl.classList.add('tick');
    }
    requestAnimationFrame(addTickOnSecond);
  };
  requestAnimationFrame(addTickOnSecond);

  // 6. Button ripple effect
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn');
    if (!btn) return;
    const circle = document.createElement('span');
    circle.classList.add('ripple-circle');
    const rect = btn.getBoundingClientRect();
    circle.style.left = (e.clientX - rect.left) + 'px';
    circle.style.top = (e.clientY - rect.top) + 'px';
    btn.appendChild(circle);
    circle.addEventListener('animationend', () => circle.remove());
  });

  // 7. Parallax-like subtle scroll effect on hero
  const hero = document.getElementById('hero');
  const heroRight = document.querySelector('.hero-right');
  if (hero && heroRight) {
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const scrollY = window.scrollY;
          const heroH = hero.offsetHeight;
          if (scrollY < heroH) {
            const ratio = scrollY / heroH;
            heroRight.style.transform = `translateY(${ratio * 30}px)`;
            heroRight.style.opacity = Math.max(0, 1 - ratio * 0.7);
          }
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }

  // 8. Tilt effect on tool cards (desktop only)
  if (!('ontouchstart' in window)) {
    document.querySelectorAll('.tool-card').forEach(card => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        card.style.transform = `translateY(-8px) perspective(600px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg) scale(1.015)`;
      });
      card.addEventListener('mouseleave', () => {
        card.style.transform = '';
      });
    });
  }

  // 9. Navbar shrink-on-scroll
  const topnav = document.getElementById('topnav');
  if (topnav) {
    let navTicking = false;
    window.addEventListener('scroll', () => {
      if (!navTicking) {
        requestAnimationFrame(() => {
          if (window.scrollY > 60) {
            topnav.style.padding = '0.4rem ' + getComputedStyle(topnav).paddingRight;
            topnav.style.boxShadow = '0 2px 24px rgba(20,55,120,0.2)';
          } else {
            topnav.style.padding = '';
            topnav.style.boxShadow = '';
          }
          navTicking = false;
        });
        navTicking = true;
      }
    }, { passive: true });
  }

  // 10. Magnetic hover for truth cards & keyword cards (desktop)
  if (!('ontouchstart' in window)) {
    document.querySelectorAll('.truth-card, .keyword-card, .micro-step, .growth-list li').forEach(card => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        card.style.transform = `translateY(-4px) perspective(800px) rotateY(${x * 4}deg) rotateX(${-y * 4}deg) scale(1.01)`;
      });
      card.addEventListener('mouseleave', () => {
        card.style.transform = '';
      });
    });
  }

  // 11. Smooth section progress indicator (blue line at top of viewport)
  const progressBar = document.createElement('div');
  progressBar.style.cssText = 'position:fixed;top:0;left:0;height:3px;z-index:1001;' +
    'background:linear-gradient(90deg,#143778,#5383DC,#2D5AAA);' +
    'transition:width 0.15s linear;width:0;pointer-events:none;border-radius:0 2px 2px 0;' +
    'box-shadow:0 0 8px rgba(83,131,220,0.4);';
  document.body.appendChild(progressBar);
  window.addEventListener('scroll', () => {
    const scrollTop = window.scrollY;
    const docH = document.documentElement.scrollHeight - window.innerHeight;
    progressBar.style.width = docH > 0 ? (scrollTop / docH * 100) + '%' : '0%';
  }, { passive: true });

  // 12. Animated section dividers — add wave SVGs between sections
  document.querySelectorAll('.section + .section').forEach(section => {
    const divider = document.createElement('div');
    divider.className = 'wave-divider';
    divider.innerHTML = `<svg viewBox="0 0 1440 60" preserveAspectRatio="none" style="display:block;width:100%;height:40px;">
      <path d="M0,30 C180,60 360,0 540,30 C720,60 900,0 1080,30 C1260,60 1440,0 1440,30 L1440,60 L0,60 Z" fill="var(--primary-light)" opacity="0.5"/>
      <path d="M0,35 C240,10 480,55 720,35 C960,15 1200,50 1440,35 L1440,60 L0,60 Z" fill="var(--bg)" opacity="0.3"/>
    </svg>`;
    divider.style.cssText = 'margin:-1px 0;position:relative;z-index:1;overflow:hidden;line-height:0;';
    section.parentNode.insertBefore(divider, section);
  });

});
