import { useEffect } from 'react';
import { useStudio, images, effectiveSteps, freshPipelineState } from './studio.js';
import { pool, createLatestChannel } from '../lib/workerPool.js';
import { FILTERS } from '../lib/filters.js';
import { computeHistogram } from '../lib/histogram.js';
import {
  FULL_MAX,
  GRID_MAX,
  ICON_MAX,
  PREVIEW_MAX,
  canvasToBlob,
  decodeImage,
  downloadBlob,
  imageDataToCanvas,
  toImageData,
} from '../lib/imageIO.js';

export const SAMPLE_URL = '/map-background.png';
const SAMPLE_NAME = 'Map Background.png';

/**
 * Monotonic id of the most recent load. It doubles as the store's `sourceVersion` and tags every
 * source uploaded to the workers, so a slower, older load can never overwrite a newer one and a
 * render of one image can never be shown against another.
 */
let loadToken = 0;

export async function ingestBlob(blob, name, { keepPipeline = false } = {}) {
  const token = ++loadToken;
  const isCurrent = () => token === loadToken;
  const hadSource = !!useStudio.getState().source;
  if (!hadSource) useStudio.setState({ status: 'loading', error: null });
  try {
    if (blob.type && !blob.type.startsWith('image/')) throw new Error('That file is not an image.');
    const bitmap = await decodeImage(blob);
    const originalWidth = bitmap.naturalWidth || bitmap.width;
    const originalHeight = bitmap.naturalHeight || bitmap.height;
    const full = toImageData(bitmap, FULL_MAX);
    const preview = toImageData(bitmap, PREVIEW_MAX);
    const grid = toImageData(bitmap, GRID_MAX);
    const icon = toImageData(bitmap, ICON_MAX);
    bitmap.close?.();
    if (!isCurrent()) return;

    await Promise.all([pool.setSource('preview', preview, token), pool.setSource('grid', grid, token), pool.setSource('icon', icon, token)]);
    if (!isCurrent()) return;
    Object.assign(images, { full, original: preview, grid, icon, processed: null });

    useStudio.setState(() => ({
      ...(keepPipeline ? {} : freshPipelineState()),
      source: {
        name,
        size: blob.size,
        width: preview.width,
        height: preview.height,
        fullWidth: full.width,
        fullHeight: full.height,
        originalWidth,
        originalHeight,
      },
      sourceVersion: token,
      status: 'ready',
      error: null,
      histogram: null,
      lastMs: null,
      hover: null,
      pinned: { x: preview.width >> 1, y: preview.height >> 1 },
      originalHistogram: computeHistogram(preview.data),
      thumbs: {},
    }));
    if (hadSource) useStudio.getState().notify(`Loaded ${name}`);
    generateThumbs();
  } catch (err) {
    console.error(err);
    if (!isCurrent()) return;
    const message = err?.message || 'Could not load that image.';
    if (hadSource) useStudio.getState().notify(message, 'error');
    else useStudio.setState({ status: 'error', error: message });
  }
}

export function openFilePicker() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = () => {
    const file = input.files?.[0];
    if (file) ingestBlob(file, file.name);
  };
  input.click();
}

export async function loadSample({ keepPipeline = false } = {}) {
  try {
    const res = await fetch(SAMPLE_URL);
    if (!res.ok) throw new Error(`Sample image missing (${res.status})`);
    await ingestBlob(await res.blob(), SAMPLE_NAME, { keepPipeline });
  } catch (err) {
    useStudio.setState({ status: 'error', error: err.message });
  }
}

async function generateThumbs() {
  const ids = FILTERS.filter((f) => !f.hidden).map((f) => f.id);
  try {
    const res = await pool.post(pool.auxIndex, { type: 'thumbs', key: 'icon', filterIds: ids });
    if (res.sourceVersion !== useStudio.getState().sourceVersion) return;
    const canvas = document.createElement('canvas');
    const thumbs = {};
    for (const r of res.results) {
      imageDataToCanvas(new ImageData(new Uint8ClampedArray(r.buffer), res.width, res.height), canvas);
      thumbs[r.id] = canvas.toDataURL('image/png');
    }
    useStudio.setState({ thumbs });
  } catch (err) {
    console.error(err);
  }
}

export const EXPORT_FORMATS = {
  png: { mime: 'image/png', ext: 'png', label: 'PNG', lossy: false },
  jpg: { mime: 'image/jpeg', ext: 'jpg', label: 'JPG', lossy: true },
  webp: { mime: 'image/webp', ext: 'webp', label: 'WebP', lossy: true },
};

export async function exportImage({ format, quality, scope, filename }) {
  const st = useStudio.getState();
  const fmt = EXPORT_FORMATS[format];
  let data = images.processed;
  if (scope === 'full' && images.full && images.full.width !== images.original.width) {
    const copy = new Uint8ClampedArray(images.full.data);
    const res = await pool.post(
      pool.auxIndex,
      {
        type: 'process',
        width: images.full.width,
        height: images.full.height,
        buffer: copy.buffer,
        steps: effectiveSteps(st),
        adjustments: st.adjustments,
        scale: images.full.width / images.original.width,
      },
      [copy.buffer],
    );
    data = new ImageData(new Uint8ClampedArray(res.buffer), res.width, res.height);
  }
  if (!data) throw new Error('Nothing to export yet.');

  let canvas = imageDataToCanvas(data);
  if (!fmt.lossy || format === 'webp') {
    // keep alpha
  } else {
    const flat = document.createElement('canvas');
    flat.width = canvas.width;
    flat.height = canvas.height;
    const ctx = flat.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, flat.width, flat.height);
    ctx.drawImage(canvas, 0, 0);
    canvas = flat;
  }
  const blob = await canvasToBlob(canvas, fmt.mime, fmt.lossy ? quality : undefined);
  const base = (filename || 'pixelmind').replace(/\.[a-z0-9]+$/i, '').replace(/[^\w.-]+/g, '-') || 'pixelmind';
  downloadBlob(blob, `${base}.${fmt.ext}`);
  return { blob, width: data.width, height: data.height };
}

/** Subscribes to pipeline/adjustment changes and renders the preview in worker 0. */
let sampleRequested = false;

export function useProcessingEngine() {
  useEffect(() => {
    // StrictMode mounts effects twice in development; load the sample only once.
    if (sampleRequested) return;
    sampleRequested = true;
    // The first-run sample keeps the demo pipeline; every later image starts from a clean one.
    loadSample({ keepPipeline: true });
  }, []);

  useEffect(() => {
    const request = createLatestChannel(0);
    let raf = 0;
    let lastSig = '';

    const trigger = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(async () => {
        const st = useStudio.getState();
        if (!st.source) return;
        const steps = effectiveSteps(st);
        const sig = `${st.sourceVersion}|${JSON.stringify(steps)}|${JSON.stringify(st.adjustments)}`;
        if (sig === lastSig) return;
        lastSig = sig;
        useStudio.setState({ processing: true });
        const res = await request({ type: 'run', key: 'preview', steps, adjustments: st.adjustments, histogram: true, cache: true });
        if (!res) return;
        // The worker rendered a different image than the one on screen (a new upload landed mid-render).
        // Discard it; the sourceVersion change schedules a fresh render of the current image.
        if (res.sourceVersion !== useStudio.getState().sourceVersion) return;
        images.processed = new ImageData(new Uint8ClampedArray(res.buffer), res.width, res.height);
        useStudio.setState((s) => ({
          processedVersion: s.processedVersion + 1,
          histogram: res.hist,
          processing: false,
          lastMs: res.ms,
        }));
      });
    };

    const unsub = useStudio.subscribe((s, prev) => {
      if (
        s.steps !== prev.steps ||
        s.adjustments !== prev.adjustments ||
        s.lab !== prev.lab ||
        s.rightTab !== prev.rightTab ||
        s.sourceVersion !== prev.sourceVersion
      ) {
        trigger();
      }
    });
    trigger();
    return () => {
      unsub();
      cancelAnimationFrame(raf);
    };
  }, []);
}
