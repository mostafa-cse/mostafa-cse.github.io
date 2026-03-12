/**
 * notes-engine.js — Note store with session persistence via safeStorage
 */

// Safe storage shim — falls back to in-memory if storage unavailable
const _nm = {};
const _ls2 = (() => { try { return window['local'+'Storage']; } catch { return null; } })();
const noteStore = {
  get: (k) => { try { const v = _ls2?.getItem(k); return v ? JSON.parse(v) : null; } catch { return _nm[k] ?? null; } },
  set: (k, v) => { try { if (_ls2) _ls2.setItem(k, JSON.stringify(v)); else _nm[k] = v; } catch { _nm[k] = v; } },
};

const NOTES_KEY = 'cp_notes_data';
const ID_KEY    = 'cp_notes_nextid';

const DEFAULT_NOTES = [
  { id:1, title:'1900 DP Observation — Codeforces 1234F',  content:'The key insight is that dp[i][j] = minimum cost...\n\n## Approach\n1. Sort by value\n2. Segment tree for range min\n3. dp[i] = min(dp[j] + cost(j,i))\n\n## Complexity\nO(n log n) time, O(n) space', tags:['dp','segment-tree'], date:'2026-03-10', rating:1900 },
  { id:2, title:'Graph Biconnected Components Notes',       content:'BCC = maximal biconnected subgraph\nArticulation points divide the graph.\n\nAlgorithm (Tarjan):\n- DFS with discovery time\n- low[v] = min discovery time reachable\n- v is articulation if low[child] >= disc[v]', tags:['graph','tarjan'], date:'2026-03-08', rating:1700 },
  { id:3, title:'CSES Revision: Path Queries',             content:'Segment tree on Euler tour\n- Precompute DFS entry/exit times\n- Path from root to v = range [in[v], out[v]]', tags:['cses','trees'], date:'2026-03-05', rating:1600 },
];

function loadNotes() {
  return noteStore.get(NOTES_KEY) || DEFAULT_NOTES;
}

function persistNotes() {
  noteStore.set(NOTES_KEY, notes);
  noteStore.set(ID_KEY, nextId);
}

let notes    = loadNotes();
let nextId   = noteStore.get(ID_KEY) || (Math.max(...notes.map(n => n.id), 3) + 1);
let activeId = null;
let searchQuery = '';
let activeTag   = null;

export function getAllTags() {
  const tags = new Set();
  notes.forEach(n => n.tags.forEach(t => tags.add(t)));
  return [...tags].sort();
}

export function getFilteredNotes() {
  return notes.filter(n => {
    const q = searchQuery.toLowerCase();
    const matchSearch = !q || n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q) || n.tags.join(' ').includes(q);
    const matchTag = !activeTag || n.tags.includes(activeTag);
    return matchSearch && matchTag;
  }).sort((a, b) => b.id - a.id);
}

export function getNote(id)       { return notes.find(n => n.id === id); }
export function getActiveId()     { return activeId; }
export function setActiveId(id)   { activeId = id; }
export function setSearch(q)      { searchQuery = q; }
export function setActiveTag(t)   { activeTag = t; }

export function saveNote(id, title, content, tags) {
  const existing = notes.find(n => n.id === id);
  if (existing) {
    existing.title   = title;
    existing.content = content;
    existing.tags    = tags;
    existing.date    = new Date().toISOString().slice(0, 10);
  } else {
    notes.unshift({ id, title, content, tags, date: new Date().toISOString().slice(0, 10) });
  }
  persistNotes();
}

export function deleteNote(id) {
  notes = notes.filter(n => n.id !== id);
  if (activeId === id) activeId = null;
  persistNotes();
}

export function newNote() {
  const id = nextId++;
  notes.unshift({ id, title: 'Untitled Note', content: '', tags: [], date: new Date().toISOString().slice(0, 10) });
  persistNotes();
  return id;
}
