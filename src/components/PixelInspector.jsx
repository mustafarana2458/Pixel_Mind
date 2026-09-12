import { useEffect, useRef, useState } from 'react';
import { MousePointer2, Pin } from 'lucide-react';
import { useStudio, images } from '../store/studio.js';
import { luminance } from '../lib/filters.js';
import { toHex } from '../lib/imageIO.js';
import { Segmented, cn } from './ui.jsx';
import { CHANNELS } from './Histogram.jsx';

const GRID = 10;
const CSS_SIZE = 150;

function readPixel(img, x, y) {
  if (!img || x < 0 || y < 0 || x >= img.width || y >= img.height) return null;
  const i = (y * img.width + x) * 4;
  return [img.data[i], img.data[i + 1], img.data[i + 2], img.data[i + 3]];
}

function PixelCard({ title, px }) {
  const lum = px ? Math.round(luminance(px[0], px[1], px[2])) : null;
  const values = px ? [px[0], px[1], px[2], lum] : [null, null, null, null];
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-white/5 bg-white/[0.025] p-2">
      <div
        className="size-9 shrink-0 rounded-md border border-white/10 checkerboard"
        style={px ? { background: `rgb(${px[0]},${px[1]},${px[2]})` } : undefined}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[10px] uppercase tracking-wider text-fg-dim">{title}</span>
          <span className="font-mono text-[11px] text-fg">{px ? toHex(px[0], px[1], px[2]) : '—'}</span>
        </div>
        <div className="mt-1 grid grid-cols-4 gap-2">
          {CHANNELS.map((c, i) => (
            <div key={c.key} className="min-w-0">
              <div className="flex justify-between text-[9px]">
                <span className="text-fg-dim">{c.short}</span>
                <span className="font-mono text-fg-muted">{values[i] ?? '—'}</span>
              </div>
              <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-white/5">
                <div className="h-full rounded-full transition-[width] duration-150" style={{ width: `${((values[i] ?? 0) / 255) * 100}%`, background: c.color }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function PixelInspector() {
  const hover = useStudio((s) => s.hover);
  const pinned = useStudio((s) => s.pinned);
  const processedVersion = useStudio((s) => s.processedVersion);
  const sourceVersion = useStudio((s) => s.sourceVersion);
  const [layer, setLayer] = useState('processed');
  const canvasRef = useRef(null);

  const target = hover ?? pinned;
  const original = target ? readPixel(images.original, target.x, target.y) : null;
  const processed = target ? readPixel(images.processed, target.x, target.y) : null;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const size = Math.round(CSS_SIZE * dpr);
    if (canvas.width !== size) {
      canvas.width = size;
      canvas.height = size;
    }
    const ctx = canvas.getContext('2d');
    const cell = size / GRID;
    ctx.fillStyle = '#0b0d12';
    ctx.fillRect(0, 0, size, size);
    const img = layer === 'processed' ? images.processed : images.original;
    if (!target || !img) return;
    const half = GRID / 2;
    for (let gy = 0; gy < GRID; gy++) {
      for (let gx = 0; gx < GRID; gx++) {
        const px = readPixel(img, target.x + gx - half, target.y + gy - half);
        if (px) {
          ctx.fillStyle = `rgb(${px[0]},${px[1]},${px[2]})`;
          ctx.fillRect(gx * cell, gy * cell, cell, cell);
        } else {
          ctx.fillStyle = (gx + gy) % 2 ? '#11141b' : '#0b0d12';
          ctx.fillRect(gx * cell, gy * cell, cell, cell);
        }
      }
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < GRID; i++) {
      const p = Math.round(i * cell) + 0.5;
      ctx.moveTo(p, 0);
      ctx.lineTo(p, size);
      ctx.moveTo(0, p);
      ctx.lineTo(size, p);
    }
    ctx.stroke();
    const c = half * cell;
    ctx.lineWidth = 3 * dpr;
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.strokeRect(c, c, cell, cell);
    ctx.lineWidth = 1.5 * dpr;
    ctx.strokeStyle = '#ffffff';
    ctx.strokeRect(c, c, cell, cell);
  }, [target?.x, target?.y, layer, processedVersion, sourceVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  const dl = original && processed ? Math.round(luminance(processed[0], processed[1], processed[2]) - luminance(original[0], original[1], original[2])) : null;

  return (
    <div className="flex h-full min-h-0 gap-3">
      <div className="flex shrink-0 flex-col items-center gap-1.5">
        <canvas
          ref={canvasRef}
          className="rounded-lg border border-white/[0.08]"
          style={{ width: CSS_SIZE, height: CSS_SIZE, imageRendering: 'pixelated' }}
          aria-label="10 by 10 magnified pixel neighborhood"
        />
        <Segmented
          size="sm"
          value={layer}
          onChange={setLayer}
          options={[
            { value: 'original', label: 'Orig' },
            { value: 'processed', label: 'Proc' },
          ]}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              'flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
              hover ? 'bg-accent/15 text-accent' : pinned ? 'bg-white/[0.06] text-fg-muted' : 'text-fg-dim',
            )}
          >
            {hover ? <MousePointer2 size={10} /> : <Pin size={10} />}
            {hover ? 'Hover' : pinned ? 'Pinned' : 'Hover the image'}
          </span>
          <span className="font-mono text-[11px] text-fg-muted">
            X <span className="text-fg">{target ? target.x : '—'}</span> · Y <span className="text-fg">{target ? target.y : '—'}</span>
          </span>
        </div>
        <PixelCard title="Original" px={original} />
        <PixelCard title="Processed" px={processed} />
        <div className="flex items-center justify-between px-0.5 text-[10px] text-fg-dim">
          <span>Δ luminance</span>
          <span className="font-mono text-fg-muted">{dl == null ? '—' : `${dl > 0 ? '+' : ''}${dl}`}</span>
        </div>
      </div>
    </div>
  );
}
