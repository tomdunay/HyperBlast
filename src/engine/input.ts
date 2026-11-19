// Keyboard, gamepad, touch and pointer input mapped to abstract actions.
export type Action = 'up' | 'down' | 'left' | 'right' | 'fire' | 'zap' | 'dive' | 'pause' | 'confirm' | 'back';
export const ACTIONS: Action[] = ['up', 'down', 'left', 'right', 'fire', 'zap', 'dive', 'pause', 'confirm', 'back'];
export const REMAPPABLE: Action[] = ['up', 'down', 'left', 'right', 'fire', 'zap', 'dive', 'pause'];

export const DEFAULT_BINDINGS: Record<Action, string[]> = {
  up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'], left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'],
  fire: ['Space', 'KeyZ'], zap: ['KeyX'], dive: ['KeyC'], pause: ['KeyP', 'Escape'], confirm: ['Enter', 'NumpadEnter'], back: ['Escape', 'Backspace'],
};

class Input {
  bindings: Record<Action, string[]> = JSON.parse(JSON.stringify(DEFAULT_BINDINGS));
  keys = new Set<string>();
  held: Record<string, boolean> = {};
  prev: Record<string, boolean> = {};
  pressed: Record<string, boolean> = {};
  /** key codes pressed since last poll (for remapping / debug / name entry) */
  keyQueue: string[] = [];
  charQueue: string[] = [];
  private pendingKeys: string[] = [];
  private pendingChars: string[] = [];
  clicks: { x: number; y: number }[] = [];
  private pendingClicks: { x: number; y: number }[] = [];
  anyPressed = false;
  touch = { active: false, sx: 0, sy: 0, dx: 0, dy: 0, id: -1, fire: false, zap: false, dive: false, pause: false };
  canvas!: HTMLCanvasElement;
  onFirstGesture: (() => void)[] = [];

  init(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const gesture = () => { this.onFirstGesture.forEach((f) => f()); this.onFirstGesture = []; };
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(e.code)) e.preventDefault();
      if (!e.repeat) { this.pendingKeys.push(e.code); if (e.key.length === 1) this.pendingChars.push(e.key.toUpperCase()); }
      this.keys.add(e.code);
      gesture();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    canvas.addEventListener('pointerdown', (e) => {
      const r = canvas.getBoundingClientRect();
      this.pendingClicks.push({ x: ((e.clientX - r.left) / r.width) * 320, y: ((e.clientY - r.top) / r.height) * 256 });
      gesture();
    });
    window.addEventListener('touchstart', (e) => { document.body.classList.add('touch'); this.onTouch(e); gesture(); }, { passive: false });
    window.addEventListener('touchmove', (e) => this.onTouch(e), { passive: false });
    window.addEventListener('touchend', (e) => this.onTouch(e), { passive: false });
    window.addEventListener('touchcancel', (e) => this.onTouch(e), { passive: false });
    this.makeTouchButtons();
  }

  private btns: Record<string, HTMLElement> = {};
  private makeTouchButtons() {
    const mk = (id: string, label: string, css: string) => {
      const d = document.createElement('div');
      d.className = 'tbtn'; d.textContent = label; d.style.cssText = css;
      document.body.appendChild(d);
      this.btns[id] = d;
    };
    mk('fire', 'FIRE', 'right:24px;bottom:40px;width:84px;height:84px;');
    mk('zap', 'ZAP', 'right:120px;bottom:24px;width:54px;height:54px;');
    mk('dive', 'DIVE', 'right:24px;bottom:140px;width:54px;height:54px;');
    mk('pause', 'II', 'right:12px;top:12px;width:40px;height:40px;');
  }

  private onTouch(e: TouchEvent) {
    if ((e.target as HTMLElement)?.tagName !== 'INPUT') e.preventDefault();
    const t = this.touch;
    t.fire = t.zap = t.dive = false;
    let stickFound = false;
    for (const tc of Array.from(e.touches)) {
      let onBtn = false;
      for (const [id, el] of Object.entries(this.btns)) {
        const r = el.getBoundingClientRect();
        if (tc.clientX >= r.left - 10 && tc.clientX <= r.right + 10 && tc.clientY >= r.top - 10 && tc.clientY <= r.bottom + 10) {
          onBtn = true;
          if (id === 'pause') { if (e.type === 'touchstart') this.pendingKeys.push('TouchPause'); }
          else (t as any)[id] = true;
        }
      }
      if (onBtn) continue;
      if (tc.clientX < window.innerWidth * 0.6) {
        if (t.id !== tc.identifier) { t.id = tc.identifier; t.sx = tc.clientX; t.sy = tc.clientY; }
        t.dx = tc.clientX - t.sx; t.dy = tc.clientY - t.sy;
        stickFound = true;
      }
    }
    if (!stickFound) { t.id = -1; t.dx = t.dy = 0; }
    t.active = true;
  }

  isDown(code: string) { return this.keys.has(code); }

  poll() {
    this.keyQueue = this.pendingKeys; this.pendingKeys = [];
    this.charQueue = this.pendingChars; this.pendingChars = [];
    this.clicks = this.pendingClicks; this.pendingClicks = [];
    const now: Record<string, boolean> = {};
    for (const a of ACTIONS) now[a] = this.bindings[a].some((k) => this.keys.has(k));
    // gamepad
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p) continue;
      const b = (i: number) => !!p.buttons[i]?.pressed;
      const ax = p.axes[0] ?? 0, ay = p.axes[1] ?? 0;
      if (ax < -0.4 || b(14)) now.left = true;
      if (ax > 0.4 || b(15)) now.right = true;
      if (ay < -0.4 || b(12)) now.up = true;
      if (ay > 0.4 || b(13)) now.down = true;
      if (b(0) || b(7)) now.fire = true;
      if (b(1)) now.zap = true;
      if (b(2) || b(3)) now.dive = true;
      if (b(9)) { now.pause = true; now.confirm = true; }
      if (b(0)) now.confirm = true;
      if (b(8)) now.back = true;
    }
    // touch
    const t = this.touch;
    if (t.active) {
      const dz = 12;
      if (t.dx < -dz) now.left = true;
      if (t.dx > dz) now.right = true;
      if (t.dy < -dz) now.up = true;
      if (t.dy > dz) now.down = true;
      if (t.fire) { now.fire = true; now.confirm = true; }
      if (t.zap) now.zap = true;
      if (t.dive) now.dive = true;
    }
    if (this.keyQueue.includes('TouchPause')) now.pause = true;
    this.anyPressed = false;
    for (const a of ACTIONS) {
      this.pressed[a] = now[a] && !this.prev[a];
      if (this.pressed[a]) this.anyPressed = true;
      this.held[a] = now[a];
      this.prev[a] = now[a];
    }
    if (this.keyQueue.length || this.clicks.length) this.anyPressed = true;
  }
  h(a: Action) { return !!this.held[a]; }
  p(a: Action) { return !!this.pressed[a]; }
}

export const input = new Input();
