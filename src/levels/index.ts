import { level1 } from './level1';
import { level2 } from './level2';
import { level3 } from './level3';
import { level4 } from './level4';
import { level5 } from './level5';
import { generateLevel, setClassicThemes } from './generator';
import type { LevelDef } from '../game/types';

export const HAND_LEVELS: (() => LevelDef)[] = [level1, level2, level3, level4, level5];
export const LEVEL_COUNT = 15;
/** Seed for the official levels 6–15 in Classic mode (same for everyone). */
export const OFFICIAL_SEED = 0x5eed2026;
export type LevelMode = 'classic' | 'random';

let themesReady = false;
function ensureClassicThemes() {
  if (themesReady) return;
  themesReady = true;
  setClassicThemes(HAND_LEVELS.map((f, i) => {
    const l = f();
    return { name: l.name, theme: l.theme, music: l.music, semis: 0, bpm: i * 2 };
  }));
}

/** Build level `i` (0-based) for the given mode/seed. */
export function buildLevel(i: number, mode: LevelMode, seed: number): LevelDef {
  ensureClassicThemes();
  if (mode === 'classic' && i < HAND_LEVELS.length) return HAND_LEVELS[i]();
  return generateLevel(i, mode === 'classic' ? OFFICIAL_SEED : seed, mode === 'random');
}

export const hexSeed = (s: number) => (s >>> 0).toString(16).toUpperCase().padStart(8, '0');
