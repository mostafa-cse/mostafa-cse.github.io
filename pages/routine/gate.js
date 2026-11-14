/* gate.js — Passphrase gate for the routine page.
 *
 * ── READ THIS BEFORE TRUSTING IT ──────────────────────────────────────────
 * This is a DETERRENT, not access control. The site is a static GitHub Pages
 * deployment, so routine.html, every script it loads, and the whole repo are
 * publicly readable. Anyone who opens devtools, disables JavaScript, views
 * source, or reads the repository can see the page without the passphrase.
 *
 * It is good for: keeping the page out of the way of casual visitors.
 * It is NOT good for: anything you actually need to keep private. That needs
 * a private repo plus a host that does real auth (Netlify password protection,
 * Cloudflare Access, or a server).
 *
 * The passphrase itself is never stored — only a PBKDF2-SHA256 verifier, so
 * reading this file does not hand over the passphrase.
 *
 * ── CHANGING THE PASSPHRASE ───────────────────────────────────────────────
 * Run this and paste the result into CONFIG.verifier (your passphrase never
 * leaves your machine and never enters the repo):
 *
 *   node -e "const c=require('crypto');const pw=process.argv[1];
 *   console.log(c.pbkdf2Sync(pw,Buffer.from('mk-routine-v1','utf8'),150000,32,'sha256').toString('hex'))" 'your passphrase'
 */

(function () {
  'use strict';

  const CONFIG = {
    salt:       'mk-routine-v1',
    iterations: 150000,
    // Default passphrase: "routine2026" — CHANGE THIS (see the note above).
    verifier:   '33c7cece406a529dd4c34c83427950579232d4216927a740c96e1095632d3886',
    storageKey: 'routine_unlocked_until',
    rememberDays: 30,
    sessionHours: 12,
  };

  const root = document.documentElement;

  // ── Restore a previous unlock before first paint ────────────────────────
  function storedUnlockValid() {
    for (const store of [sessionStorage, localStorage]) {
      try {
        const until = Number(store.getItem(CONFIG.storageKey));
        if (until && Date.now() < until) return true;
        if (until) store.removeItem(CONFIG.storageKey);   // expired
      } catch { /* storage blocked — just show the gate */ }
    }
    return false;
  }

  if (storedUnlockValid()) root.classList.remove('is-locked');

  // Nothing else to do if the page is already open
  if (!root.classList.contains('is-locked')) return;

  // ── Verify ──────────────────────────────────────────────────────────────
  async function verify(passphrase) {
    const subtle = window.crypto && window.crypto.subtle;
    if (!subtle) throw new Error('insecure-context');

    const enc = new TextEncoder();
    const key = await subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveBits']);
    const bits = await subtle.deriveBits({
      name: 'PBKDF2',
      salt: enc.encode(CONFIG.salt),
      iterations: CONFIG.iterations,
      hash: 'SHA-256',
    }, key, 256);

    const hex = [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, '0')).join('');
    return hex === CONFIG.verifier;
  }

  function unlock(remember) {
    const ms = remember
      ? CONFIG.rememberDays * 24 * 60 * 60 * 1000
      : CONFIG.sessionHours * 60 * 60 * 1000;
    try {
      (remember ? localStorage : sessionStorage).setItem(CONFIG.storageKey, String(Date.now() + ms));
    } catch { /* storage blocked — unlock lasts for this page view only */ }

    root.classList.remove('is-locked');
    document.dispatchEvent(new CustomEvent('routine-unlocked'));
  }

  // ── Wire the form ───────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    const gate     = document.getElementById('routine-gate');
    const form     = document.getElementById('gate-form');
    const input    = document.getElementById('gate-input');
    const remember = document.getElementById('gate-remember');
    const error    = document.getElementById('gate-error');
    const submit   = document.getElementById('gate-submit');
    if (!gate || !form || !input) return;

    let attempts = 0;
    let lockedUntil = 0;

    input.focus();

    const fail = (message) => {
      error.textContent = message;
      gate.classList.add('is-wrong');
      setTimeout(() => gate.classList.remove('is-wrong'), 500);
      input.select();
    };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (Date.now() < lockedUntil) {
        return fail(`Too many attempts — wait ${Math.ceil((lockedUntil - Date.now()) / 1000)}s.`);
      }
      if (!input.value) return fail('Enter the passphrase.');

      submit.disabled = true;
      submit.dataset.busy = 'true';
      error.textContent = '';

      let ok = false;
      try {
        ok = await verify(input.value);
      } catch (err) {
        submit.disabled = false;
        delete submit.dataset.busy;
        return fail(err.message === 'insecure-context'
          ? 'Needs HTTPS (or localhost) to check the passphrase.'
          : 'Could not verify — try again.');
      }

      submit.disabled = false;
      delete submit.dataset.busy;

      if (!ok) {
        attempts += 1;
        // Escalating pause — slows down guessing without locking anyone out
        if (attempts % 5 === 0) lockedUntil = Date.now() + 30000;
        return fail('That passphrase is not right.');
      }

      input.value = '';
      gate.classList.add('is-open');
      setTimeout(() => unlock(remember && remember.checked), 220);
    });

    // Clear the error as soon as they start correcting it
    input.addEventListener('input', () => { error.textContent = ''; });
  });

})();
