/**
 * filters.js — Filter state + apply logic for CF Filter
 */

export const ALL_DIVS    = ['div1','div2','div3','div4','div12','educational','global','other'];
export const ALL_INDICES = ['A','B','C','D','E','F','G','H','I'];

// ── Defaults: only Div.2 + Problem A pre-selected ──────────────────────────
export const DEFAULT_DIV   = 'div2';
export const DEFAULT_INDEX = 'A';

const state = {
  divs:       new Set([DEFAULT_DIV]),
  indices:    new Set([DEFAULT_INDEX]),
  ratingMin:  800,
  ratingMax:  3500,
  search:     '',
  sort:       'newest',
  showSolved: false,
};

let solvedSet  = new Set();
let listeners  = [];

export function getState()              { return state; }
export function getSolvedSet()          { return solvedSet; }
export function setSolvedSet(s)         { solvedSet = s; notify(); }
export function subscribe(fn)           { listeners.push(fn); }
function notify()                       { listeners.forEach(fn => fn()); }

export function updateFilter(key, val)  { state[key] = val; notify(); }

export function toggleSetItem(setKey, val) {
  if (state[setKey].has(val)) state[setKey].delete(val);
  else state[setKey].add(val);
  notify();
}

export function resetFilters() {
  state.divs       = new Set([DEFAULT_DIV]);
  state.indices    = new Set([DEFAULT_INDEX]);
  state.ratingMin  = 800;
  state.ratingMax  = 3500;
  state.search     = '';
  state.sort       = 'newest';
  state.showSolved = false;
  solvedSet        = new Set();
  notify();
}

export function applyFilters(problems, contestMap) {
  let list = problems.filter(p => {
    // Division
    const div = contestMap[p.contestId]?.div || 'other';
    if (!state.divs.has(div)) return false;

    // Index (first character only)
    const idx = p.index ? p.index.charAt(0).toUpperCase() : '';
    if (!state.indices.has(idx)) return false;

    // Rating
    if (p.rating !== null && p.rating !== undefined) {
      if (p.rating < state.ratingMin || p.rating > state.ratingMax) return false;
    }

    // Show solved only
    if (state.showSolved && solvedSet.size > 0) {
      if (!solvedSet.has(`${p.contestId}_${p.index}`)) return false;
    }

    // Search
    if (state.search) {
      const q = state.search.toLowerCase();
      const cName = (contestMap[p.contestId]?.name || '').toLowerCase();
      const tags  = p.tags.join(' ').toLowerCase();
      if (!p.name.toLowerCase().includes(q) &&
          !cName.includes(q) &&
          !tags.includes(q)) return false;
    }

    return true;
  });

  // Sort
  switch (state.sort) {
    case 'oldest':       list.sort((a,b) => (a.contestId||0)-(b.contestId||0)); break;
    case 'newest':       list.sort((a,b) => (b.contestId||0)-(a.contestId||0)); break;
    case 'rating_asc':   list.sort((a,b) => (a.rating||0)-(b.rating||0)); break;
    case 'rating_desc':  list.sort((a,b) => (b.rating||0)-(a.rating||0)); break;
    case 'most_solved':  list.sort((a,b) => b.solveCount-a.solveCount); break;
    case 'least_solved': list.sort((a,b) => a.solveCount-b.solveCount); break;
    default:             list.sort((a,b) => (b.contestId||0)-(a.contestId||0)); break;
  }

  return list;
}
