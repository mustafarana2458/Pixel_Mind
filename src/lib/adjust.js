/** Global color adjustments, applied after the filter pipeline. */

export const DEFAULT_ADJUSTMENTS = {
  exposure: 0,
  brightness: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  gamma: 1,
  temperature: 0,
  tint: 0,
  saturation: 0,
};

export const ADJUSTMENT_GROUPS = [
  {
    title: 'Light',
    items: [
      { key: 'exposure', label: 'Exposure', min: -3, max: 3, step: 0.05, unit: 'EV' },
      { key: 'brightness', label: 'Brightness', min: -100, max: 100, step: 1 },
      { key: 'contrast', label: 'Contrast', min: -100, max: 100, step: 1 },
      { key: 'highlights', label: 'Highlights', min: -100, max: 100, step: 1 },
      { key: 'shadows', label: 'Shadows', min: -100, max: 100, step: 1 },
      { key: 'gamma', label: 'Gamma', min: 0.2, max: 3, step: 0.01 },
    ],
  },
  {
    title: 'Color',
    items: [
      { key: 'temperature', label: 'Temperature', min: -100, max: 100, step: 1, track: 'linear-gradient(90deg,#4f8ef7,#9aa3b2,#f2b04a)' },
      { key: 'tint', label: 'Tint', min: -100, max: 100, step: 1, track: 'linear-gradient(90deg,#3fb56f,#9aa3b2,#d65cc4)' },
      { key: 'saturation', label: 'Saturation', min: -100, max: 100, step: 1, track: 'linear-gradient(90deg,#8a8f99,#e0564f,#e8b93c,#3fb56f,#4f8ef7)' },
    ],
  },
];

export function isNeutral(a) {
  return Object.keys(DEFAULT_ADJUSTMENTS).every((k) => (a[k] ?? DEFAULT_ADJUSTMENTS[k]) === DEFAULT_ADJUSTMENTS[k]);
}

function smoothstep(e0, e1, x) {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/** Applies adjustments in place. Order: exposure → white balance → brightness → contrast → tone → saturation → gamma. */
export function applyAdjustments(buf, adj) {
  const a = { ...DEFAULT_ADJUSTMENTS, ...adj };
  const exposure = 2 ** a.exposure;
  const brightness = a.brightness * 1.28;
  const c = Math.max(-0.99, Math.min(0.9, a.contrast / 100));
  const contrast = Math.tan(((c + 1) * Math.PI) / 4);
  const temp = a.temperature * 0.3;
  const tint = a.tint * 0.3;
  const shadows = a.shadows / 100;
  const highlights = a.highlights / 100;
  const sat = 1 + a.saturation / 100;
  const doTone = shadows !== 0 || highlights !== 0;

  const gammaLut = new Uint8ClampedArray(256);
  const invGamma = 1 / a.gamma;
  for (let v = 0; v < 256; v++) gammaLut[v] = 255 * (v / 255) ** invGamma;

  for (let i = 0; i < buf.length; i += 4) {
    let r = buf[i] * exposure + temp + tint * 0.5;
    let g = buf[i + 1] * exposure - tint;
    let b = buf[i + 2] * exposure - temp + tint * 0.5;

    r = (r + brightness - 128) * contrast + 128;
    g = (g + brightness - 128) * contrast + 128;
    b = (b + brightness - 128) * contrast + 128;

    if (doTone) {
      const l = Math.min(1, Math.max(0, (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255));
      const delta = shadows * (1 - smoothstep(0, 0.55, l)) * 90 + highlights * smoothstep(0.45, 1, l) * 90;
      r += delta;
      g += delta;
      b += delta;
    }

    if (sat !== 1) {
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      r = l + (r - l) * sat;
      g = l + (g - l) * sat;
      b = l + (b - l) * sat;
    }

    buf[i] = gammaLut[r < 0 ? 0 : r > 255 ? 255 : Math.round(r)];
    buf[i + 1] = gammaLut[g < 0 ? 0 : g > 255 ? 255 : Math.round(g)];
    buf[i + 2] = gammaLut[b < 0 ? 0 : b > 255 ? 255 : Math.round(b)];
  }
  return buf;
}
