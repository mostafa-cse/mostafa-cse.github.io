/**
 * alarm.js
 * Web Audio API alarm system for the CP Routine page
 * Exports: initAlarm(), checkAlarms(currentBlock, nextBlock), playSound(type)
 */

let audioCtx = null;
let masterEnabled = true;
let volume = 0.6;

const ALARM_CONFIG = {
  practice: { enabled: true, label: 'Practice Start' },
  break:    { enabled: true, label: 'Break Start' },
  prayer:   { enabled: true, label: 'Prayer Time' },
  contest:  { enabled: true, label: 'Contest Start' },
  dayEnd:   { enabled: true, label: 'Day End' },
  warning:  { enabled: true, label: '5-min Warning' },
};

function getCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playBeep(frequency, duration, type = 'sine', fadeOut = true) {
  const ctx  = getCtx();
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type      = type;
  osc.frequency.setValueAtTime(frequency, ctx.currentTime);
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  if (fadeOut) gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

export function playSound(type) {
  if (!masterEnabled) return;
  if (!ALARM_CONFIG[type]?.enabled) return;
  switch (type) {
    case 'practice':
      // Sharp double beep
      playBeep(880, 0.12, 'square');
      setTimeout(() => playBeep(1100, 0.12, 'square'), 180);
      break;
    case 'break':
      // Soft rising chime
      playBeep(523, 0.4, 'sine');
      setTimeout(() => playBeep(659, 0.4, 'sine'), 250);
      setTimeout(() => playBeep(784, 0.6, 'sine'), 500);
      break;
    case 'prayer':
      // Gentle melodic sequence (azan-inspired)
      [440, 494, 523, 587, 659, 587, 523].forEach((f, i) => {
        setTimeout(() => playBeep(f, 0.35, 'sine'), i * 280);
      });
      break;
    case 'contest':
      // Energetic ascending arpeggio
      [523, 659, 784, 1047].forEach((f, i) => {
        setTimeout(() => playBeep(f, 0.15, 'sawtooth'), i * 100);
      });
      setTimeout(() => playBeep(1047, 0.5, 'sine'), 450);
      break;
    case 'dayEnd':
      // Calm descending resolution
      [784, 659, 523, 392].forEach((f, i) => {
        setTimeout(() => playBeep(f, 0.5, 'sine'), i * 350);
      });
      break;
    case 'warning':
      // Single attention ping
      playBeep(660, 0.08, 'square');
      setTimeout(() => playBeep(660, 0.08, 'square'), 150);
      setTimeout(() => playBeep(880, 0.2, 'square'), 300);
      break;
  }
}

// Track which blocks have already triggered alarms this session
const triggered = new Set();
let warningTriggered = new Set();

export function checkAlarms(currentBlock, nextBlock, minsRemaining) {
  if (!currentBlock) return;
  // Block start alarm
  const key = `start_${currentBlock.id}`;
  if (!triggered.has(key)) {
    triggered.add(key);
    playSound(currentBlock.type);
    if (currentBlock.type === 'prayer') {
      showPrayerWidget(currentBlock.activity);
    }
  }
  // 5-min warning for next block
  if (nextBlock && minsRemaining === 5) {
    const wKey = `warn_${currentBlock.id}`;
    if (!warningTriggered.has(wKey)) {
      warningTriggered.add(wKey);
      playSound('warning');
      showToast(`⚠ 5 min left — ${nextBlock.activity} starts soon`);
    }
  }
}

function showToast(msg) {
  const toast = document.getElementById('routine-toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 4000);
}

function showPrayerWidget(name) {
  const w = document.getElementById('prayer-widget');
  if (!w) return;
  w.querySelector('.pw-name').textContent = name;
  w.classList.add('active');
  setTimeout(() => w.classList.remove('active'), 8000);
}

export function initAlarm() {
  renderAlarmPanel();
  bindAlarmEvents();
}

function renderAlarmPanel() {
  const panel = document.getElementById('alarm-panel');
  if (!panel) return;
  panel.innerHTML = `
    <div class="ap-header">
      <span>🔔 Alarm Settings</span>
      <button class="ap-close" id="alarm-close" aria-label="Close">✕</button>
    </div>
    <div class="ap-master">
      <label class="ap-toggle-label">
        <span>Master Alarm</span>
        <label class="toggle-switch">
          <input type="checkbox" id="alarm-master" ${masterEnabled ? 'checked' : ''}>
          <span class="ts-slider"></span>
        </label>
      </label>
    </div>
    <div class="ap-volume">
      <label>Volume</label>
      <input type="range" id="alarm-volume" min="0" max="1" step="0.05" value="${volume}">
      <span id="alarm-volume-val">${Math.round(volume * 100)}%</span>
    </div>
    <div class="ap-section-label">Individual Alarms</div>
    <div class="ap-items">
      ${Object.entries(ALARM_CONFIG).map(([key, cfg]) => `
        <div class="ap-item">
          <span>${cfg.label}</span>
          <div class="ap-item-right">
            <button class="ap-test" data-type="${key}">Test</button>
            <label class="toggle-switch">
              <input type="checkbox" class="alarm-individual" data-key="${key}" ${cfg.enabled ? 'checked' : ''}>
              <span class="ts-slider"></span>
            </label>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function bindAlarmEvents() {
  document.getElementById('alarm-master')?.addEventListener('change', e => {
    masterEnabled = e.target.checked;
  });
  document.getElementById('alarm-volume')?.addEventListener('input', e => {
    volume = parseFloat(e.target.value);
    document.getElementById('alarm-volume-val').textContent = Math.round(volume * 100) + '%';
  });
  document.querySelectorAll('.alarm-individual').forEach(cb => {
    cb.addEventListener('change', e => {
      ALARM_CONFIG[e.target.dataset.key].enabled = e.target.checked;
    });
  });
  document.querySelectorAll('.ap-test').forEach(btn => {
    btn.addEventListener('click', () => playSound(btn.dataset.type));
  });
  document.getElementById('alarm-close')?.addEventListener('click', () => {
    document.getElementById('alarm-panel').classList.remove('open');
  });
}

export function toggleAlarmPanel() {
  const panel = document.getElementById('alarm-panel');
  if (panel) panel.classList.toggle('open');
}
