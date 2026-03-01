# CP Routine — Live Website

A single-page competitive programming schedule with live Three.js 3D background,
prayer-time widget, geolocation-based Azan reminders, and real-time routine tracking.

## Local Preview

```bash
python3 -m http.server 8765 --directory website/
# Open → http://localhost:8765
```

## Deploy (choose one option)

---

### Option A — GitHub Pages (free, permanent URL)

```bash
# 1. Install git (one-time)
sudo apt install git -y

# 2. Configure your identity (one-time)
git config --global user.name  "Your Name"
git config --global user.email "you@example.com"

# 3. Create repo on GitHub:
#    → https://github.com/new  →  name: cp-routine  →  Public  →  Create

# 4. Initialize and push from this folder
cd /home/m0stafa/Desktop/Routine/website
git init
git add .
git commit -m "Initial deploy: CP Routine website"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/cp-routine.git
git push -u origin main

# 5. Enable Pages:
#    GitHub → repo → Settings → Pages
#    Source: "Deploy from branch" → main / (root) → Save
#
# 6. Wait ~60 s → live at:
#    https://YOUR_USERNAME.github.io/cp-routine/
```

---

### Option B — Netlify Drop (instant, no account needed)

1. Go to **https://netlify.com/drop** in your browser
2. Open your file manager to `/home/m0stafa/Desktop/Routine/website/`
3. Drag the **entire `website` folder** onto the Netlify Drop page
4. Done — instant URL like `https://random-name.netlify.app`
5. Create a free account to get a custom subdomain

---

### Option C — Vercel CLI

```bash
# Install Node.js first if not present
sudo apt install nodejs npm -y
npm i -g vercel

# Deploy
cd /home/m0stafa/Desktop/Routine/website
vercel
# Follow the prompts — live in < 30 seconds
```

---

## File Structure

```
website/
├── index.html          ← Single-page app structure
├── style.css           ← Theme variables, layout, responsive
├── app.js              ← All 10 classes (Three.js, prayer watch, alarms…)
└── data/
    ├── ramadan.js      ← Ramadan routine + content blocks
    └── general.js      ← General (non-Ramadan) routine
```

## Updating Ramadan Dates Each Year

The site auto-detects Ramadan via the Aladhan API. The fallback constants in
`data/ramadan.js` only matter when offline. No manual update needed in normal use.

If you want to update the offline fallback:
```js
// in data/ramadan.js:
window.RAMADAN_START = "2027-02-18";  // next Ramadan example
window.RAMADAN_END   = "2027-03-19";
```

## Features

- **Three.js 3D hero** — gold stars + octagram rings + crescent (Ramadan) / particles + icosahedra + glyphs (General)
- **3D prayer watch** — analogue clock with prayer-arc, next prayer countdown
- **Live routine timeline** — active row highlighted, progress bar, "You are here" pill
- **Geolocation prayer times** — Aladhan API, localStorage cache, graceful fallback
- **10-tone alarm system** — 5 Azan tones + 5 routine tones, all Web Audio (no files)
- **Ramadan countdowns** — Suhoor / Iftar live timers (hidden in General mode)
- **Stopwatch** — HH:MM:SS.cc with lap table
- **Countdown timer** — SVG ring, presets, localStorage restore
- **Dark mode** — toggle, persisted
- **Responsive** — mobile-first below 768 px
