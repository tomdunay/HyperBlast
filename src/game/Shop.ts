// Gorbo's Trade Hut: buy / sell (half price) / paid advice, with an animated sarcastic shopkeeper.
import { Ctx, makeCanvas, rnd, bayer, fbm } from '../engine/gfx';
import { drawGlow } from '../engine/light';
import { input } from '../engine/input';
import { audio } from '../engine/audio';
import { text, wrap } from '../engine/font';
import { S, SF, renderShapes, Spr } from '../art/sprites';
import { ITEMS, ItemDef, PlayerState, buyPrice, sellPrice } from './items';

const GREET = [
  "WELCOME TO GORBO'S TRADE HUT. TOUCH NOTHING YOU CAN'T AFFORD.",
  'OH. IT\'S YOU. STILL ALIVE THEN? GOOD FOR BUSINESS.',
  'BUY SOMETHING SHINY. YOUR SHIP LOOKS LIKE A TOASTER.',
  'NO REFUNDS. NO GUARANTEES. NO SHIRT, NO SERVICE.',
  'GORBO HAS GUNS. YOU HAVE CASH. LET\'S DANCE.',
];
const BUY = ['EXCELLENT CHOICE. GORBO APPROVES OF YOUR MONEY.', 'SOLD! NO TAKE-BACKS. WELL, HALF TAKE-BACKS.', 'BOLT IT ON YOURSELF, GORBO IS ON BREAK.', 'THAT ONE ONLY EXPLODED IN TESTING TWICE.', 'KA-CHING. MUSIC TO ALL SIX OF MY EARS.'];
const POOR = ['YOU CAN\'T AFFORD THAT. GO SHOOT MORE THINGS.', 'GORBO DOES NOT DO CREDIT. GORBO DOES DO LAUGHING.', 'COME BACK WHEN YOUR WALLET HAS HIT PUBERTY.'];
const SELL = ['GORBO WILL TAKE THAT OFF YOUR HANDS. AT HALF PRICE, OBVIOUSLY.', 'A BIT SCRATCHED, BUT GORBO IS GENEROUS.', 'SOLD BACK. GORBO WILL POLISH IT AND CHARGE DOUBLE.'];
const MAXED = ['YOU ALREADY HAVE ALL OF THOSE. GREEDY.', 'ANY MORE AND YOUR SHIP WILL FALL OVER.'];
const LOCKED = ['THAT\'S OUT OF STOCK. TRY A LATER HUT.', 'NOT FOR SALE TO BEGINNERS. COME BACK LATER.'];
const ADVICE = [
  'HOLD DOWN AT THE BOTTOM OF THE SCREEN TO SCROLL BACKWARDS. GREAT FOR GRABBING CASH YOU MISSED.',
  'TAPPING FIRE IS FASTER THAN HOLDING IT. UNLESS YOU BUY AUTO FIRE. FROM ME.',
  'ARMOURED SHELLS PROTECT BOSS CORES. BREAK THE PLATES FIRST.',
  'NEVER LICK A SPORE POD.',
  'DIVE UNDER WALLS IF YOU GET SQUASHED AGAINST THE SCREEN EDGE.',
  'ALWAYS EAT A GOOD BREAKFAST. GORBO HAS SEVEN.',
  'SHOOT THE SILVER CAPSULES. THINGS FALL OUT. NICE THINGS.',
  'IF YOU DIE YOU KEEP YOUR GUNS BUT LOSE ONE BLASTER POWER LEVEL. SO DON\'T.',
  'THE SECRET TO HAPPINESS IS A FULL SHIELD AND AN EMPTY BLADDER.',
  'GORBO\'S COUSIN SELLS THE SAME STUFF FOR LESS. GORBO\'S COUSIN IS A LIAR.',
  'SIDE SHOT IS WORTH ITS WEIGHT IN TUNNELS.',
];
const pick = (a: string[]) => a[Math.floor(Math.random() * a.length)];

let gorboBody: Spr | null = null;
let icons: Map<string, Spr> | null = null;

function buildArt() {
  gorboBody = renderShapes(120, 96, [
    { t: 'ell', x: -30, y: 34, rx: 14, ry: 9, r: 'purple', z: 2 },
    { t: 'ell', x: 0, y: 30, rx: 36, ry: 24, r: 'purple', z: 0 },
    { t: 'ell', x: 0, y: -2, rx: 46, ry: 32, r: 'slime', z: 10 },
    { t: 'tex', x: 0, y: -8, rx: 40, ry: 22, r: 'slime', seed: 12, z: 12 },
    { t: 'ell', x: 0, y: 14, rx: 28, ry: 12, r: 'green', z: 18, bias: 0.1 },
    { t: 'box', x: 0, y: -32, w: 26, h: 10, r: 'red', bevel: 2, z: 30 },
    { t: 'cyl', x: 0, y: -39, w: 2, h: 6, r: 'gold', z: 31 },
  ], true);
  icons = new Map();
  const ic = (id: string, draw: (c: Ctx) => void) => { const [cv, c] = makeCanvas(32, 20); draw(c); icons!.set(id, cv); };
  const put = (c: Ctx, s: Spr, x = 16, y = 10) => c.drawImage(s, Math.round(x - s.width / 2), Math.round(y - s.height / 2));
  ic('power', (c) => { put(c, S.b3, 10); put(c, S.b2, 16); put(c, S.b3, 22); });
  ic('spread', (c) => { put(c, S.att_spread, 10); put(c, S.spread, 20, 6); put(c, S.spread, 25, 10); });
  ic('side', (c) => { put(c, S.att_side, 10); put(c, S.side, 24); });
  ic('rear', (c) => { put(c, S.att_rear, 12); put(c, S.rear, 20, 12); });
  ic('speed', (c) => { put(c, SF.flame[2], 12); put(c, SF.flame[2], 20); });
  ic('halfshield', (c) => { c.fillStyle = '#123'; c.fillRect(4, 8, 24, 5); c.fillStyle = '#4d4'; c.fillRect(5, 9, 11, 3); });
  ic('fullshield', (c) => { c.fillStyle = '#123'; c.fillRect(4, 8, 24, 5); c.fillStyle = '#4d4'; c.fillRect(5, 9, 22, 3); });
  ic('zapper', (c) => { c.strokeStyle = '#d7f'; c.lineWidth = 2; c.beginPath(); c.moveTo(19, 1); c.lineTo(12, 10); c.lineTo(20, 10); c.lineTo(13, 19); c.stroke(); });
  ic('cannon', (c) => { put(c, S.att_cannon, 11); put(c, S.cannon, 23); });
  ic('dive', (c) => { c.globalAlpha = 0.5; put(c, S.shipIcon); c.globalAlpha = 1; c.fillStyle = '#6af'; c.fillRect(6, 17, 20, 1); });
  ic('magnet', (c) => { put(c, S.cash25, 10); put(c, S.cash50, 21); });
  ic('laser', (c) => { put(c, S.att_laser, 10); put(c, SF.laser[1], 20, 10); put(c, SF.laser[1], 24, 10); });
  ic('homing', (c) => { put(c, S.missile, 12); put(c, S.missile, 20); });
  ic('armour', (c) => { put(c, S.att_armour, 12); put(c, S.att_armour, 20); });
  ic('wing', (c) => { put(c, S.att_wing, 10); put(c, S.att_wing, 22); });
  ic('mines', (c) => { put(c, S.mine, 11); put(c, S.mine, 21); });
  ic('autofire', (c) => text(c, 'AUTO', 4, 6, 'gold'));
  ic('electro', (c) => put(c, SF.ball[0]));
  ic('flamer', (c) => { put(c, S.att_flamer, 8); put(c, SF.fire[3], 18); put(c, SF.fire[5], 25); });
  ic('rapid', (c) => text(c, '>>>', 7, 6, 'red'));
  ic('drone', (c) => put(c, S.drone));
  ic('regen', (c) => text(c, '+@+', 7, 6, 'green'));
  ic('twister', (c) => put(c, S.att_twister));
  ic('life', (c) => { put(c, S.shipIcon, 12); text(c, '+1', 18, 6, 'white'); });
}

export class Shop {
  ps: PlayerState;
  shopIdx: number;
  cur = 0; // 0..23 grid, 24..27 buttons
  quip = '';
  talk = 0;
  t = 0;
  done = false;
  final: boolean;
  onExit: () => void;
  blink = 0;

  constructor(ps: PlayerState, shopIdx: number, final: boolean, onExit: () => void) {
    if (!gorboBody) buildArt();
    this.ps = ps; this.shopIdx = shopIdx; this.final = final; this.onExit = onExit;
    this.say(pick(GREET));
    audio.playMusic('shop');
  }
  say(s: string) { this.quip = s; this.talk = Math.min(120, s.length * 2); }
  item(): ItemDef | null { return this.cur < 24 ? ITEMS[this.cur] : null; }
  locked(it: ItemDef) { return it.unlock > this.shopIdx; }

  buy() {
    const it = this.item();
    if (!it) return;
    const ps = this.ps, lvl = ps.load[it.id];
    if (this.locked(it)) { audio.play('deny'); this.say(pick(LOCKED)); return; }
    if (it.kind !== 'instant' && lvl >= it.max) { audio.play('deny'); this.say(pick(MAXED)); return; }
    if ((it.id === 'halfshield' || it.id === 'fullshield') && ps.shield >= ps.maxShield()) { audio.play('deny'); this.say('YOUR SHIELD IS ALREADY FULL. GORBO IS NOT A CHARITY... OH WAIT.'); return; }
    const price = buyPrice(it, lvl);
    if (ps.cash < price) { audio.play('deny'); this.say(pick(POOR)); return; }
    ps.cash -= price;
    if (it.id === 'halfshield') ps.shield = Math.min(ps.maxShield(), ps.shield + ps.maxShield() / 2);
    else if (it.id === 'fullshield') ps.shield = ps.maxShield();
    else if (it.id === 'life') ps.lives++;
    else ps.load[it.id]++;
    if (it.id === 'armour') ps.shield += 25;
    audio.play('buy');
    this.say(pick(BUY));
  }
  sell() {
    const it = this.item();
    if (!it) return;
    const ps = this.ps, lvl = ps.load[it.id];
    const min = it.id === 'power' ? 1 : 0;
    if (it.kind === 'instant' || lvl <= min) { audio.play('deny'); this.say('YOU DON\'T HAVE ONE OF THOSE TO SELL. NICE TRY.'); return; }
    ps.cash += sellPrice(it, lvl);
    ps.load[it.id]--;
    if (it.id === 'armour') ps.shield = Math.min(ps.shield, ps.maxShield());
    audio.play('sell');
    this.say(pick(SELL));
  }
  advice() {
    if (this.ps.cash < 100) { audio.play('deny'); this.say('ADVICE COSTS 100. HERE IS SOME FREE ADVICE: GET 100.'); return; }
    this.ps.cash -= 100;
    audio.play('select');
    this.say(pick(ADVICE));
  }
  exit() {
    if (this.done) return;
    this.done = true;
    audio.play('select');
    this.onExit();
  }

  update() {
    this.t++;
    if (this.talk > 0) this.talk--;
    if (--this.blink < -120) this.blink = 8;
    const c = this.cur;
    if (input.p('left')) this.cur = c >= 24 ? Math.max(24, c - 1) : c % 8 === 0 ? c + 7 : c - 1;
    if (input.p('right')) this.cur = c >= 24 ? Math.min(27, c + 1) : c % 8 === 7 ? c - 7 : c + 1;
    if (input.p('up')) this.cur = c >= 24 ? 16 + (c - 24) * 2 : c < 8 ? 24 + Math.floor((c % 8) / 2) : c - 8;
    if (input.p('down')) this.cur = c >= 24 ? (c - 24) * 2 : c >= 16 ? 24 + Math.floor((c % 8) / 2) : c + 8;
    if (this.cur !== c) audio.play('menu');
    if (input.p('fire') || input.p('confirm')) this.activate();
    if (input.p('zap') || input.keyQueue.includes('Backspace')) this.sell();
    if (input.keyQueue.includes('Escape')) this.exit();
    for (const k of input.clicks) {
      for (let i = 0; i < 24; i++) {
        const [x, y] = this.cellPos(i);
        if (k.x >= x && k.x < x + 36 && k.y >= y && k.y < y + 26) { if (this.cur === i) this.buy(); else { this.cur = i; audio.play('menu'); } }
      }
      for (let i = 0; i < 4; i++) {
        const x = 8 + i * 77;
        if (k.x >= x && k.x < x + 73 && k.y >= 238 && k.y < 252) { this.cur = 24 + i; this.activate(); }
      }
    }
  }
  private lastSel = 0;
  activate() {
    if (this.cur < 24) { this.lastSel = this.cur; this.buy(); return; }
    const sel = this.lastSel;
    switch (this.cur) {
      case 24: this.cur = sel; this.buy(); this.cur = 24; break;
      case 25: this.cur = sel; this.sell(); this.cur = 25; break;
      case 26: this.advice(); break;
      case 27: this.exit(); break;
    }
  }
  cellPos(i: number): [number, number] { return [6 + (i % 8) * 39, 100 + Math.floor(i / 8) * 28]; }

  render(ctx: Ctx) {
    // backdrop
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#1a0c2a'); g.addColorStop(0.4, '#2a1438'); g.addColorStop(1, '#0a0614');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 320, 256);
    ctx.fillStyle = '#3a2048';
    for (let x = 0; x < 320; x += 16) ctx.fillRect(x, 0, 1, 96);
    // hanging lamp: shade, warm light cone (additive, dithered), drifting dust motes
    const sway = Math.sin(this.t * 0.02) * 2;
    ctx.fillStyle = '#111'; ctx.fillRect(Math.round(64 + sway * 0.3), 0, 1, 6);
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(lampCone(), Math.round(64 + sway - 60), 9);
    drawGlow(ctx, 64 + sway, 9, 9, '#ffdd88', 1.2);
    for (let i = 0; i < 14; i++) {
      const k = ((i * 0.137 + this.t * 0.0015 * (1 + (i % 3))) % 1);
      const dx = Math.sin(this.t * 0.01 + i * 1.7) * (10 + k * 40);
      ctx.fillStyle = 'rgba(255,230,170,0.6)';
      ctx.fillRect(Math.round(64 + sway + dx), Math.round(12 + k * 80), 1, 1);
    }
    ctx.globalCompositeOperation = 'source-over';
    this.drawGorbo(ctx, 64, 58);
    ctx.fillStyle = '#556'; ctx.beginPath(); ctx.moveTo(56 + sway, 9); ctx.lineTo(72 + sway, 9); ctx.lineTo(68 + sway, 4); ctx.lineTo(60 + sway, 4); ctx.fill();
    ctx.fillStyle = '#aab'; ctx.fillRect(Math.round(57 + sway), 4, 14, 1);
    // wood-grain counter
    ctx.drawImage(counter(), 0, 82);
    ctx.fillStyle = '#331a08'; ctx.fillRect(0, 95, 320, 1);
    // speech bubble
    ctx.fillStyle = '#eeeedd'; ctx.fillRect(136, 6, 178, 66);
    ctx.fillStyle = '#eeeedd'; ctx.beginPath(); ctx.moveTo(136, 30); ctx.lineTo(118, 38); ctx.lineTo(136, 42); ctx.fill();
    ctx.strokeStyle = '#000'; ctx.strokeRect(136.5, 6.5, 177, 65);
    const lines = wrap(this.quip, 28);
    const shown = Math.floor((1 - this.talk / Math.max(1, Math.min(120, this.quip.length * 2))) * this.quip.length * 1.5) + 4;
    let left = shown;
    lines.slice(0, 7).forEach((l, i) => {
      const s = l.slice(0, Math.max(0, left)); left -= l.length;
      textDark(ctx, s, 141, 10 + i * 9);
    });
    text(ctx, "GORBO'S TRADE HUT", 225, 76, 'gold', 1, 0.5);
    text(ctx, 'HARD CASH $' + this.ps.cash, 225, 86, 'green', 1, 0.5);
    // grid
    for (let i = 0; i < 24; i++) {
      const it = ITEMS[i];
      const [x, y] = this.cellPos(i);
      const lk = this.locked(it);
      const lvl = this.ps.load[it.id];
      ctx.fillStyle = this.cur === i ? '#4a3a6a' : '#1e1430';
      ctx.fillRect(x, y, 36, 26);
      ctx.strokeStyle = this.cur === i ? (this.t % 16 < 8 ? '#ffee66' : '#ffffff') : '#5a4a7a';
      ctx.strokeRect(x + 0.5, y + 0.5, 35, 25);
      ctx.globalAlpha = lk ? 0.25 : 1;
      ctx.drawImage(icons!.get(it.id)!, x + 2, y + 1);
      ctx.globalAlpha = 1;
      if (it.max > 0 && !lk) for (let k = 0; k < it.max; k++) { ctx.fillStyle = k < lvl ? '#ffcc22' : '#333'; ctx.fillRect(x + 3 + k * 5, y + 22, 4, 2); }
      if (lk) text(ctx, 'X', x + 15, y + 9, 'grey');
    }
    // info
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(4, 186, 312, 48);
    const it = this.item() ?? ITEMS[this.lastSel];
    const lvl = this.ps.load[it.id];
    text(ctx, it.name, 8, 189, 'gold');
    if (this.locked(it)) text(ctx, 'NOT IN STOCK YET', 312, 189, 'red', 1, 1);
    else {
      const maxed = it.kind !== 'instant' && lvl >= it.max;
      text(ctx, maxed ? 'MAXED' : 'BUY $' + buyPrice(it, lvl), 312, 189, maxed ? 'grey' : 'green', 1, 1);
      const min = it.id === 'power' ? 1 : 0;
      if (it.kind !== 'instant' && lvl > min) text(ctx, 'SELL $' + sellPrice(it, lvl), 312, 199, 'cyan', 1, 1);
    }
    if (it.kind === 'charge') text(ctx, 'OWNED ' + lvl + '/' + it.max, 8, 199, 'metal');
    else if (it.max > 0) text(ctx, 'LEVEL ' + lvl + '/' + it.max, 8, 199, 'metal');
    wrap(it.desc, 50).slice(0, 2).forEach((l, i) => text(ctx, l, 8, 211 + i * 10, 'white'));
    // buttons
    ['BUY', 'SELL', 'ADVICE $100', this.final ? 'FINISH' : 'EXIT'].forEach((lbl, i) => {
      const x = 8 + i * 77, sel = this.cur === 24 + i;
      ctx.fillStyle = sel ? '#6a4a8a' : '#2a1a40'; ctx.fillRect(x, 238, 73, 14);
      ctx.strokeStyle = sel ? '#ffee66' : '#6a5a8a'; ctx.strokeRect(x + 0.5, 238.5, 72, 13);
      text(ctx, lbl, x + 37, 241, sel ? 'gold' : 'metal', 1, 0.5);
    });
  }

  drawGorbo(ctx: Ctx, cx: number, cy: number) {
    const t = this.t;
    const bob = Math.round(Math.sin(t * 0.05) * 1.5);
    ctx.drawImage(gorboBody!, cx - 60, cy - 48 + bob);
    // three eyes on wobbling stalks
    const eyes = [[-26, -26], [0, -34], [26, -26]];
    eyes.forEach(([ex, ey], i) => {
      const wob = Math.sin(t * 0.07 + i * 2) * 4;
      const tx = cx + ex + wob, ty = cy + ey - 14 + bob;
      ctx.strokeStyle = '#1a6a3a'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cx + ex * 0.6, cy - 18 + bob); ctx.quadraticCurveTo(cx + ex, cy + ey + bob, tx, ty); ctx.stroke();
      ctx.lineWidth = 1;
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(tx, ty, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffee'; ctx.beginPath(); ctx.arc(tx, ty, 6, 0, Math.PI * 2); ctx.fill();
      if (this.blink > 0 && (i !== 1 || this.blink > 4)) { ctx.fillStyle = '#2a8a4a'; ctx.fillRect(tx - 6, ty - 6, 12, 12); }
      else {
        const lx = this.cur < 24 ? ((this.cur % 8) - 3.5) * 0.6 : 2;
        ctx.fillStyle = '#cc3300'; ctx.fillRect(Math.round(tx + lx - 2), Math.round(ty + 1), 4, 4);
        ctx.fillStyle = '#000'; ctx.fillRect(Math.round(tx + lx - 1), Math.round(ty + 2), 2, 2);
      }
    });
    // mouth
    const open = this.talk > 0 ? 2 + Math.abs(Math.sin(t * 0.5)) * 7 : 2;
    ctx.fillStyle = '#200010';
    ctx.beginPath(); ctx.ellipse(cx, cy + 10 + bob, 20, open, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffcc';
    ctx.fillRect(cx - 16, cy + 6 + bob, 3, 5); ctx.fillRect(cx + 13, cy + 6 + bob, 3, 5);
    ctx.fillRect(cx - 4, cy + 8 + bob, 2, 3); ctx.fillRect(cx + 3, cy + 8 + bob, 2, 3);
    // hands on counter
    ctx.fillStyle = '#2a8a4a';
    ctx.fillRect(cx - 46, cy + 30, 14, 6); ctx.fillRect(cx + 32, cy + 30, 14, 6);
    if (this.talk > 0 && t % 20 < 10) { ctx.fillRect(cx + 34, cy + 24, 10, 6); }
  }
}

let coneC: HTMLCanvasElement | null = null;
function lampCone() {
  if (coneC) return coneC;
  const [c, x] = makeCanvas(120, 90);
  const img = x.createImageData(120, 90);
  for (let y = 0; y < 90; y++) for (let px = 0; px < 120; px++) {
    const half = 6 + y * 0.6;
    const d = Math.abs(px - 60) / half;
    if (d > 1) continue;
    const k = (1 - d * 0.7) * (1 - y / 110);
    const lvl = Math.round(k * 3 + bayer(px, y) * 0.9);
    if (lvl <= 0) continue;
    const i = (y * 120 + px) * 4;
    img.data[i] = 120; img.data[i + 1] = 90; img.data[i + 2] = 40; img.data[i + 3] = lvl * 22;
  }
  x.putImageData(img, 0, 0);
  coneC = c;
  return c;
}
let counterC: HTMLCanvasElement | null = null;
function counter() {
  if (counterC) return counterC;
  const [c, x] = makeCanvas(136, 14);
  const img = x.createImageData(136, 14);
  const ramp = [[0x44, 0x22, 0x0c], [0x66, 0x38, 0x18], [0x88, 0x55, 0x28], [0xaa, 0x77, 0x44], [0xcc, 0x99, 0x5c], [0xee, 0xbb, 0x77]];
  for (let y = 0; y < 14; y++) for (let px = 0; px < 136; px++) {
    const grain = Math.sin(px * 0.09 + Math.sin(y * 0.9 + px * 0.02) * 2.5 + fbm(px * 0.05, y * 0.3, 2) * 5);
    let l = 2.6 + grain * 0.9 - y * 0.18 + bayer(px, y) * 0.8;
    if (y === 0) l = 5; else if (y === 1) l = 4;
    if (y === 13) l = 0;
    const col = ramp[Math.max(0, Math.min(5, Math.round(l)))];
    const i = (y * 136 + px) * 4;
    img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2]; img.data[i + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  counterC = c;
  return c;
}

/** dark text for the speech bubble */
function textDark(ctx: Ctx, s: string, x: number, y: number) {
  text(ctx, s, x, y, 'dark');
}
export { rnd };
