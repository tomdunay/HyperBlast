// Final presentation: uploads the low-res game frame to WebGL and composites it at full window resolution with
// sharp-bilinear upscaling (crisp pixels at any scale, no shimmer), two-level neon bloom, shockwave refraction,
// chromatic aberration, optional CRT (scanlines, aperture mask, curvature), vignette and a light colour grade.
// Falls back to a plain nearest-neighbour 2D blit when WebGL is unavailable.

export interface Wave { x: number; y: number; r: number; s: number }
/** Per-frame effect state, written by the game during render (coordinates in view pixels, y down). */
export const postFx = {
  waves: [] as Wave[],
  /** chromatic aberration boost in source pixels (damage pulses, big hits) */
  aberr: 0,
  /** bloom multiplier for this frame (1 = normal) */
  bloomBoost: 1,
};

const MAX_WAVES = 8;

const VS = `
attribute vec2 pos;
varying vec2 uv;
void main() { uv = pos * 0.5 + 0.5; gl_Position = vec4(pos, 0.0, 1.0); }`;

const FS_BRIGHT = `
precision mediump float;
uniform sampler2D src;
varying vec2 uv;
void main() {
  vec3 c = texture2D(src, uv).rgb;
  float m = max(c.r, max(c.g, c.b));
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  // saturated neon (high max channel) and bright whites both bloom; dull mid-tones do not
  float k = smoothstep(0.56, 0.98, m) * (0.55 + 0.45 * smoothstep(0.2, 0.8, l));
  gl_FragColor = vec4(c * k, 1.0);
}`;

const FS_BLUR = `
precision mediump float;
uniform sampler2D src;
uniform vec2 dir; // texel step * direction
varying vec2 uv;
void main() {
  vec3 c = texture2D(src, uv).rgb * 0.2270270;
  c += texture2D(src, uv + dir * 1.3846154).rgb * 0.3162162;
  c += texture2D(src, uv - dir * 1.3846154).rgb * 0.3162162;
  c += texture2D(src, uv + dir * 3.2307692).rgb * 0.0702703;
  c += texture2D(src, uv - dir * 3.2307692).rgb * 0.0702703;
  gl_FragColor = vec4(c, 1.0);
}`;

const FS_COPY = `
precision mediump float;
uniform sampler2D src;
varying vec2 uv;
void main() { gl_FragColor = vec4(texture2D(src, uv).rgb, 1.0); }`;

const FS_FINAL = `
precision highp float;
uniform sampler2D src;
uniform sampler2D bloomA;
uniform sampler2D bloomB;
uniform vec2 srcSize;
uniform vec2 outSize;
uniform float bloomAmt;
uniform float crt;
uniform float aberr;
uniform vec4 waves[${MAX_WAVES}];
varying vec2 uv;

vec2 sharp(vec2 q) {
  vec2 texel = q * srcSize;
  vec2 scale = max(outSize / srcSize, vec2(1.0));
  vec2 fl = floor(texel);
  vec2 cd = fract(texel) - 0.5;
  vec2 rr = 0.5 - 0.5 / scale;
  vec2 f = (cd - clamp(cd, -rr, rr)) * scale + 0.5;
  return (fl + f) / srcSize;
}

void main() {
  vec2 q = uv;
  // CRT curvature
  if (crt > 0.5) {
    vec2 c = q * 2.0 - 1.0;
    c *= 1.0 + vec2(c.y * c.y, c.x * c.x) * vec2(0.018, 0.028);
    q = c * 0.5 + 0.5;
    if (q.x < 0.0 || q.y < 0.0 || q.x > 1.0 || q.y > 1.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  }
  // shockwave refraction (in source pixels)
  vec2 p = q * srcSize;
  for (int i = 0; i < ${MAX_WAVES}; i++) {
    vec4 w = waves[i];
    if (w.w == 0.0) continue;
    vec2 d = p - w.xy;
    float dist = length(d);
    float band = 7.0 + w.z * 0.18;
    float t = (dist - w.z) / band;
    if (abs(t) < 1.0 && dist > 0.001) {
      float k = sin(t * 3.14159) * (1.0 - t * t);
      p -= d / dist * k * w.w;
    }
  }
  q = p / srcSize;

  vec2 dc = q - 0.5;
  float edge = dot(dc, dc);
  vec2 ab = dc * (0.6 + aberr) * (0.35 + edge * 2.5) / srcSize;
  vec3 col;
  col.r = texture2D(src, sharp(q + ab)).r;
  col.g = texture2D(src, sharp(q)).g;
  col.b = texture2D(src, sharp(q - ab)).b;

  // bloom (screen blend so highlights never clip harshly)
  vec3 bl = texture2D(bloomA, q).rgb * 0.85 + texture2D(bloomB, q).rgb * 1.1;
  bl *= bloomAmt;
  col = col + bl - col * clamp(bl, 0.0, 1.0) * 0.6;

  // grade: gentle saturation + contrast lift
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(lum), col, 1.12);
  col = (col - 0.5) * 1.04 + 0.5;

  if (crt > 0.5) {
    float sy = q.y * srcSize.y;
    float scan = 0.62 + 0.38 * pow(0.5 + 0.5 * cos((sy - 0.5) * 6.28318), 1.4);
    col *= mix(1.0, scan, clamp((outSize.y / srcSize.y - 1.5) / 2.0, 0.0, 1.0));
    float m = mod(gl_FragCoord.x, 3.0);
    vec3 mask = m < 1.0 ? vec3(1.08, 0.94, 0.94) : m < 2.0 ? vec3(0.94, 1.08, 0.94) : vec3(0.94, 0.94, 1.08);
    col *= mask * 1.12;
  }
  // vignette
  float v = smoothstep(0.95, 0.25, length(dc * vec2(1.0, 1.15)));
  col *= mix(0.72, 1.0, v);
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

interface Target { tex: WebGLTexture; fb: WebGLFramebuffer; w: number; h: number }

export class Presenter {
  ok = false;
  private gl: WebGLRenderingContext | null = null;
  private ctx2d: CanvasRenderingContext2D | null = null;
  private progs: Record<string, { p: WebGLProgram; u: Record<string, WebGLUniformLocation | null> }> = {};
  private srcTex!: WebGLTexture;
  private half: Target[] = [];
  private quarter: Target[] = [];
  private tw = 0; private th = 0;
  private waveBuf = new Float32Array(MAX_WAVES * 4);

  constructor(private display: HTMLCanvasElement) {
    const opts: WebGLContextAttributes = { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: false };
    const gl = (display.getContext('webgl2', opts) || display.getContext('webgl', opts)) as WebGLRenderingContext | null;
    if (gl) {
      try { this.initGL(gl); this.gl = gl; this.ok = true; } catch (e) { console.warn('WebGL post disabled:', e); }
    }
    if (!this.ok) {
      this.ctx2d = display.getContext('2d');
      if (this.ctx2d) this.ctx2d.imageSmoothingEnabled = false;
    }
  }

  private initGL(gl: WebGLRenderingContext) {
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader');
      return s;
    };
    const vs = sh(gl.VERTEX_SHADER, VS);
    const mk = (name: string, fs: string, uniforms: string[]) => {
      const p = gl.createProgram()!;
      gl.attachShader(p, vs); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
      gl.bindAttribLocation(p, 0, 'pos');
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || 'link');
      const u: Record<string, WebGLUniformLocation | null> = {};
      for (const n of uniforms) u[n] = gl.getUniformLocation(p, n);
      this.progs[name] = { p, u };
    };
    mk('bright', FS_BRIGHT, ['src']);
    mk('blur', FS_BLUR, ['src', 'dir']);
    mk('copy', FS_COPY, ['src']);
    mk('final', FS_FINAL, ['src', 'bloomA', 'bloomB', 'srcSize', 'outSize', 'bloomAmt', 'crt', 'aberr', 'waves']);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.srcTex = this.texture(gl, 1, 1);
  }

  private texture(gl: WebGLRenderingContext, w: number, h: number) {
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    return t;
  }
  private target(gl: WebGLRenderingContext, w: number, h: number): Target {
    const tex = this.texture(gl, w, h);
    const fb = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { tex, fb, w, h };
  }
  private ensureTargets(gl: WebGLRenderingContext, w: number, h: number) {
    if (w === this.tw && h === this.th) return;
    for (const t of [...this.half, ...this.quarter]) { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fb); }
    const hw = Math.ceil(w / 2), hh = Math.ceil(h / 2), qw = Math.ceil(w / 4), qh = Math.ceil(h / 4);
    this.half = [this.target(gl, hw, hh), this.target(gl, hw, hh)];
    this.quarter = [this.target(gl, qw, qh), this.target(gl, qw, qh)];
    this.tw = w; this.th = h;
  }

  private pass(prog: string, to: Target | null, tex: WebGLTexture, set?: (u: Record<string, WebGLUniformLocation | null>) => void) {
    const gl = this.gl!;
    const P = this.progs[prog];
    gl.useProgram(P.p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, to ? to.fb : null);
    gl.viewport(0, 0, to ? to.w : this.display.width, to ? to.h : this.display.height);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(P.u.src, 0);
    set?.(P.u);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  present(src: HTMLCanvasElement, o: { bloom: boolean; crt: boolean }) {
    if (!this.ok) {
      const c = this.ctx2d;
      if (!c) return;
      c.imageSmoothingEnabled = false;
      c.drawImage(src, 0, 0, this.display.width, this.display.height);
      return;
    }
    const gl = this.gl!;
    const w = src.width, h = src.height;
    gl.bindTexture(gl.TEXTURE_2D, this.srcTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    this.ensureTargets(gl, w, h);
    const [h0, h1] = this.half, [q0, q1] = this.quarter;
    if (o.bloom) {
      this.pass('bright', h0, this.srcTex);
      this.pass('blur', h1, h0.tex, (u) => gl.uniform2f(u.dir, 1 / h0.w, 0));
      this.pass('blur', h0, h1.tex, (u) => gl.uniform2f(u.dir, 0, 1 / h0.h));
      this.pass('copy', q0, h0.tex);
      this.pass('blur', q1, q0.tex, (u) => gl.uniform2f(u.dir, 1.5 / q0.w, 0));
      this.pass('blur', q0, q1.tex, (u) => gl.uniform2f(u.dir, 0, 1.5 / q0.h));
    }
    const wb = this.waveBuf;
    wb.fill(0);
    postFx.waves.slice(0, MAX_WAVES).forEach((wv, i) => { wb[i * 4] = wv.x; wb[i * 4 + 1] = h - wv.y; wb[i * 4 + 2] = wv.r; wb[i * 4 + 3] = wv.s; });
    this.pass('final', null, this.srcTex, (u) => {
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, h0.tex); gl.uniform1i(u.bloomA, 1);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, q0.tex); gl.uniform1i(u.bloomB, 2);
      gl.activeTexture(gl.TEXTURE0);
      gl.uniform2f(u.srcSize, w, h);
      gl.uniform2f(u.outSize, this.display.width, this.display.height);
      gl.uniform1f(u.bloomAmt, o.bloom ? 0.8 * postFx.bloomBoost : 0);
      gl.uniform1f(u.crt, o.crt ? 1 : 0);
      gl.uniform1f(u.aberr, postFx.aberr);
      gl.uniform4fv(u.waves, wb);
    });
  }
}
