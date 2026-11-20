// Options and high scores, persisted in localStorage.
import { Action, DEFAULT_BINDINGS, input } from '../engine/input';

export interface Settings {
  difficulty: 0 | 1 | 2;
  players: 1 | 2;
  music: number; // 0..10
  sfx: number; // 0..10
  crt: boolean;
  /** WebGL bloom + post effects */
  bloom: boolean;
  bindings: Record<Action, string[]>;
  levelMode: 'classic' | 'random';
  seed: number;
  screen: 'fill' | 'classic' | 'integer';
  /** true once the player picks a screen mode in Options */
  screenChosen?: boolean;
}
export interface HiScore { name: string; score: number; level: number; seed?: string }

const KEY_S = 'hyperblast.settings', KEY_H = 'hyperblast.hiscores';

export function loadSettings(): Settings {
  const d: Settings = {
    difficulty: 1, players: 1, music: 7, sfx: 8, crt: false, bloom: true, bindings: JSON.parse(JSON.stringify(DEFAULT_BINDINGS)),
    levelMode: 'classic', seed: (Date.now() * 2654435761) >>> 0, screen: 'fill',
  };
  try {
    const s = JSON.parse(localStorage.getItem(KEY_S) || 'null');
    if (s) Object.assign(d, s, { bindings: { ...d.bindings, ...(s.bindings || {}) } });
    // a 'stretch' saved by the old default (not chosen in Options) migrates to the new 'fill' default
    if (s && !s.screenChosen) d.screen = 'fill';
    // 'stretch' was removed: nothing stretches the image any more
    if ((d.screen as string) === 'stretch' || !['fill', 'classic', 'integer'].includes(d.screen)) d.screen = 'fill';
  } catch { /* ignore */ }
  input.bindings = d.bindings;
  return d;
}
export function saveSettings(s: Settings) {
  try { localStorage.setItem(KEY_S, JSON.stringify(s)); } catch { /* ignore */ }
}

const DEFAULT_HI: HiScore[] = [
  ['GRB', 100000], ['ZAX', 80000], ['MEL', 60000], ['ACE', 50000], ['BOB', 40000],
  ['KIT', 30000], ['JAM', 20000], ['RAD', 15000], ['FOO', 10000], ['YOU', 5000],
].map(([name, score]) => ({ name: name as string, score: score as number, level: 1 }));

export function loadHi(): HiScore[] {
  try {
    const h = JSON.parse(localStorage.getItem(KEY_H) || 'null');
    if (Array.isArray(h) && h.length) return h;
  } catch { /* ignore */ }
  return DEFAULT_HI.slice();
}
export function saveHi(h: HiScore[]) {
  try { localStorage.setItem(KEY_H, JSON.stringify(h)); } catch { /* ignore */ }
}
export function qualifies(score: number) {
  const h = loadHi();
  return score > 0 && (h.length < 10 || score > h[h.length - 1].score);
}
export function insertHi(e: HiScore) {
  const h = loadHi();
  h.push(e);
  h.sort((a, b) => b.score - a.score);
  saveHi(h.slice(0, 10));
}

// ---------------------------------------------------------------- run save (Continue)
/** Everything needed to resume a run at the start of the current checkpoint. */
export interface RunSave {
  v: 1;
  at: number;
  cur: number;
  difficulty: 0 | 1 | 2;
  levelMode: 'classic' | 'random';
  seed: number;
  regenOffset: number;
  players: Record<string, unknown>[];
}
const KEY_R = 'hyperblast.run';
export function saveRun(r: RunSave) {
  try { localStorage.setItem(KEY_R, JSON.stringify(r)); } catch { /* ignore */ }
}
export function loadRun(): RunSave | null {
  try {
    const r = JSON.parse(localStorage.getItem(KEY_R) || 'null');
    return r && r.v === 1 && Array.isArray(r.players) && r.players.length ? r : null;
  } catch { return null; }
}
export function clearRun() {
  try { localStorage.removeItem(KEY_R); } catch { /* ignore */ }
}
