export function computeHistogram(buf) {
  const r = new Uint32Array(256);
  const g = new Uint32Array(256);
  const b = new Uint32Array(256);
  const l = new Uint32Array(256);
  for (let i = 0; i < buf.length; i += 4) {
    const R = buf[i];
    const G = buf[i + 1];
    const B = buf[i + 2];
    r[R]++;
    g[G]++;
    b[B]++;
    l[Math.min(255, Math.round(0.2126 * R + 0.7152 * G + 0.0722 * B))]++;
  }
  return { r, g, b, l };
}

export function histogramStats(hist) {
  if (!hist) return null;
  let total = 0;
  let sum = 0;
  let sq = 0;
  for (let v = 0; v < 256; v++) {
    const c = hist.l[v];
    total += c;
    sum += c * v;
    sq += c * v * v;
  }
  if (!total) return null;
  const mean = sum / total;
  let acc = 0;
  let median = 0;
  for (let v = 0; v < 256; v++) {
    acc += hist.l[v];
    if (acc >= total / 2) {
      median = v;
      break;
    }
  }
  const clipLow = (hist.l[0] + hist.l[1]) / total;
  const clipHigh = (hist.l[254] + hist.l[255]) / total;
  return { mean, median, std: Math.sqrt(Math.max(0, sq / total - mean * mean)), clipLow, clipHigh };
}
