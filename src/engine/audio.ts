// Web Audio: procedurally synthesised SFX plus a small step sequencer for music.
import type { Track } from '../audio/music';
import { TRACKS } from '../audio/music';

type SfxName =
  | 'shot' | 'laser' | 'cannon' | 'missile' | 'flame' | 'hit' | 'ping' | 'expS' | 'expM' | 'expL' | 'cash' | 'token'
  | 'hurt' | 'die' | 'zap' | 'dive' | 'menu' | 'select' | 'buy' | 'deny' | 'sell' | 'ebullet' | 'alarm' | 'warn' | 'beam' | 'oneup';

class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode;
  sfx!: GainNode;
  music!: GainNode;
  comp!: DynamicsCompressorNode;
  noise!: AudioBuffer;
  sfxVol = 0.7;
  musicVol = 0.6;
  private last: Record<string, number> = {};

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx: AudioContext = new AC();
    this.ctx = ctx;
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -14; this.comp.ratio.value = 4;
    this.master = ctx.createGain(); this.master.gain.value = 0.8;
    this.sfx = ctx.createGain(); this.music = ctx.createGain();
    this.sfx.connect(this.comp); this.music.connect(this.comp);
    this.comp.connect(this.master); this.master.connect(ctx.destination);
    this.noise = ctx.createBuffer(1, ctx.sampleRate * 1, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.setVolumes(this.musicVol, this.sfxVol);
    if (this.pendingTrack) { const t = this.pendingTrack; this.pendingTrack = null; this.playMusic(t); }
  }
  setVolumes(m: number, s: number) {
    this.musicVol = m; this.sfxVol = s;
    if (!this.ctx) return;
    this.music.gain.value = m * 0.55;
    this.sfx.gain.value = s * 0.6;
  }

  // ---------- building blocks ----------
  private env(g: GainNode, t: number, a: number, peak: number, d: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  tone(dest: AudioNode, type: OscillatorType, f0: number, f1: number, t: number, dur: number, vol: number, attack = 0.002) {
    const c = this.ctx!;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    this.env(g, t, attack, vol, dur);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + dur + attack + 0.05);
    return o;
  }
  noiseHit(dest: AudioNode, t: number, dur: number, vol: number, ftype: BiquadFilterType, f0: number, f1 = f0, q = 1) {
    const c = this.ctx!;
    const s = c.createBufferSource(); s.buffer = this.noise;
    s.playbackRate.value = 0.7 + Math.random() * 0.6;
    const f = c.createBiquadFilter(); f.type = ftype; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = c.createGain(); this.env(g, t, 0.001, vol, dur);
    s.connect(f); f.connect(g); g.connect(dest);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }

  play(name: SfxName, vol = 1) {
    const c = this.ctx;
    if (!c || this.sfxVol <= 0) return;
    const now = c.currentTime;
    const minGap: Partial<Record<SfxName, number>> = { shot: 0.05, hit: 0.04, expS: 0.04, cash: 0.04, ebullet: 0.06, laser: 0.06, flame: 0.08, ping: 0.06, missile: 0.08 };
    if (now - (this.last[name] ?? 0) < (minGap[name] ?? 0.02)) return;
    this.last[name] = now;
    const d = this.sfx, t = now + 0.005, v = vol;
    switch (name) {
      case 'shot': this.tone(d, 'square', 1400, 300, t, 0.06, 0.12 * v); break;
      case 'laser': this.tone(d, 'sawtooth', 2200, 800, t, 0.08, 0.08 * v); break;
      case 'cannon': this.tone(d, 'square', 220, 60, t, 0.18, 0.2 * v); this.noiseHit(d, t, 0.12, 0.2 * v, 'lowpass', 1200, 200); break;
      case 'missile': this.noiseHit(d, t, 0.25, 0.12 * v, 'bandpass', 800, 3000, 2); break;
      case 'flame': this.noiseHit(d, t, 0.12, 0.1 * v, 'bandpass', 600, 400, 0.8); break;
      case 'hit': this.noiseHit(d, t, 0.05, 0.15 * v, 'highpass', 3000); break;
      case 'ping': this.tone(d, 'triangle', 2400, 2300, t, 0.08, 0.12 * v); break;
      case 'ebullet': this.tone(d, 'triangle', 600, 900, t, 0.06, 0.06 * v); break;
      case 'expS': this.noiseHit(d, t, 0.25, 0.3 * v, 'lowpass', 2500, 150); break;
      case 'expM':
        this.noiseHit(d, t, 0.5, 0.45 * v, 'lowpass', 1800, 80);
        this.tone(d, 'sine', 120, 40, t, 0.3, 0.3 * v); break;
      case 'expL':
        this.noiseHit(d, t, 1.2, 0.6 * v, 'lowpass', 1500, 40);
        this.tone(d, 'sine', 90, 25, t, 0.8, 0.5 * v);
        this.noiseHit(d, t + 0.15, 0.8, 0.3 * v, 'bandpass', 600, 100, 1); break;
      case 'cash': this.tone(d, 'square', 1046, 1046, t, 0.04, 0.07 * v); this.tone(d, 'square', 1568, 1568, t + 0.04, 0.06, 0.07 * v); break;
      case 'token': [523, 659, 784, 1046].forEach((f, i) => this.tone(d, 'square', f, f, t + i * 0.05, 0.08, 0.08 * v)); break;
      case 'oneup': [392, 523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(d, 'square', f, f, t + i * 0.07, 0.1, 0.09 * v)); break;
      case 'hurt': this.tone(d, 'sawtooth', 300, 80, t, 0.2, 0.2 * v); this.noiseHit(d, t, 0.1, 0.2 * v, 'bandpass', 900); break;
      case 'die':
        this.noiseHit(d, t, 1.5, 0.6 * v, 'lowpass', 3000, 50);
        this.tone(d, 'sawtooth', 600, 30, t, 1.2, 0.25 * v); break;
      case 'zap':
        this.noiseHit(d, t, 1.0, 0.5 * v, 'bandpass', 4000, 100, 3);
        this.tone(d, 'sawtooth', 80, 1600, t, 0.6, 0.2 * v); break;
      case 'dive': this.tone(d, 'sine', 800, 150, t, 0.5, 0.25 * v); break;
      case 'menu': this.tone(d, 'square', 880, 880, t, 0.03, 0.06 * v); break;
      case 'select': this.tone(d, 'square', 660, 1320, t, 0.1, 0.08 * v); break;
      case 'buy': [784, 988, 1175].forEach((f, i) => this.tone(d, 'square', f, f, t + i * 0.06, 0.08, 0.08 * v)); this.noiseHit(d, t + 0.18, 0.15, 0.08 * v, 'highpass', 6000); break;
      case 'sell': [1175, 784].forEach((f, i) => this.tone(d, 'square', f, f, t + i * 0.07, 0.08, 0.08 * v)); break;
      case 'deny': this.tone(d, 'square', 160, 140, t, 0.25, 0.1 * v); break;
      case 'alarm': for (let i = 0; i < 4; i++) this.tone(d, 'square', 880, 660, t + i * 0.25, 0.2, 0.08 * v); break;
      case 'warn': this.tone(d, 'sawtooth', 200, 200, t, 0.3, 0.07 * v); break;
      case 'beam': this.tone(d, 'sawtooth', 110, 105, t, 0.7, 0.12 * v); this.noiseHit(d, t, 0.7, 0.1 * v, 'bandpass', 2000, 1500, 4); break;
    }
  }

  // ---------- music sequencer ----------
  private track: Track | null = null;
  private trackName = '';
  private pendingTrack: string | null = null;
  private step = 0;
  private nextTime = 0;
  private timer: number | null = null;
  private bassFilterBase = 400;

  playMusic(name: string) {
    if (!this.ctx) { this.pendingTrack = name; return; }
    if (this.trackName === name && this.track) return;
    this.stopMusic();
    const tr = TRACKS[name];
    if (!tr) return;
    this.track = tr; this.trackName = name; this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 25);
  }
  stopMusic() {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null; this.track = null; this.trackName = '';
    if (this.ctx) {
      // fade out quickly by recreating the music bus
      const old = this.music;
      old.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
      setTimeout(() => old.disconnect(), 400);
      this.music = this.ctx.createGain();
      this.music.connect(this.comp);
      this.music.gain.value = this.musicVol * 0.55;
    }
  }
  private schedule() {
    const c = this.ctx!, tr = this.track;
    if (!tr) return;
    const stepDur = 60 / tr.bpm / 4;
    while (this.nextTime < c.currentTime + 0.12) {
      this.playStep(tr, this.step, this.nextTime, stepDur);
      const swing = this.step % 2 === 0 ? (tr.swing ?? 0) : -(tr.swing ?? 0);
      this.nextTime += stepDur * (1 + swing);
      this.step++;
    }
  }
  private mtof(m: number) { return 440 * Math.pow(2, (m - 69) / 12); }
  private playStep(tr: Track, step: number, t: number, sd: number) {
    const d = this.music;
    const s = step % 16, bar = Math.floor(step / 16);
    const sec = tr.sections[Math.floor(bar / 4) % tr.sections.length];
    const fill = bar % 4 === 3 && tr.fill;
    const dr = fill ? tr.fill! : tr.drums[sec % tr.drums.length];
    const root = tr.root + tr.prog[bar % tr.prog.length];
    const ch = (str: string | undefined) => (str ? str[s] ?? '.' : '.');
    const k = ch(dr.k), sn = ch(dr.s), hh = ch(dr.h);
    if (k !== '.') { this.tone(d, 'sine', 160, 38, t, 0.22, 0.9); this.noiseHit(d, t, 0.01, 0.3, 'lowpass', 3000); }
    if (sn !== '.') { this.noiseHit(d, t, sn === 'X' ? 0.22 : 0.12, sn === 'X' ? 0.5 : 0.3, 'bandpass', 1800, 1200, 0.7); this.tone(d, 'triangle', 220, 160, t, 0.08, 0.25); }
    if (hh === 'x') this.noiseHit(d, t, 0.035, 0.12, 'highpass', 8000);
    if (hh === 'o') this.noiseHit(d, t, 0.18, 0.12, 'highpass', 7000);
    // bass
    const bp = tr.bass[sec % tr.bass.length];
    const bn = bp[s] ?? '.';
    if (bn !== '.' && bn !== '-') {
      const semi = NOTE.indexOf(bn);
      let len = 1; while (bp[s + len] === '-') len++;
      this.bassNote(root + semi - 12, t, sd * len * 0.95, bar, tr.acid);
    }
    // stabs
    const st = tr.stab ? tr.stab[sec % tr.stab.length] : '';
    if (st && st[s] === 'x') this.stab(root + 12, tr.minor ? [0, 3, 7, 10] : [0, 4, 7, 11], t, 0.22);
    // lead (two bars long)
    if (tr.lead) {
      const lp = tr.lead[sec % tr.lead.length];
      const idx = (bar % 2) * 16 + s;
      const ln = lp[idx] ?? '.';
      if (ln !== '.' && ln !== '-') {
        let len = 1; while (lp[idx + len] === '-') len++;
        this.lead(tr.root + 24 + NOTE.indexOf(ln), t, sd * len * 0.9, tr.leadWave ?? 'square');
      }
    }
  }
  private bassNote(m: number, t: number, dur: number, bar: number, acid?: boolean) {
    const c = this.ctx!;
    const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = this.mtof(m);
    const f = c.createBiquadFilter(); f.type = 'lowpass';
    f.Q.value = acid ? 14 : 4;
    const base = acid ? 300 + 700 * (0.5 + 0.5 * Math.sin(bar * 0.8 + t * 0.3)) : this.bassFilterBase;
    f.frequency.setValueAtTime(base * 4, t);
    f.frequency.exponentialRampToValueAtTime(base, t + Math.min(dur, 0.18));
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.32, t + 0.005);
    g.gain.setValueAtTime(0.32, t + dur * 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.02);
    o.connect(f); f.connect(g); g.connect(this.music);
    o.start(t); o.stop(t + dur + 0.05);
  }
  private stab(m: number, chord: number[], t: number, dur: number) {
    const c = this.ctx!;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(4000, t); f.frequency.exponentialRampToValueAtTime(600, t + dur);
    const g = c.createGain(); this.env(g, t, 0.003, 0.12, dur);
    f.connect(g); g.connect(this.music);
    for (const iv of chord) for (const det of [-6, 6]) {
      const o = c.createOscillator(); o.type = 'square';
      o.frequency.value = this.mtof(m + iv); o.detune.value = det;
      o.connect(f); o.start(t); o.stop(t + dur + 0.05);
    }
  }
  private lead(m: number, t: number, dur: number, wave: OscillatorType) {
    const c = this.ctx!;
    const o = c.createOscillator(); o.type = wave; o.frequency.value = this.mtof(m);
    const lfo = c.createOscillator(); lfo.frequency.value = 6; const lg = c.createGain(); lg.gain.value = 8;
    lfo.connect(lg); lg.connect(o.detune);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.09, t + 0.01);
    g.gain.setValueAtTime(0.09, t + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 3200;
    o.connect(f); f.connect(g); g.connect(this.music);
    o.start(t); lfo.start(t); o.stop(t + dur + 0.1); lfo.stop(t + dur + 0.1);
  }
}

export const NOTE = '0123456789abcdefghijklmnopqrstuvwxyz';
export const audio = new AudioEngine();
