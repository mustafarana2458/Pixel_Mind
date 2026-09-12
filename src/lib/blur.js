/**
 * Cache-friendly blurs on planar float channels, used by Box Blur, Gaussian Blur
 * and Unsharp Mask. Every pass walks rows sequentially (vertical passes keep one
 * accumulator per column) so memory access stays linear.
 */

/** Above this sigma a 3-box approximation replaces the exact separable kernel. */
const EXACT_SIGMA = 1.5;

export function gaussianKernel1D(sigma) {
  const r = Math.max(1, Math.ceil(sigma * 3));
  const k = new Float32Array(2 * r + 1);
  let sum = 0;
  for (let i = -r; i <= r; i++) {
    const v = Math.exp(-(i * i) / (2 * sigma * sigma));
    k[i + r] = v;
    sum += v;
  }
  for (let i = 0; i < k.length; i++) k[i] /= sum;
  return k;
}

function boxesForGauss(sigma, n) {
  const wIdeal = Math.sqrt((12 * sigma * sigma) / n + 1);
  let wl = Math.floor(wIdeal);
  if (wl % 2 === 0) wl--;
  const wu = wl + 2;
  const mIdeal = (12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4);
  const m = Math.round(mIdeal);
  return Array.from({ length: n }, (_, i) => (i < m ? wl : wu));
}

export function toPlanes(src, n) {
  const r = new Float32Array(n);
  const g = new Float32Array(n);
  const b = new Float32Array(n);
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    r[i] = src[j];
    g[i] = src[j + 1];
    b[i] = src[j + 2];
  }
  return [r, g, b];
}

export function planesToRGBA([r, g, b], src) {
  const out = new Uint8ClampedArray(src.length);
  for (let i = 0, j = 0; i < r.length; i++, j += 4) {
    out[j] = r[i];
    out[j + 1] = g[i];
    out[j + 2] = b[i];
    out[j + 3] = src[j + 3];
  }
  return out;
}

function boxH(src, dst, w, h, r) {
  const inv = 1 / (2 * r + 1);
  const last = w - 1;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let acc = 0;
    for (let i = -r; i <= r; i++) acc += src[row + (i < 0 ? 0 : i > last ? last : i)];
    for (let x = 0; x < w; x++) {
      dst[row + x] = acc * inv;
      const add = x + r + 1;
      const sub = x - r;
      acc += src[row + (add > last ? last : add)] - src[row + (sub < 0 ? 0 : sub)];
    }
  }
}

function boxV(src, dst, w, h, r, acc) {
  const inv = 1 / (2 * r + 1);
  const last = h - 1;
  acc.fill(0);
  for (let i = -r; i <= r; i++) {
    const row = (i < 0 ? 0 : i > last ? last : i) * w;
    for (let x = 0; x < w; x++) acc[x] += src[row + x];
  }
  for (let y = 0; y < h; y++) {
    const row = y * w;
    const add = (y + r + 1 > last ? last : y + r + 1) * w;
    const sub = (y - r < 0 ? 0 : y - r) * w;
    for (let x = 0; x < w; x++) {
      dst[row + x] = acc[x] * inv;
      acc[x] += src[add + x] - src[sub + x];
    }
  }
}

function convH(src, dst, w, h, k) {
  const taps = k.length;
  const r = (taps - 1) >> 1;
  const last = w - 1;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let s = 0;
      if (x >= r && x < w - r) {
        const base = row + x - r;
        for (let i = 0; i < taps; i++) s += src[base + i] * k[i];
      } else {
        for (let i = 0; i < taps; i++) {
          const xx = x + i - r;
          s += src[row + (xx < 0 ? 0 : xx > last ? last : xx)] * k[i];
        }
      }
      dst[row + x] = s;
    }
  }
}

function convV(src, dst, w, h, k) {
  const taps = k.length;
  const r = (taps - 1) >> 1;
  const last = h - 1;
  dst.fill(0);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let i = 0; i < taps; i++) {
      const yy = y + i - r;
      const srow = (yy < 0 ? 0 : yy > last ? last : yy) * w;
      const wt = k[i];
      for (let x = 0; x < w; x++) dst[row + x] += src[srow + x] * wt;
    }
  }
}

/** Box blur each plane in place. */
export function boxBlurPlanes(planes, w, h, r) {
  const tmp = new Float32Array(w * h);
  const acc = new Float64Array(w);
  for (const p of planes) {
    boxH(p, tmp, w, h, r);
    boxV(tmp, p, w, h, r, acc);
  }
  return planes;
}

/** Gaussian blur each plane in place. */
export function blurPlanes(planes, w, h, sigma) {
  if (!(sigma > 0)) return planes;
  const tmp = new Float32Array(w * h);
  if (sigma <= EXACT_SIGMA) {
    const k = gaussianKernel1D(sigma);
    for (const p of planes) {
      convH(p, tmp, w, h, k);
      convV(tmp, p, w, h, k);
    }
    return planes;
  }
  const acc = new Float64Array(w);
  const boxes = boxesForGauss(sigma, 3);
  for (const p of planes) {
    for (const size of boxes) {
      const r = (size - 1) >> 1;
      boxH(p, tmp, w, h, r);
      boxV(tmp, p, w, h, r, acc);
    }
  }
  return planes;
}
