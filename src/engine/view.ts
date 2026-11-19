// Logical view geometry. The playfield is always 320×256; on wider screens the view grows sideways (never stretched),
// revealing extra scenery either side. All game code draws in playfield coordinates (0..320); the view origin sits
// at x = -VIEW.ox, so the visible range is [-ox, 320 + ox).

/** Widest extra margin (each side) the scenery is pre-rendered for: 320 + 2×160 = 640 → up to 2.5:1 (covers 21:9). */
export const MARGIN = 160;

export const VIEW = {
  /** logical canvas width in pixels (>= 320) */
  w: 320,
  /** playfield offset from the left edge of the view */
  ox: 0,
};

export function setViewWidth(w: number) {
  w = Math.max(320, Math.min(320 + MARGIN * 2, Math.round(w / 2) * 2));
  VIEW.w = w;
  VIEW.ox = (w - 320) / 2;
}

/** Left edge of the view in playfield coordinates. */
export const viewL = () => -VIEW.ox;
/** Right edge of the view in playfield coordinates. */
export const viewR = () => 320 + VIEW.ox;

/** Fill the whole visible view (playfield coordinates are assumed, i.e. the context is translated by ox). */
export function fillView(ctx: CanvasRenderingContext2D, style: string | CanvasGradient, y = 0, h = 256) {
  ctx.fillStyle = style;
  ctx.fillRect(-VIEW.ox, y, VIEW.w, h);
}
