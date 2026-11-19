import type { RGB } from '../engine/gfx';

export const W = 320, H = 256, TILE = 16, COLS = 20;
export const TICKS = 50;

export type TexKind = 'coral' | 'bone' | 'vine' | 'biomech' | 'metal' | 'crystal' | 'lava';
export type Ambient = 'bubbles' | 'dust' | 'spores' | 'embers' | 'stars';

export interface Theme {
  rock: RGB[];
  alt: RGB[];
  bg: [string, string, string]; // gradient top / mid / bottom
  far: RGB[]; // distant silhouette ramp
  wobble: number;
  tex: TexKind;
  ambient: Ambient;
  ambientColor: string;
}

export type SpawnKind = 'wave' | 'one' | 'wall' | 'cap';
export interface SpawnDef {
  at: number; // scroll position (px) at which the spawn triggers
  kind: SpawnKind;
  type: string; // enemy type
  x: number;
  n?: number;
  gap?: number;
  pat?: string;
  p?: Record<string, number>;
  row?: number; // world-attached spawns: bottom-based tile row
  token?: string;
}

export interface LevelDef {
  idx: number;
  name: string;
  theme: Theme;
  rows: Uint8Array[]; // bottom-first
  spawns: SpawnDef[];
  checkpoints: number[]; // scroll positions (6)
  midBoss?: { at: number; boss: string };
  endBoss: { at: number; boss: string };
  shopAt: number; // halfway shop scroll position (after midboss for L2+)
  speed: number;
  music: string;
}
