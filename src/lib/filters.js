/**
 * PixelMind filter library — pure functions over RGBA Uint8ClampedArray buffers.
 * Imported by the processing worker (does the heavy lifting) and by the UI
 * (parameter specs + kernel metadata for the convolution visualizer).
 */

import { blurPlanes, boxBlurPlanes, gaussianKernel1D, planesToRGBA, toPlanes } from './blur.js';

export { gaussianKernel1D };

const LR = 0.2126;
const LG = 0.7152;
const LB = 0.0722;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function luminance(r, g, b) {
  return LR * r + LG * g + LB * b;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function smoothstep(e0, e1, x) {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

function toGray(src, w, h) {
  const n = w * h;
  const g = new Float32Array(n);
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    g[i] = LR * src[j] + LG * src[j + 1] + LB * src[j + 2];
  }
  return g;
}

function grayToRGBA(src, vals, gain, signed) {
  const out = new Uint8ClampedArray(src.length);
  for (let i = 0, j = 0; i < vals.length; i++, j += 4) {
    const v = signed ? 128 + vals[i] * gain * 0.5 : Math.abs(vals[i]) * gain;
    out[j] = v;
    out[j + 1] = v;
    out[j + 2] = v;
    out[j + 3] = src[j + 3];
  }
  return out;
}

/**
 * Precompute the non-zero kernel taps. Border pixels sample with clamped (dx, dy)
 * offsets; interior pixels use flat index deltas with no bounds checks.
 */
function buildTaps(kernel, size, w, scale) {
  const half = (size - 1) >> 1;
  const dx = [];
  const dy = [];
  const wt = [];
  for (let ky = 0; ky < size; ky++) {
    for (let kx = 0; kx < size; kx++) {
      const v = kernel[ky * size + kx];
      if (v) {
        dx.push(kx - half);
        dy.push(ky - half);
        wt.push(v * scale);
      }
    }
  }
  const n = wt.length;
  const off = new Int32Array(n);
  for (let i = 0; i < n; i++) off[i] = dy[i] * w + dx[i];
  return { n, dx: Int32Array.from(dx), dy: Int32Array.from(dy), wt: Float64Array.from(wt), off, lo: half, hi: size - 1 - half };
}

/** Generic 2D convolution on RGB with clamp-to-edge sampling. */
export function convolveRGB(src, w, h, kernel, size, divisor = 1, bias = 0) {
  const { n, dx, dy, wt, off, lo, hi } = buildTaps(kernel, size, w, 1 / (divisor || 1));
  const out = new Uint8ClampedArray(src.length);
  for (let y = 0; y < h; y++) {
    const interiorRow = y >= lo && y < h - hi;
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      const p = row + x;
      if (interiorRow && x >= lo && x < w - hi) {
        for (let k = 0; k < n; k++) {
          const i = (p + off[k]) << 2;
          const c = wt[k];
          r += src[i] * c;
          g += src[i + 1] * c;
          b += src[i + 2] * c;
        }
      } else {
        for (let k = 0; k < n; k++) {
          let sx = x + dx[k];
          let sy = y + dy[k];
          if (sx < 0) sx = 0;
          else if (sx >= w) sx = w - 1;
          if (sy < 0) sy = 0;
          else if (sy >= h) sy = h - 1;
          const i = (sy * w + sx) << 2;
          const c = wt[k];
          r += src[i] * c;
          g += src[i + 1] * c;
          b += src[i + 2] * c;
        }
      }
      const o = p << 2;
      out[o] = r + bias;
      out[o + 1] = g + bias;
      out[o + 2] = b + bias;
      out[o + 3] = src[o + 3];
    }
  }
  return out;
}

/** 2D convolution on a single float channel (used for gradient operators). */
export function convolveGray(gray, w, h, kernel, size, divisor = 1) {
  const { n, dx, dy, wt, off, lo, hi } = buildTaps(kernel, size, w, 1 / (divisor || 1));
  const out = new Float32Array(gray.length);
  for (let y = 0; y < h; y++) {
    const interiorRow = y >= lo && y < h - hi;
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let s = 0;
      const p = row + x;
      if (interiorRow && x >= lo && x < w - hi) {
        for (let k = 0; k < n; k++) s += gray[p + off[k]] * wt[k];
      } else {
        for (let k = 0; k < n; k++) {
          let sx = x + dx[k];
          let sy = y + dy[k];
          if (sx < 0) sx = 0;
          else if (sx >= w) sx = w - 1;
          if (sy < 0) sy = 0;
          else if (sy >= h) sy = h - 1;
          s += gray[sy * w + sx] * wt[k];
        }
      }
      out[p] = s;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Kernels
// ---------------------------------------------------------------------------

export const KERNELS = {
  identity: [0, 0, 0, 0, 1, 0, 0, 0, 0],
  sobelX: [-1, 0, 1, -2, 0, 2, -1, 0, 1],
  sobelY: [-1, -2, -1, 0, 0, 0, 1, 2, 1],
  prewittX: [-1, 0, 1, -1, 0, 1, -1, 0, 1],
  prewittY: [-1, -1, -1, 0, 0, 0, 1, 1, 1],
  scharrX: [-3, 0, 3, -10, 0, 10, -3, 0, 3],
  scharrY: [-3, -10, -3, 0, 0, 0, 3, 10, 3],
  robertsX: [1, 0, 0, -1],
  robertsY: [0, 1, -1, 0],
  laplacian4: [0, 1, 0, 1, -4, 1, 0, 1, 0],
  laplacian8: [1, 1, 1, 1, -8, 1, 1, 1, 1],
};

const sharpenKernel = (a) => [0, -a, 0, -a, 1 + 4 * a, -a, 0, -a, 0];
const embossKernel = (s) => [-2 * s, -s, 0, -s, 1, s, 0, s, 2 * s];
const edgeEnhanceKernel = (s) => [-s, -s, -s, -s, 1 + 8 * s, -s, -s, -s, -s];

function motionOffsets(length, angle) {
  const n = Math.max(1, Math.round(length));
  const rad = (angle * Math.PI) / 180;
  const cx = Math.cos(rad);
  const cy = Math.sin(rad);
  const ox = new Int32Array(n);
  const oy = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i - (n - 1) / 2;
    ox[i] = Math.round(t * cx);
    oy[i] = Math.round(t * cy);
  }
  return { n, ox, oy };
}

export function effectiveDivisor(p) {
  if (p.normalize) {
    const s = p.kernel.reduce((a, b) => a + b, 0);
    return Math.abs(s) > 1e-9 ? s : 1;
  }
  return p.divisor || 1;
}

// ---------------------------------------------------------------------------
// Filter implementations: (src, w, h, params) => Uint8ClampedArray
// ---------------------------------------------------------------------------

const identity = (src) => new Uint8ClampedArray(src);

function boxBlur(src, w, h, { radius }) {
  const r = Math.max(0, Math.round(radius));
  if (!r) return new Uint8ClampedArray(src);
  return planesToRGBA(boxBlurPlanes(toPlanes(src, w * h), w, h, r), src);
}

function gaussianBlur(src, w, h, { sigma }) {
  return planesToRGBA(blurPlanes(toPlanes(src, w * h), w, h, sigma), src);
}

function motionBlur(src, w, h, { length, angle }) {
  const { n, ox, oy } = motionOffsets(length, angle);
  const inv = 1 / n;
  const out = new Uint8ClampedArray(src.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let i = 0; i < n; i++) {
        let sx = x + ox[i];
        let sy = y + oy[i];
        if (sx < 0) sx = 0;
        else if (sx >= w) sx = w - 1;
        if (sy < 0) sy = 0;
        else if (sy >= h) sy = h - 1;
        const p = (sy * w + sx) << 2;
        r += src[p];
        g += src[p + 1];
        b += src[p + 2];
      }
      const o = (y * w + x) << 2;
      out[o] = r * inv;
      out[o + 1] = g * inv;
      out[o + 2] = b * inv;
      out[o + 3] = src[o + 3];
    }
  }
  return out;
}

const sharpen = (src, w, h, { amount }) => convolveRGB(src, w, h, sharpenKernel(amount), 3);

function unsharpMask(src, w, h, { radius, amount, threshold }) {
  const blurred = blurPlanes(toPlanes(src, w * h), w, h, radius);
  const out = new Uint8ClampedArray(src.length);
  for (let c = 0; c < 3; c++) {
    const plane = blurred[c];
    for (let i = 0, j = c; i < plane.length; i++, j += 4) {
      const d = src[j] - plane[i];
      out[j] = Math.abs(d) >= threshold ? src[j] + amount * d : src[j];
    }
  }
  for (let j = 3; j < src.length; j += 4) out[j] = src[j];
  return out;
}

function emboss(src, w, h, { strength, gray }) {
  const k = embossKernel(strength);
  if (!gray) return convolveRGB(src, w, h, k, 3);
  const g = convolveGray(toGray(src, w, h), w, h, k, 3);
  return grayToRGBA(src, g, 1, false);
}

const edgeEnhance = (src, w, h, { strength }) => convolveRGB(src, w, h, edgeEnhanceKernel(strength), 3);

function gradient(src, w, h, kernel, size, divisor, gain, signed) {
  const g = convolveGray(toGray(src, w, h), w, h, kernel, size, divisor);
  return grayToRGBA(src, g, gain, signed);
}

function magnitude(src, w, h, kx, ky, size, divisor, gain) {
  const gray = toGray(src, w, h);
  const a = convolveGray(gray, w, h, kx, size, divisor);
  const b = convolveGray(gray, w, h, ky, size, divisor);
  for (let i = 0; i < a.length; i++) a[i] = Math.sqrt(a[i] * a[i] + b[i] * b[i]);
  return grayToRGBA(src, a, gain, false);
}

function invert(src, w, h, { amount }) {
  const out = new Uint8ClampedArray(src.length);
  for (let i = 0; i < src.length; i += 4) {
    out[i] = src[i] + (255 - 2 * src[i]) * amount;
    out[i + 1] = src[i + 1] + (255 - 2 * src[i + 1]) * amount;
    out[i + 2] = src[i + 2] + (255 - 2 * src[i + 2]) * amount;
    out[i + 3] = src[i + 3];
  }
  return out;
}

function grayscale(src, w, h, { method, amount }) {
  const out = new Uint8ClampedArray(src.length);
  for (let i = 0; i < src.length; i += 4) {
    const r = src[i];
    const g = src[i + 1];
    const b = src[i + 2];
    let v;
    if (method === 'average') v = (r + g + b) / 3;
    else if (method === 'lightness') v = (Math.max(r, g, b) + Math.min(r, g, b)) / 2;
    else v = LR * r + LG * g + LB * b;
    out[i] = r + (v - r) * amount;
    out[i + 1] = g + (v - g) * amount;
    out[i + 2] = b + (v - b) * amount;
    out[i + 3] = src[i + 3];
  }
  return out;
}

function sepia(src, w, h, { intensity }) {
  const out = new Uint8ClampedArray(src.length);
  for (let i = 0; i < src.length; i += 4) {
    const r = src[i];
    const g = src[i + 1];
    const b = src[i + 2];
    const sr = 0.393 * r + 0.769 * g + 0.189 * b;
    const sg = 0.349 * r + 0.686 * g + 0.168 * b;
    const sb = 0.272 * r + 0.534 * g + 0.131 * b;
    out[i] = r + (sr - r) * intensity;
    out[i + 1] = g + (sg - g) * intensity;
    out[i + 2] = b + (sb - b) * intensity;
    out[i + 3] = src[i + 3];
  }
  return out;
}

function threshold(src, w, h, { level }) {
  const out = new Uint8ClampedArray(src.length);
  for (let i = 0; i < src.length; i += 4) {
    const v = LR * src[i] + LG * src[i + 1] + LB * src[i + 2] >= level ? 255 : 0;
    out[i] = v;
    out[i + 1] = v;
    out[i + 2] = v;
    out[i + 3] = src[i + 3];
  }
  return out;
}

function posterize(src, w, h, { levels }) {
  const n = Math.max(2, Math.round(levels)) - 1;
  const lut = new Uint8ClampedArray(256);
  for (let v = 0; v < 256; v++) lut[v] = (Math.round((v / 255) * n) * 255) / n;
  const out = new Uint8ClampedArray(src.length);
  for (let i = 0; i < src.length; i += 4) {
    out[i] = lut[src[i]];
    out[i + 1] = lut[src[i + 1]];
    out[i + 2] = lut[src[i + 2]];
    out[i + 3] = src[i + 3];
  }
  return out;
}

function pixelate(src, w, h, { size }) {
  const s = Math.max(1, Math.round(size));
  const out = new Uint8ClampedArray(src.length);
  for (let by = 0; by < h; by += s) {
    const ey = Math.min(h, by + s);
    for (let bx = 0; bx < w; bx += s) {
      const ex = Math.min(w, bx + s);
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      const count = (ey - by) * (ex - bx);
      for (let y = by; y < ey; y++) {
        for (let x = bx; x < ex; x++) {
          const p = (y * w + x) << 2;
          r += src[p];
          g += src[p + 1];
          b += src[p + 2];
          a += src[p + 3];
        }
      }
      r /= count;
      g /= count;
      b /= count;
      a /= count;
      for (let y = by; y < ey; y++) {
        for (let x = bx; x < ex; x++) {
          const p = (y * w + x) << 2;
          out[p] = r;
          out[p + 1] = g;
          out[p + 2] = b;
          out[p + 3] = a;
        }
      }
    }
  }
  return out;
}

function vignette(src, w, h, { strength, radius, softness }) {
  const out = new Uint8ClampedArray(src.length);
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  const maxD = Math.hypot(cx, cy) || 1;
  const inner = radius * (1 - softness);
  const outer = radius + 1e-6;
  for (let y = 0; y < h; y++) {
    const dy = y - cy;
    for (let x = 0; x < w; x++) {
      const d = Math.sqrt((x - cx) * (x - cx) + dy * dy) / maxD;
      const f = 1 - strength * smoothstep(inner, outer, d);
      const o = (y * w + x) << 2;
      out[o] = src[o] * f;
      out[o + 1] = src[o + 1] * f;
      out[o + 2] = src[o + 2] * f;
      out[o + 3] = src[o + 3];
    }
  }
  return out;
}

function noise(src, w, h, { amount, mono, seed }) {
  const rand = mulberry32(Math.round(seed) * 9973 + 17);
  const out = new Uint8ClampedArray(src.length);
  for (let i = 0; i < src.length; i += 4) {
    if (mono) {
      const n = (rand() + rand() - 1) * amount;
      out[i] = src[i] + n;
      out[i + 1] = src[i + 1] + n;
      out[i + 2] = src[i + 2] + n;
    } else {
      out[i] = src[i] + (rand() + rand() - 1) * amount;
      out[i + 1] = src[i + 1] + (rand() + rand() - 1) * amount;
      out[i + 2] = src[i + 2] + (rand() + rand() - 1) * amount;
    }
    out[i + 3] = src[i + 3];
  }
  return out;
}

function customKernel(src, w, h, p) {
  const out = convolveRGB(src, w, h, p.kernel, p.size, effectiveDivisor(p), p.bias);
  const s = p.strength ?? 1;
  if (s === 1) return out;
  for (let i = 0; i < out.length; i += 4) {
    out[i] = src[i] + (out[i] - src[i]) * s;
    out[i + 1] = src[i + 1] + (out[i + 1] - src[i + 1]) * s;
    out[i + 2] = src[i + 2] + (out[i + 2] - src[i + 2]) * s;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const CATEGORIES = ['Basic', 'Blur', 'Sharpen & Detail', 'Edge Detection', 'Color', 'Stylize'];

const range = (key, label, min, max, step, def, extra = {}) => ({ type: 'range', key, label, min, max, step, default: def, ...extra });
const gainParam = (def = 1) => range('gain', 'Gain', 0.1, 6, 0.1, def, { unit: '×' });

const POINT_OP = 'Point operation — each output pixel depends only on its own input pixel, so there is no neighborhood kernel.';

const gray3 = (kernel, p, extra = {}) => ({ size: 3, kernel, divisor: 1, bias: 0, mode: 'gray', post: 'abs', gain: p.gain, ...extra });
const rgb3 = (kernel) => ({ size: 3, kernel, divisor: 1, bias: 0, mode: 'rgb', post: 'clamp' });

export const FILTERS = [
  {
    id: 'identity',
    name: 'Identity',
    category: 'Basic',
    description: 'Passes pixels through unchanged — the neutral kernel with a single 1 at the center.',
    params: [],
    run: identity,
    kernel: () => rgb3(KERNELS.identity),
  },
  {
    id: 'boxBlur',
    name: 'Box Blur',
    category: 'Blur',
    description: 'Uniform average over a square window. Implemented with sliding-window sums, so cost is independent of radius.',
    params: [range('radius', 'Radius', 1, 40, 1, 4, { unit: 'px', scales: true })],
    run: boxBlur,
    kernel: (p) => {
      const r = Math.round(p.radius);
      if (r > 3) return { reason: 'Radius > 3 produces a kernel larger than 7×7. Lower the radius to visualize it.' };
      const s = 2 * r + 1;
      return { size: s, kernel: Array(s * s).fill(1), divisor: s * s, bias: 0, mode: 'rgb', post: 'clamp' };
    },
  },
  {
    id: 'gaussianBlur',
    name: 'Gaussian Blur',
    category: 'Blur',
    description: 'Weighted blur following a Gaussian bell curve. Separable passes, with a 3-box approximation for large sigma.',
    params: [range('sigma', 'Sigma', 0.5, 25, 0.5, 3, { unit: 'px', scales: true })],
    run: gaussianBlur,
    kernel: (p) => {
      if (Math.ceil(p.sigma * 3) > 3) return { reason: 'Sigma > 1 needs a kernel larger than 7×7. Set sigma to 1 or below to visualize it.' };
      const k1 = gaussianKernel1D(p.sigma);
      const s = k1.length;
      const kernel = [];
      for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) kernel.push(Math.round(k1[y] * k1[x] * 10000) / 10000);
      return { size: s, kernel, divisor: 1, bias: 0, mode: 'rgb', post: 'clamp' };
    },
  },
  {
    id: 'motionBlur',
    name: 'Motion Blur',
    category: 'Blur',
    description: 'Averages samples along a line at the given angle, simulating camera or subject movement.',
    params: [
      range('length', 'Length', 2, 80, 1, 20, { unit: 'px', scales: true }),
      range('angle', 'Angle', 0, 180, 1, 0, { unit: '°' }),
    ],
    run: motionBlur,
    kernel: (p) => {
      const { n, ox, oy } = motionOffsets(p.length, p.angle);
      let half = 0;
      for (let i = 0; i < n; i++) half = Math.max(half, Math.abs(ox[i]), Math.abs(oy[i]));
      if (half > 3) return { reason: 'Length > 7 produces a line kernel larger than 7×7. Shorten it to visualize.' };
      const s = 2 * half + 1;
      const kernel = Array(s * s).fill(0);
      for (let i = 0; i < n; i++) kernel[(oy[i] + half) * s + ox[i] + half] += 1;
      return { size: s, kernel, divisor: n, bias: 0, mode: 'rgb', post: 'clamp' };
    },
  },
  {
    id: 'sharpen',
    name: 'Sharpen',
    category: 'Sharpen & Detail',
    description: 'Boosts the center pixel against its 4-neighbors to increase local contrast.',
    params: [range('amount', 'Amount', 0, 5, 0.1, 1)],
    run: sharpen,
    kernel: (p) => rgb3(sharpenKernel(p.amount)),
  },
  {
    id: 'unsharpMask',
    name: 'Unsharp Mask',
    category: 'Sharpen & Detail',
    description: 'Adds back the difference between the image and a Gaussian-blurred copy. The photographer’s sharpener.',
    params: [
      range('radius', 'Radius', 0.5, 10, 0.1, 2, { unit: 'px', scales: true }),
      range('amount', 'Amount', 0, 5, 0.1, 1.2),
      range('threshold', 'Threshold', 0, 64, 1, 2),
    ],
    run: unsharpMask,
    kernel: () => ({ reason: 'Unsharp mask = original + amount × (original − Gaussian blur). It combines two passes rather than using a single kernel.' }),
  },
  {
    id: 'emboss',
    name: 'Emboss',
    category: 'Sharpen & Detail',
    description: 'Directional kernel that turns edges into raised relief lit from the top-left.',
    params: [range('strength', 'Strength', 0.1, 4, 0.1, 1), { type: 'toggle', key: 'gray', label: 'Monochrome', default: false }],
    run: emboss,
    kernel: (p) => ({ ...rgb3(embossKernel(p.strength)), mode: p.gray ? 'gray' : 'rgb', post: p.gray ? 'abs' : 'clamp', gain: 1 }),
  },
  {
    id: 'edgeEnhance',
    name: 'Edge Enhance',
    category: 'Sharpen & Detail',
    description: 'Adds an 8-neighbor Laplacian back onto the image to crisp up every edge direction.',
    params: [range('strength', 'Strength', 0, 3, 0.05, 0.5)],
    run: edgeEnhance,
    kernel: (p) => rgb3(edgeEnhanceKernel(p.strength)),
  },
  {
    id: 'sobelX',
    name: 'Sobel X',
    category: 'Edge Detection',
    description: 'Horizontal intensity gradient — responds to vertical edges.',
    params: [gainParam(1), { type: 'toggle', key: 'signed', label: 'Signed (128 = zero)', default: false }],
    run: (src, w, h, p) => gradient(src, w, h, KERNELS.sobelX, 3, 1, p.gain, p.signed),
    kernel: (p) => gray3(KERNELS.sobelX, p, { post: p.signed ? 'signed' : 'abs' }),
  },
  {
    id: 'sobelY',
    name: 'Sobel Y',
    category: 'Edge Detection',
    description: 'Vertical intensity gradient — responds to horizontal edges.',
    params: [gainParam(1), { type: 'toggle', key: 'signed', label: 'Signed (128 = zero)', default: false }],
    run: (src, w, h, p) => gradient(src, w, h, KERNELS.sobelY, 3, 1, p.gain, p.signed),
    kernel: (p) => gray3(KERNELS.sobelY, p, { post: p.signed ? 'signed' : 'abs' }),
  },
  {
    id: 'sobel',
    name: 'Sobel Magnitude',
    category: 'Edge Detection',
    description: 'Gradient magnitude √(Gx² + Gy²) — the classic all-direction edge map.',
    params: [gainParam(1)],
    run: (src, w, h, p) => magnitude(src, w, h, KERNELS.sobelX, KERNELS.sobelY, 3, 1, p.gain),
    kernel: (p) => gray3(KERNELS.sobelX, p, { note: 'Magnitude combines Gx and Gy — showing the Gx component.' }),
  },
  {
    id: 'laplacian',
    name: 'Laplacian',
    category: 'Edge Detection',
    description: 'Second-derivative operator. Highlights rapid intensity change regardless of direction.',
    params: [
      {
        type: 'select',
        key: 'variant',
        label: 'Neighborhood',
        default: '8',
        options: [
          { value: '4', label: '4-neighbor' },
          { value: '8', label: '8-neighbor' },
        ],
      },
      gainParam(2),
    ],
    run: (src, w, h, p) => gradient(src, w, h, p.variant === '4' ? KERNELS.laplacian4 : KERNELS.laplacian8, 3, 1, p.gain, false),
    kernel: (p) => gray3(p.variant === '4' ? KERNELS.laplacian4 : KERNELS.laplacian8, p),
  },
  {
    id: 'prewitt',
    name: 'Prewitt',
    category: 'Edge Detection',
    description: 'Gradient magnitude with uniform (unweighted) difference kernels.',
    params: [gainParam(1)],
    run: (src, w, h, p) => magnitude(src, w, h, KERNELS.prewittX, KERNELS.prewittY, 3, 0.75, p.gain),
    kernel: (p) => gray3(KERNELS.prewittX, p, { divisor: 0.75, note: 'Magnitude combines Gx and Gy — showing the Gx component.' }),
  },
  {
    id: 'scharr',
    name: 'Scharr',
    category: 'Edge Detection',
    description: 'Rotationally more accurate gradient kernel (3-10-3 weights).',
    params: [gainParam(1)],
    run: (src, w, h, p) => magnitude(src, w, h, KERNELS.scharrX, KERNELS.scharrY, 3, 4, p.gain),
    kernel: (p) => gray3(KERNELS.scharrX, p, { divisor: 4, note: 'Magnitude combines Gx and Gy — showing the Gx component.' }),
  },
  {
    id: 'roberts',
    name: 'Roberts Cross',
    category: 'Edge Detection',
    description: 'Tiny 2×2 diagonal difference kernels — fast, sharp, and noise-sensitive.',
    params: [gainParam(2)],
    run: (src, w, h, p) => magnitude(src, w, h, KERNELS.robertsX, KERNELS.robertsY, 2, 1, p.gain),
    kernel: (p) => ({ size: 2, kernel: KERNELS.robertsX, divisor: 1, bias: 0, mode: 'gray', post: 'abs', gain: p.gain, note: 'Magnitude combines both diagonals — showing the first.' }),
  },
  {
    id: 'invert',
    name: 'Invert',
    category: 'Color',
    description: 'Photographic negative: each channel becomes 255 − value.',
    params: [range('amount', 'Amount', 0, 1, 0.01, 1)],
    run: invert,
    kernel: () => ({ reason: POINT_OP }),
  },
  {
    id: 'grayscale',
    name: 'Grayscale',
    category: 'Color',
    description: 'Removes color using a perceptual, average, or lightness formula.',
    params: [
      {
        type: 'select',
        key: 'method',
        label: 'Method',
        default: 'luminosity',
        options: [
          { value: 'luminosity', label: 'Luminosity (Rec. 709)' },
          { value: 'average', label: 'Average' },
          { value: 'lightness', label: 'Lightness' },
        ],
      },
      range('amount', 'Amount', 0, 1, 0.01, 1),
    ],
    run: grayscale,
    kernel: () => ({ reason: POINT_OP }),
  },
  {
    id: 'sepia',
    name: 'Sepia',
    category: 'Color',
    description: 'Warm brown-toned color matrix reminiscent of aged photographs.',
    params: [range('intensity', 'Intensity', 0, 1, 0.01, 1)],
    run: sepia,
    kernel: () => ({ reason: POINT_OP }),
  },
  {
    id: 'threshold',
    name: 'Threshold',
    category: 'Color',
    description: 'Binary black/white split at a luminance level.',
    params: [range('level', 'Level', 0, 255, 1, 128)],
    run: threshold,
    kernel: () => ({ reason: POINT_OP }),
  },
  {
    id: 'posterize',
    name: 'Posterize',
    category: 'Color',
    description: 'Quantizes each channel to a small number of tonal levels.',
    params: [range('levels', 'Levels', 2, 16, 1, 4)],
    run: posterize,
    kernel: () => ({ reason: POINT_OP }),
  },
  {
    id: 'pixelate',
    name: 'Pixelate',
    category: 'Stylize',
    description: 'Replaces square blocks with their average color.',
    params: [range('size', 'Block size', 2, 64, 1, 10, { unit: 'px', scales: true })],
    run: pixelate,
    kernel: () => ({ reason: 'Pixelate averages non-overlapping blocks, so it is not a sliding convolution kernel.' }),
  },
  {
    id: 'vignette',
    name: 'Vignette',
    category: 'Stylize',
    description: 'Darkens the frame edges with a smooth radial falloff.',
    params: [
      range('strength', 'Strength', 0, 1, 0.01, 0.55),
      range('radius', 'Radius', 0.2, 1.5, 0.01, 0.9),
      range('softness', 'Softness', 0.05, 1, 0.01, 0.6),
    ],
    run: vignette,
    kernel: () => ({ reason: 'Vignette is a position-dependent multiply, not a neighborhood kernel.' }),
  },
  {
    id: 'noise',
    name: 'Noise',
    category: 'Stylize',
    description: 'Adds seeded triangular-distributed grain, in color or monochrome.',
    params: [
      range('amount', 'Amount', 0, 120, 1, 30),
      { type: 'toggle', key: 'mono', label: 'Monochrome grain', default: false },
      { type: 'seed', key: 'seed', label: 'Seed', default: 7 },
    ],
    run: noise,
    kernel: () => ({ reason: 'Noise is random per pixel and has no kernel.' }),
  },
  {
    id: 'customKernel',
    name: 'Custom Kernel',
    category: 'Custom',
    hidden: true,
    description: 'User-defined convolution kernel from the Kernel Lab.',
    params: [],
    defaults: { size: 3, kernel: [0, -1, 0, -1, 5, -1, 0, -1, 0], divisor: 1, bias: 0, strength: 1, normalize: true },
    run: customKernel,
    kernel: (p) => ({ size: p.size, kernel: p.kernel, divisor: effectiveDivisor(p), bias: p.bias, mode: 'rgb', post: 'clamp', strength: p.strength }),
  },
];

export const FILTER_MAP = Object.fromEntries(FILTERS.map((f) => [f.id, f]));

export function defaultParams(id) {
  const f = FILTER_MAP[id];
  if (!f) return {};
  if (f.defaults) return structuredClone(f.defaults);
  return Object.fromEntries(f.params.map((p) => [p.key, p.default]));
}

/** Resolution-dependent params (radii, block sizes) are authored at preview scale; rescale for other resolutions. */
export function scaleParams(id, params, factor) {
  const f = FILTER_MAP[id];
  if (!f || factor === 1) return params;
  const out = { ...params };
  for (const p of f.params) {
    if (!p.scales || typeof out[p.key] !== 'number') continue;
    const v = out[p.key] * factor;
    out[p.key] = p.step >= 1 ? Math.max(1, Math.round(v)) : Math.max(0.3, v);
  }
  return out;
}

export function applyFilter(id, src, w, h, params) {
  const f = FILTER_MAP[id];
  if (!f) return src;
  return f.run(src, w, h, { ...defaultParams(id), ...params });
}

export function runSteps(src, w, h, steps, scale = 1) {
  let cur = src;
  for (const s of steps) {
    if (!s.enabled || !FILTER_MAP[s.filterId]) continue;
    cur = applyFilter(s.filterId, cur, w, h, scaleParams(s.filterId, s.params, scale));
  }
  return cur;
}

export function getKernelSpec(id, params) {
  const f = FILTER_MAP[id];
  if (!f) return { reason: 'Unknown filter.' };
  return f.kernel({ ...defaultParams(id), ...params });
}

export function summarizeParams(id, params) {
  const f = FILTER_MAP[id];
  if (!f) return '';
  if (id === 'customKernel') return `${params.size}×${params.size} kernel${params.normalize ? ' · normalized' : ''}`;
  return f.params
    .filter((p) => p.type === 'range' || p.type === 'select')
    .slice(0, 3)
    .map((p) => {
      const v = params[p.key] ?? p.default;
      if (p.type === 'select') return p.options.find((o) => o.value === v)?.label ?? v;
      return `${p.label} ${+Number(v).toFixed(2)}${p.unit && p.unit !== '×' ? p.unit : p.unit === '×' ? '×' : ''}`;
    })
    .join(' · ');
}
