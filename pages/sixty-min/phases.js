/**
 * phases.js
 * Defines the 6 phases of the 60-minute rule
 */

export const PHASES = [
  { id: 'recon',     label: 'Reconnaissance',    from: 0,  to: 5,  color: '#4FC3F7', emoji: '🔍', desc: 'Read the problem carefully. Understand constraints and examples.' },
  { id: 'observe',   label: 'Observation',        from: 5,  to: 25, color: '#81C784', emoji: '🧠', desc: 'Look for patterns. Think of brute force. Identify the algorithm family.' },
  { id: 'attack',    label: 'Attack It',          from: 25, to: 35, color: '#FFD54F', emoji: '⚔️', desc: 'Form your solution. Verify with examples. Plan your implementation.' },
  { id: 'code',      label: 'Code It',            from: 35, to: 45, color: '#FF8A65', emoji: '💻', desc: 'Write clean, efficient code. Handle edge cases.' },
  { id: 'struggle',  label: 'The Struggle',       from: 45, to: 60, color: '#E57373', emoji: '🔥', desc: 'Debug, optimize, and push through. Every minute counts.' },
  { id: 'editorial', label: 'Editorial Protocol', from: 60, to: Infinity, color: '#B0BEC5', emoji: '📖', desc: 'Read the editorial. Understand deeply. Implement the solution correctly.' },
];

export const QUOTES = [
  "The struggle itself toward the heights is enough to fill a human heart. — Camus",
  "I am not afraid of storms, for I am learning how to sail my ship. — Alcott",
  "Every expert was once a beginner. Consistency builds champions.",
  "The only way to do great work is to love what you do. — Jobs",
  "Hard problems build strong coders. Keep pushing.",
  "Debugging is twice as hard as writing code. — Kernighan",
  "Code is like humor. When you have to explain it, it's bad. — Fowler",
  "First, solve the problem. Then, write the code. — Johnson",
  "The best programmers are not marginally better, they are fundamentally better.",
  "Competitive programming: where elegance meets performance.",
  "A good algorithm is your sword. Practice is your whetstone.",
  "60 minutes of struggle beats 60 seconds of reading editorial.",
];

/**
 * Get current phase based on elapsed seconds
 */
export function getPhase(elapsedSecs) {
  const mins = elapsedSecs / 60;
  for (let i = PHASES.length - 1; i >= 0; i--) {
    if (mins >= PHASES[i].from) return PHASES[i];
  }
  return PHASES[0];
}

/**
 * Get phase index
 */
export function getPhaseIndex(elapsedSecs) {
  const mins = elapsedSecs / 60;
  for (let i = PHASES.length - 1; i >= 0; i--) {
    if (mins >= PHASES[i].from) return i;
  }
  return 0;
}

/**
 * Format seconds → MM:SS
 */
export function fmtTime(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}
