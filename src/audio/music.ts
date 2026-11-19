// Original sequenced music data. 16 steps per bar; sections change every 4 bars.
// Note chars index into '0123456789abcdefghij...' = semitones above the bar root. '-' holds, '.' rests.
export interface DrumPat { k: string; s: string; h: string }
export interface Track {
  bpm: number; swing?: number; root: number; minor?: boolean; acid?: boolean;
  prog: number[]; sections: number[];
  drums: DrumPat[]; fill?: DrumPat;
  bass: string[]; stab?: string[]; lead?: string[]; leadWave?: OscillatorType;
}

const BREAK: DrumPat = { k: 'x.....x..x......', s: '....X.......X...', h: 'x.x.x.x.x.x.x.xo' };
const BREAK2: DrumPat = { k: 'x.x...x...x.....', s: '....X.....x.X..x', h: 'x.xxx.x.x.xxx.x.' };
const HOUSE: DrumPat = { k: 'x...x...x...x...', s: '....X.......X...', h: '..o...o...o...o.' };
const HOUSE2: DrumPat = { k: 'x...x...x...x..x', s: '....X..x....X...', h: 'xxoxxxoxxxoxxxox' };
const SPARSE: DrumPat = { k: 'x.........x.....', s: '........X.......', h: 'x...x...x...x...' };
const FILL: DrumPat = { k: 'x.....x.x.......', s: '....X...X.XXXXXX', h: 'x.x.x.x.........' };

/** Register (once) a transposed / re-tempo'd copy of a track and return its name. */
export function transposeTrack(base: string, semis: number, bpmDelta: number): string {
  const name = `${base}^${semis}^${bpmDelta}`;
  if (!TRACKS[name]) TRACKS[name] = { ...TRACKS[base], root: TRACKS[base].root + semis, bpm: TRACKS[base].bpm + bpmDelta };
  return name;
}

export const TRACKS: Record<string, Track> = {
  title: {
    bpm: 118, swing: 0.08, root: 45, minor: true, prog: [0, 0, 3, 5], sections: [0, 1, 1, 2],
    drums: [SPARSE, BREAK, BREAK2], fill: FILL,
    bass: ['0..0..c.0..0.a.7', '0.0c..0.0..a.7.5', '0..07..0c.a.7.5.'],
    stab: ['x.....x.........', '......x.....x...', 'x.....x...x.....'],
    lead: ['................................', 'c---a---7---a-c-f---------c-----', 'j---h-f-c---a-c-f---h---j-------'],
  },
  level1: {
    bpm: 120, swing: 0.06, root: 40, minor: true, prog: [0, 0, 5, 3], sections: [0, 1, 1, 2],
    drums: [BREAK, BREAK2, HOUSE], fill: FILL,
    bass: ['0.0..0c.0.0..a7.', '0..0..0.c.0..7.a', '00c.00c.00c.a.7.'],
    stab: ['', '......x.......x.', 'x..x..x.........'],
    lead: ['................................', '7-a-c---a-7-5---7-a-c-f-c-------', 'c.c.f.c.a.7.a.c.7---------------'],
  },
  level2: {
    bpm: 112, swing: 0.1, root: 38, minor: true, prog: [0, 1, 0, -2], sections: [0, 0, 1, 2],
    drums: [BREAK2, BREAK, SPARSE], fill: FILL,
    bass: ['0...0..1..0...6.', '0.c.0..1..0.c.6.', '0-----1-----0---'],
    stab: ['x...............', '....x.......x...', ''],
    lead: ['................................', '6---5---3---1---0-----------....', 'c-b-c-f-c-b-6---c---------------'],
    leadWave: 'triangle',
  },
  level3: {
    bpm: 126, root: 43, minor: true, acid: true, prog: [0, 0, 0, 5], sections: [0, 1, 1, 2],
    drums: [HOUSE, HOUSE2, BREAK], fill: FILL,
    bass: ['0c0.0c0.0c0.ac0.', '0.c0.c0.c0.c5.7.', '0c3c5c7cac7c5c3c'],
    stab: ['', 'x.......x.......', '..x...x...x...x.'],
    lead: ['................................', 'c...c...a...7...c...f...c.......', 'f-c-a-c-f-h-j---h-f-c-----------'],
  },
  level4: {
    bpm: 116, swing: 0.04, root: 36, minor: true, acid: true, prog: [0, 3, 0, 6], sections: [0, 1, 2, 1],
    drums: [BREAK2, HOUSE2, BREAK], fill: FILL,
    bass: ['0.00.0.00.0.6.5.', '0c0c0c0c3f3f6i5h', '0...0.c.0...6.5.'],
    stab: ['x.....x.....x...', 'x.x...........x.', '....x.......x...'],
    lead: ['................................', 'c-----b-----6-----5---3---------', 'o-n-l-j-i-g-f-c-----------------'],
  },
  level5: {
    bpm: 130, root: 41, minor: true, acid: true, prog: [0, 0, 3, 5, 0, 0, 7, 5], sections: [0, 1, 2, 1],
    drums: [HOUSE2, BREAK2, HOUSE], fill: FILL,
    bass: ['0c0c0c0c0c0cac7c', '00c00c00c00ca.7.', '0.c.0.c.3.f.5.h.'],
    stab: ['x...x...x...x...', '..x...x...x...x.', 'x.x.x.x.........'],
    lead: ['................................', 'j-h-f-c-f-h-j-m-o-------m-j-----', 'c-f-j-o-j-f-c-f-j-o-r-o-j-------'],
    leadWave: 'sawtooth',
  },
  boss: {
    bpm: 136, root: 40, minor: true, acid: true, prog: [0, 1, 0, 1, 0, 1, 6, 5], sections: [0, 1],
    drums: [HOUSE2, BREAK2], fill: FILL,
    bass: ['0000000000001111', '0c0c0c0c1d1d1d1d'],
    stab: ['x..x..x.........', 'x..x..x...x..x..'],
    lead: ['c---d---c---b---c-----------....', 'o---n---l---j---i---g---f-------'],
    leadWave: 'sawtooth',
  },
  shop: {
    bpm: 98, swing: 0.16, root: 48, minor: false, prog: [0, 5, 7, 5], sections: [0, 1],
    drums: [{ k: 'x......x..x.....', s: '....X.......X...', h: 'x.xxx.xxx.xxx.xx' }],
    bass: ['0..0..7.9..7.4..', '0.4.7.9.c.9.7.4.'],
    stab: ['..x...x...x...x.', '..x...x...x..x..'],
    lead: ['4-7-9-c-9-7-4---7-9-c-e-c-------', 'c---e---j---e---c-9-7-4-2-------'],
    leadWave: 'triangle',
  },
  ending: {
    bpm: 90, swing: 0.1, root: 45, minor: false, prog: [0, 5, 3, 7], sections: [0],
    drums: [SPARSE],
    bass: ['0.......7.......'],
    stab: ['x.......x.......'],
    lead: ['c-------e---j---h-------e-------'],
    leadWave: 'triangle',
  },
  gameover: {
    bpm: 80, root: 38, minor: true, prog: [0, -2, -4, -5], sections: [0],
    drums: [SPARSE], bass: ['0-------0-------'], stab: ['x...............'],
    lead: ['c-------a-------7-------3-------'], leadWave: 'triangle',
  },
};
