// The Strikeblaster: movement, scenery collision/crush, dive, satellites and visible weapon attachments.
import { S, SF, flashOf } from '../art/sprites';
import { Ctx, snap } from '../engine/gfx';
import { ITEM, ItemId, PlayerState } from './items';
import type { World } from './World';

export interface Ctl { up: boolean; down: boolean; left: boolean; right: boolean; fire: boolean; firePressed: boolean; zap: boolean; dive: boolean }

export class Player {
  x = 160; y = 210; ox = 160; oy = 210;
  ps: PlayerState;
  inv = 150; // spawn invincibility
  hitFlash = 0;
  contactCd = 0;
  dive = 0;
  superT = 0;
  dead = false;
  bank = 0;
  t = 0;
  // weapon timers
  tapCd = 0; holdCd = 0; cannonCd = 0; homingCd = 0; mineCd = 0; flameCd = 0; twistA = 0; firing = 0;
  droneCd = [0, 8];
  sats: { x: number; y: number; kind: 'ball' | 'drone' }[] = [];
  satA = 0;
  crushing = false;
  /** ticks of muzzle flash left after a volley */
  muzzle = 0;

  constructor(ps: PlayerState) { this.ps = ps; }

  /** effective weapon level (Super Power grants everything at max) */
  lv(id: ItemId) {
    if (this.superT > 0 && ITEM[id].kind !== 'charge') return Math.max(this.ps.load[id], ITEM[id].max);
    return this.ps.load[id];
  }
  speed() { return 1.5 + 0.45 * this.lv('speed'); }
  atBottom() { return this.y >= 244; }

  update(w: World, c: Ctl) {
    this.ox = this.x; this.oy = this.y; this.t++;
    if (this.inv > 0) this.inv--;
    if (this.hitFlash > 0) this.hitFlash--;
    if (this.contactCd > 0) this.contactCd--;
    if (this.superT > 0) this.superT--;
    if (this.muzzle > 0) this.muzzle--;
    if (this.dead) return;
    const sp = this.speed();
    let dx = (c.right ? 1 : 0) - (c.left ? 1 : 0), dy = (c.down ? 1 : 0) - (c.up ? 1 : 0);
    if (dx && dy) { dx *= 0.75; dy *= 0.75; }
    this.bank += (dx - this.bank) * 0.3;
    const sc = w.sc;
    const box = (x: number, y: number) => sc.rectSolid(x - 6, y - 7, 12, 14);
    const diving = this.dive > 0;
    // axis-separated movement with sliding against walls
    const nx = Math.max(10, Math.min(310, this.x + dx * sp));
    if (diving || !box(nx, this.y)) this.x = nx;
    else for (let k = 0; k < Math.ceil(Math.abs(dx * sp)); k++) { const tx = this.x + Math.sign(dx); if (box(tx, this.y)) break; this.x = tx; }
    const ny = Math.max(14, Math.min(246, this.y + dy * sp));
    if (diving || !box(this.x, ny)) this.y = ny;
    else for (let k = 0; k < Math.ceil(Math.abs(dy * sp)); k++) { const ty = this.y + Math.sign(dy); if (box(this.x, ty)) break; this.y = ty; }
    // scenery moved by scrolling: push the ship out, crush if trapped against the screen edge
    this.crushing = false;
    if (!diving && box(this.x, this.y)) {
      const dir = w.scrollDelta >= 0 ? 1 : -1;
      const tries: [number, number][] = [];
      for (let k = 1; k <= 6; k++) tries.push([0, k * dir], [k, 0], [-k, 0], [k, k * dir], [-k, k * dir]);
      let freed = false;
      for (const [ox, oy] of tries) {
        const tx = this.x + ox, ty = this.y + oy;
        if (tx < 10 || tx > 310 || ty < 14 || ty > 246) continue;
        if (!box(tx, ty)) { this.x = tx; this.y = ty; freed = true; break; }
      }
      if (!freed) {
        this.y = Math.max(14, Math.min(246, this.y + Math.abs(w.scrollDelta) * dir + dir));
        this.crushing = true;
        w.crushPlayer();
      }
    }
    // dive
    if (this.dive > 0) {
      this.dive--;
      if (this.dive === 0 && box(this.x, this.y)) this.dive = 1; // stay under until clear
    }
    // satellites
    this.satA += 0.07;
    this.sats.length = 0;
    const nb = this.lv('electro'), nd = this.lv('drone');
    for (let i = 0; i < nb; i++) { const a = this.satA * 1.6 + (i * Math.PI * 2) / nb; this.sats.push({ x: this.x + Math.cos(a) * 24, y: this.y + Math.sin(a) * 24, kind: 'ball' }); }
    for (let i = 0; i < nd; i++) { const a = -this.satA * 0.7 + (i * Math.PI * 2) / Math.max(1, nd) + Math.PI / 2; this.sats.push({ x: this.x + Math.cos(a) * 34, y: this.y + Math.sin(a) * 20 - 6, kind: 'drone' }); }
  }

  frame() { return SF.ship[Math.max(0, Math.min(4, Math.round(this.bank * 2) + 2))]; }

  draw(ctx: Ctx, a: number, w: World) {
    if (this.dead) return;
    const x = snap(this.ox + (this.x - this.ox) * a), y = snap(this.oy + (this.y - this.oy) * a);
    const diving = this.dive > 0;
    if (this.inv > 0 && !diving && this.inv % 4 < 2 && this.inv < 60) return;
    ctx.save();
    if (diving) {
      ctx.globalAlpha = 0.55;
      ctx.translate(x, y + 4); ctx.scale(0.7, 0.7); ctx.translate(-x, -y);
    }
    const L = (id: ItemId) => this.lv(id);
    const att = (s: HTMLCanvasElement, dx: number, dy: number, flip = false) => {
      if (flip) { ctx.save(); ctx.translate(x + dx, y + dy); ctx.scale(-1, 1); ctx.drawImage(s, -(s.width >> 1), -(s.height >> 1)); ctx.restore(); }
      else ctx.drawImage(s, x + dx - (s.width >> 1), y + dy - (s.height >> 1));
    };
    // engine flames (bigger with speed-ups)
    const f = SF.flame[(this.t >> 1) % 3];
    const fl = 1 + L('speed') * 0.25;
    const bo = Math.round(this.bank * 1.2);
    for (const ex of [-6, 6]) ctx.drawImage(f, x + ex + bo - 3, y + 15, 6, snap(12 * fl));
    // behind hull
    if (L('wing')) { att(S.att_wing, -13, 6); att(S.att_wing, 13, 6, true); }
    if (L('side')) { att(S.att_side, -15, 2); att(S.att_side, 15, 2, true); if (L('side') > 1) { att(S.att_side, -15, 7); att(S.att_side, 15, 7, true); } }
    if (L('rear')) { att(S.att_rear, -3, 14); att(S.att_rear, 3, 14); if (L('rear') > 2) { att(S.att_rear, -8, 13); att(S.att_rear, 8, 13); } }
    if (L('mines')) att(S.att_mines, 0, 15);
    if (L('homing')) { att(S.att_homing, -9, 7); att(S.att_homing, 9, 7); }
    if (L('armour')) { att(S.att_armour, -7, 3); att(S.att_armour, 7, 3); }
    // hull
    let hull = this.frame();
    if (this.hitFlash > 0 && this.hitFlash % 2) hull = flashOf(hull);
    ctx.drawImage(hull, x - 15, y - 17);
    // on top
    if (L('spread')) { att(S.att_spread, -7, -2); att(S.att_spread, 7, -2, true); if (L('spread') > 2) { att(S.att_spread, -10, 3); att(S.att_spread, 10, 3, true); } }
    if (L('laser')) { att(S.att_laser, -4, -9); att(S.att_laser, 4, -9); }
    if (L('power') >= 3) att(S.att_nose, 0, -14);
    if (L('cannon')) att(S.att_cannon, 0, -4);
    if (L('twister')) {
      ctx.save(); ctx.translate(x, y + 6); ctx.rotate(this.twistA); ctx.drawImage(S.att_twister, -5, -5); ctx.restore();
    }
    if (L('flamer')) {
      att(S.att_flamer, 0, -18);
      // pilot light flickers; roars when firing
      const big = this.firing > 0;
      ctx.fillStyle = big ? '#ffcc33' : (this.t % 6 < 3 ? '#66aaff' : '#aaddff');
      ctx.fillRect(x - 1, y - 23 - (this.t % 2), 2, big ? 3 : 2);
    }
    // muzzle flash: a hot white star at the nose gun, plus side-pod flashes
    if (this.muzzle > 0 && !diving) {
      const big = this.muzzle >= 2;
      ctx.fillStyle = big ? '#ffffff' : '#ffdd66';
      ctx.fillRect(x - 1, y - 21 - (big ? 3 : 1), 2, big ? 6 : 3);
      ctx.fillRect(x - (big ? 3 : 2), y - 19, big ? 6 : 4, 2);
      if (L('side')) { ctx.fillRect(x - 23, y + 1, 3, 2); ctx.fillRect(x + 20, y + 1, 3, 2); }
    }
    ctx.restore();
    // satellites
    for (const s of this.sats) {
      const sp = s.kind === 'ball' ? SF.ball[(this.t >> 2) % 4] : S.drone;
      ctx.drawImage(sp, snap(s.x - sp.width / 2), snap(s.y - sp.height / 2));
    }
    // spawn shield bubble
    if (this.inv > 0 && !diving) {
      ctx.strokeStyle = this.t % 4 < 2 ? 'rgba(120,220,255,0.9)' : 'rgba(255,255,255,0.6)';
      ctx.beginPath(); ctx.arc(x, y, 18 + Math.sin(this.t * 0.4) * 1.5, 0, Math.PI * 2); ctx.stroke();
    }
    if (this.superT > 0 && this.t % 4 < 2) {
      ctx.strokeStyle = 'rgba(255,240,120,0.8)';
      ctx.beginPath(); ctx.arc(x, y, 21, 0, Math.PI * 2); ctx.stroke();
    }
  }
}
