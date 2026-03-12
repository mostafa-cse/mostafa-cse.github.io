/**
 * prayer.js
 * Fetches prayer times from Aladhan API.
 * - Uses GPS first, then IP-based location, then hardcoded Bogura BD fallback
 * - Method 1 = University of Islamic Sciences Karachi (appropriate for Bangladesh)
 * - Method 2 = ISNA (North America — NOT appropriate, removed)
 * - Exports: initPrayer(), getPrayerTimes(), getNextPrayer(), updateActivePrayer()
 */

const PRAYER_NAMES    = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
const BOGURA_FALLBACK = { lat: 24.8465, lon: 89.3776 }; // Bogura, Bangladesh

// Calculation method 1 = Karachi (Muslim World League South Asia variant)
// Method 4 = Umm Al-Qura — used widely in BD as well
// We'll use method=1 (Karachi) which is standard for Bangladesh
const ALADHAN_METHOD = 1;

let prayerTimes = null; // { Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha } "HH:MM"
let lastFetchDate = null;

// ─── Coordinate detection ─────────────────────────────────────────────────────

async function getCoords() {
  // 1. GPS (most accurate)
  try {
    const pos = await new Promise((res, rej) =>
      navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 })
    );
    return { lat: pos.coords.latitude, lon: pos.coords.longitude };
  } catch {}

  // 2. ipwho.is
  try {
    const r = await fetch('https://ipwho.is/', { signal: AbortSignal.timeout(4000) });
    const d = await r.json();
    if (d.latitude) return { lat: d.latitude, lon: d.longitude };
  } catch {}

  // 3. ipinfo.io
  try {
    const r = await fetch('https://ipinfo.io/json', { signal: AbortSignal.timeout(4000) });
    const d = await r.json();
    if (d.loc) {
      const [lat, lon] = d.loc.split(',').map(Number);
      return { lat, lon };
    }
  } catch {}

  // 4. ip-api.com
  try {
    const r = await fetch('https://ip-api.com/json', { signal: AbortSignal.timeout(4000) });
    const d = await r.json();
    if (d.lat) return { lat: d.lat, lon: d.lon };
  } catch {}

  return BOGURA_FALLBACK;
}

// ─── Aladhan API ──────────────────────────────────────────────────────────────

async function fetchAladhan(lat, lon) {
  const today = new Date();
  const date  = `${String(today.getDate()).padStart(2,'0')}-${String(today.getMonth()+1).padStart(2,'0')}-${today.getFullYear()}`;
  // method=1: Karachi (standard for BD/Pakistan/South Asia)
  // school=1: Hanafi (standard in Bangladesh)
  const url = `https://api.aladhan.com/v1/timings/${date}?latitude=${lat}&longitude=${lon}&method=${ALADHAN_METHOD}&school=1`;

  const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
  const d = await r.json();

  if (d.code === 200 && d.data?.timings) {
    const t = d.data.timings;
    return {
      Fajr:    stripSuffix(t.Fajr),
      Sunrise: stripSuffix(t.Sunrise),
      Dhuhr:   stripSuffix(t.Dhuhr),
      Asr:     stripSuffix(t.Asr),
      Maghrib: stripSuffix(t.Maghrib),
      Isha:    stripSuffix(t.Isha),
    };
  }
  throw new Error('Aladhan API error: ' + JSON.stringify(d));
}

// Aladhan sometimes returns "05:10 (BST)" — strip the suffix
function stripSuffix(t) {
  return (t || '').split(' ')[0].slice(0, 5);
}

// ─── Init ─────────────────────────────────────────────────────────────────────

export async function initPrayer() {
  const todayStr = new Date().toDateString();

  // Don't re-fetch if already done today
  if (prayerTimes && lastFetchDate === todayStr) {
    renderPrayerPills();
    return prayerTimes;
  }

  try {
    const { lat, lon } = await getCoords();
    prayerTimes = await fetchAladhan(lat, lon);
    lastFetchDate = todayStr;
  } catch (err) {
    console.warn('Prayer fetch failed, using Bogura fallback:', err);
    // Hardcoded Bogura approximate times (UTC+6)
    prayerTimes = {
      Fajr:    '05:10',
      Sunrise: '06:30',
      Dhuhr:   '11:55',
      Asr:     '15:25',
      Maghrib: '17:55',
      Isha:    '19:15',
    };
  }

  renderPrayerPills();
  updateActivePrayer();
  return prayerTimes;
}

export function getPrayerTimes() { return prayerTimes; }

// ─── Next prayer ──────────────────────────────────────────────────────────────

export function getNextPrayer() {
  if (!prayerTimes) return null;
  const now    = new Date();
  const nowM   = now.getHours() * 60 + now.getMinutes();

  for (const name of ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']) {
    const t = prayerTimes[name];
    if (!t) continue;
    const [h, m] = t.split(':').map(Number);
    if (h * 60 + m > nowM) return { name, time: t };
  }
  // Wrapped past Isha — next is Fajr tomorrow
  return { name: 'Fajr', time: prayerTimes.Fajr };
}

// ─── Render pills ─────────────────────────────────────────────────────────────

function renderPrayerPills() {
  const container = document.getElementById('prayer-pills');
  if (!container || !prayerTimes) return;

  container.innerHTML = '';
  const SHOW = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

  for (const name of SHOW) {
    const t    = prayerTimes[name];
    if (!t) continue;

    // Convert HH:MM (24h) to 12h display
    const [h, m]  = t.split(':').map(Number);
    const ampm    = h >= 12 ? 'PM' : 'AM';
    const h12     = h % 12 || 12;
    const display = `${h12}:${String(m).padStart(2,'0')} ${ampm}`;

    const pill = document.createElement('span');
    pill.className = 'prayer-pill';
    pill.setAttribute('data-prayer', name);
    pill.innerHTML = `<span class="prayer-pill-name">${name}</span><span class="prayer-pill-time">${display}</span>`;
    container.appendChild(pill);
  }

  updateActivePrayer();
}

// ─── Highlight active prayer ──────────────────────────────────────────────────

export function updateActivePrayer() {
  if (!prayerTimes) return;
  const next = getNextPrayer();
  document.querySelectorAll('.prayer-pill').forEach(p => {
    p.classList.toggle('active', p.dataset.prayer === next?.name);
  });

  // Update the fixed prayer widget with next prayer info
  const widget = document.getElementById('prayer-widget');
  if (widget && next) {
    const nameEl = widget.querySelector('.pw-name');
    const subEl  = widget.querySelector('.pw-sub');
    if (nameEl) nameEl.textContent = `Next: ${next.name}`;
    if (subEl)  subEl.textContent  = `at ${next.time}`;
  }
}
