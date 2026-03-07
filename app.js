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

  // 8. Request notification permission
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }

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

  // 11. (Theme is fully automatic via detectRamadan() — no manual toggle needed)

  // 12. Dark mode toggle
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

  if (pwCollapse && pwCard) {
    const savedCollapsed = localStorage.getItem('pw_collapsed') === '1';
    // Hand off from the pre-paint data attribute to JS class control
    document.documentElement.removeAttribute('data-pw-collapsed');
    setPWCollapsed(savedCollapsed);
    pwCollapse.addEventListener('click', () => setPWCollapsed(true));
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
  });

  // 14. Prayer FAB (mobile)
  const fab = document.getElementById('prayer-fab');
  if (fab && pwCard) {
    fab.addEventListener('click', () => {
      pwCard.classList.toggle('mobile-open');
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


  // -- Mobile hamburger --
  (function() {
    var hamburger = document.getElementById('nav-hamburger');
    var navLinks  = document.getElementById('nav-links');
    if (!hamburger || !navLinks) return;
    hamburger.addEventListener('click', function() {
      var isOpen = navLinks.classList.toggle('open');
      hamburger.classList.toggle('open', isOpen);
      hamburger.setAttribute('aria-expanded', String(isOpen));
    });
    navLinks.querySelectorAll('a').forEach(function(link) {
      link.addEventListener('click', function() {
        navLinks.classList.remove('open');
        hamburger.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
      });
    });
    document.addEventListener('click', function(e) {
      if (!hamburger.contains(e.target) && !navLinks.contains(e.target)) {
        navLinks.classList.remove('open');
        hamburger.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
      }
    });
  })();

  // -- Alarm panel backdrop --
  (function() {
    var panel    = document.getElementById('alarm-panel');
    var backdrop = document.getElementById('alarm-backdrop');
    var openBtn  = document.getElementById('alarm-toggle-btn');
    var closeBtn = document.getElementById('alarm-panel-close');
    function openPanel()  { if (!panel) return; panel.classList.add('open');    panel.setAttribute('aria-hidden','false'); if (backdrop) backdrop.classList.add('active'); }
    function closePanel() { if (!panel) return; panel.classList.remove('open'); panel.setAttribute('aria-hidden','true');  if (backdrop) backdrop.classList.remove('active'); }
    if (openBtn)  openBtn.addEventListener('click',  openPanel);
    if (closeBtn) closeBtn.addEventListener('click', closePanel);
    if (backdrop) backdrop.addEventListener('click', closePanel);
    document.addEventListener('keydown', function(e) { if (e.key === 'Escape') closePanel(); });
  })();

  // -- Mode badge --
  (function() {
    function updateModeBadge() {
      var badge = document.getElementById('mode-badge');
      if (!badge) return;
      var theme = document.documentElement.getAttribute('data-theme') || 'general';
      badge.textContent = theme.charAt(0).toUpperCase() + theme.slice(1);
      badge.style.background = theme === 'ramadan' ? 'rgba(255,200,100,0.25)' : 'rgba(255,255,255,0.18)';
    }
    updateModeBadge();
    new MutationObserver(updateModeBadge).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  })();

  // -- Footer year --
  (function() { var el = document.getElementById('footer-year'); if (el) el.textContent = new Date().getFullYear(); })();
});

/* ── Mobile menu toggle ── */
(function () {
  const hamburger = document.getElementById('nav-hamburger');
  const links     = document.getElementById('nav-links');
  const overlay   = document.getElementById('nav-mobile-overlay');
  if (!hamburger || !links) return;

  function closeMenu() {
    links.classList.remove('mobile-open');
    if (overlay) overlay.classList.remove('open');
  }
  hamburger.addEventListener('click', e => {
    e.stopPropagation();
    const open = links.classList.toggle('mobile-open');
    if (overlay) overlay.classList.toggle('open', open);
  });
  links.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));
  if (overlay) overlay.addEventListener('click', closeMenu);
  document.addEventListener('keydown', e => e.key === 'Escape' && closeMenu());
})();

/* ── Alarm panel: Escape key + backdrop ── */
(function () {
  const panel   = document.getElementById('alarm-panel');
  const closePanel = () => panel && panel.classList.remove('open');
  document.addEventListener('keydown', e => e.key === 'Escape' && closePanel());
})();
