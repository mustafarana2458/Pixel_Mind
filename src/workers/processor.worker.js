import { applyFilter, runSteps } from '../lib/filters.js';
import { applyAdjustments, isNeutral } from '../lib/adjust.js';
import { computeHistogram } from '../lib/histogram.js';

/** Sources are uploaded once per image and referenced by key, so jobs never copy the input. */
const sources = new Map();
let stamp = 0;

/** Cache of the last filtered (pre-adjustment) result, so dragging an adjustment slider skips the filters. */
let cache = { sig: null, data: null };

function finish(id, width, height, out, withHistogram, t0, sourceVersion) {
  const hist = withHistogram ? computeHistogram(out) : null;
  const transfer = [out.buffer];
  if (hist) transfer.push(hist.r.buffer, hist.g.buffer, hist.b.buffer, hist.l.buffer);
  self.postMessage({ id, ok: true, width, height, buffer: out.buffer, hist, sourceVersion, ms: performance.now() - t0 }, transfer);
}

self.onmessage = (e) => {
  const msg = e.data;
  const t0 = performance.now();
  try {
    switch (msg.type) {
      case 'source': {
        sources.set(msg.key, { data: new Uint8ClampedArray(msg.buffer), width: msg.width, height: msg.height, version: msg.version, stamp: ++stamp });
        // A new image invalidates the cached filter result — drop it so old pixels are never served or kept alive.
        cache = { sig: null, data: null };
        self.postMessage({ id: msg.id, ok: true, sourceVersion: msg.version });
        break;
      }
      case 'run': {
        const s = sources.get(msg.key);
        if (!s) throw new Error(`No source "${msg.key}" loaded`);
        let filtered;
        if (msg.cache) {
          const sig = `${msg.key}|${s.stamp}|${msg.scale ?? 1}|${JSON.stringify(msg.steps)}`;
          if (cache.sig !== sig) cache = { sig, data: runSteps(s.data, s.width, s.height, msg.steps, msg.scale ?? 1) };
          filtered = cache.data;
        } else {
          filtered = runSteps(s.data, s.width, s.height, msg.steps, msg.scale ?? 1);
        }
        const out = filtered.slice();
        if (msg.adjustments && !isNeutral(msg.adjustments)) applyAdjustments(out, msg.adjustments);
        finish(msg.id, s.width, s.height, out, msg.histogram, t0, s.version);
        break;
      }
      case 'process': {
        const data = new Uint8ClampedArray(msg.buffer);
        let out = runSteps(data, msg.width, msg.height, msg.steps, msg.scale ?? 1);
        if (out === data) out = data;
        if (msg.adjustments && !isNeutral(msg.adjustments)) applyAdjustments(out, msg.adjustments);
        finish(msg.id, msg.width, msg.height, out, false, t0);
        break;
      }
      case 'thumbs': {
        const s = sources.get(msg.key);
        if (!s) throw new Error(`No source "${msg.key}" loaded`);
        const results = msg.filterIds.map((fid) => ({ id: fid, buffer: applyFilter(fid, s.data, s.width, s.height, {}).buffer }));
        self.postMessage(
          { id: msg.id, ok: true, width: s.width, height: s.height, sourceVersion: s.version, results },
          results.map((r) => r.buffer),
        );
        break;
      }
      default:
        throw new Error(`Unknown message type "${msg.type}"`);
    }
  } catch (err) {
    self.postMessage({ id: msg.id, ok: false, error: err?.message || String(err) });
  }
};
