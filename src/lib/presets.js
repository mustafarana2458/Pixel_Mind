const STORAGE_KEY = 'pixelmind.kernelPresets.v1';

const preset = (name, size, kernel, extra = {}) => ({ name, size, kernel, divisor: 1, bias: 0, strength: 1, normalize: true, ...extra });

export const BUILTIN_PRESETS = [
  preset('Identity', 3, [0, 0, 0, 0, 1, 0, 0, 0, 0]),
  preset('Sharpen', 3, [0, -1, 0, -1, 5, -1, 0, -1, 0]),
  preset('Box Blur 3×3', 3, [1, 1, 1, 1, 1, 1, 1, 1, 1]),
  preset('Gaussian 5×5', 5, [1, 4, 6, 4, 1, 4, 16, 24, 16, 4, 6, 24, 36, 24, 6, 4, 16, 24, 16, 4, 1, 4, 6, 4, 1]),
  preset('Unsharp 5×5', 5, [-1, -4, -6, -4, -1, -4, -16, -24, -16, -4, -6, -24, 476, -24, -6, -4, -16, -24, -16, -4, -1, -4, -6, -4, -1]),
  preset('Outline', 3, [-1, -1, -1, -1, 8, -1, -1, -1, -1]),
  preset('Emboss', 3, [-2, -1, 0, -1, 1, 1, 0, 1, 2]),
  preset('Sobel X (color)', 3, [-1, 0, 1, -2, 0, 2, -1, 0, 1], { normalize: false, bias: 128 }),
  preset('LoG Edge 5×5', 5, [0, 0, -1, 0, 0, 0, -1, -2, -1, 0, -1, -2, 16, -2, -1, 0, -1, -2, -1, 0, 0, 0, -1, 0, 0]),
  preset('Motion Diagonal 7×7', 7, Array.from({ length: 49 }, (_, i) => (i % 8 === 0 ? 1 : 0))),
];

export function isValidPreset(p) {
  return (
    p &&
    typeof p.name === 'string' &&
    [3, 5, 7].includes(p.size) &&
    Array.isArray(p.kernel) &&
    p.kernel.length === p.size * p.size &&
    p.kernel.every((v) => Number.isFinite(v))
  );
}

export function sanitizePreset(p) {
  return preset(String(p.name).slice(0, 40), p.size, p.kernel.map(Number), {
    divisor: Number.isFinite(p.divisor) && p.divisor !== 0 ? p.divisor : 1,
    bias: Number.isFinite(p.bias) ? p.bias : 0,
    strength: Number.isFinite(p.strength) ? p.strength : 1,
    normalize: !!p.normalize,
  });
}

export function loadUserPresets() {
  try {
    const v = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(v) ? v.filter(isValidPreset).map(sanitizePreset) : [];
  } catch {
    return [];
  }
}

export function saveUserPresets(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable — presets stay in memory for this session */
  }
}

/** Grow or shrink a square kernel around its center. */
export function resizeKernel(kernel, from, to) {
  const out = Array(to * to).fill(0);
  const off = (to - from) / 2;
  for (let y = 0; y < from; y++) {
    for (let x = 0; x < from; x++) {
      const ny = y + off;
      const nx = x + off;
      if (ny >= 0 && ny < to && nx >= 0 && nx < to) out[ny * to + nx] = kernel[y * from + x];
    }
  }
  return out;
}

export function rotateKernel(kernel, size) {
  const out = Array(size * size).fill(0);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) out[x * size + (size - 1 - y)] = kernel[y * size + x];
  return out;
}
