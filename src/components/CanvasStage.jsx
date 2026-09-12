import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ChevronsLeftRight,
  Columns2,
  Cpu,
  Image as ImageIcon,
  ImagePlus,
  LayoutGrid,
  Maximize,
  Minimize,
  Scan,
  Sparkles,
  UploadCloud,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useStudio, images } from '../store/studio.js';
import { ingestBlob, loadSample, openFilePicker } from '../store/engine.js';
import { imageDataToCanvas } from '../lib/imageIO.js';
import { Button, IconButton, Segmented, Spinner, cn } from './ui.jsx';
import CompareGrid from './CompareGrid.jsx';

const VIEW_MODES = [
  { value: 'split', label: 'Split', icon: Columns2, hideLabelOnMobile: true },
  { value: 'single', label: 'Result', icon: Sparkles, hideLabelOnMobile: true },
  { value: 'original', label: 'Original', icon: ImageIcon, hideLabelOnMobile: true },
  { value: 'grid', label: 'Grid', icon: LayoutGrid, hideLabelOnMobile: true },
];

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function StatusChip() {
  const processing = useStudio((s) => s.processing);
  const lastMs = useStudio((s) => s.lastMs);
  return (
    <div
      className="hidden items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.03] px-2 py-1 text-[10px] text-fg-muted md:flex"
      title="Rendering happens in a Web Worker — the UI thread never blocks"
    >
      {processing ? <Spinner className="size-3" /> : <Cpu size={11} className="text-emerald-400/80" />}
      <span className="font-mono">{processing ? 'rendering' : lastMs != null ? `${Math.round(lastMs)} ms` : 'idle'}</span>
    </div>
  );
}

function Pill({ children, className }) {
  return (
    <span className={cn('pointer-events-none absolute top-3 rounded-full bg-ink-950/75 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-fg-muted backdrop-blur-md border border-white/[0.06]', className)}>
      {children}
    </span>
  );
}

export default function CanvasStage() {
  const source = useStudio((s) => s.source);
  const status = useStudio((s) => s.status);
  const error = useStudio((s) => s.error);
  const sourceVersion = useStudio((s) => s.sourceVersion);
  const processedVersion = useStudio((s) => s.processedVersion);
  const viewMode = useStudio((s) => s.viewMode);
  const comparePos = useStudio((s) => s.comparePos);
  const pinned = useStudio((s) => s.pinned);
  const set = useStudio((s) => s.set);

  const wrapRef = useRef(null);
  const stageRef = useRef(null);
  const origRef = useRef(null);
  const procRef = useRef(null);
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });
  const interacted = useRef(false);
  const pointers = useRef(new Map());
  const gesture = useRef(null);
  const lastHover = useRef(null);
  const dividerDrag = useRef(false);
  const [panning, setPanning] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [nativeFs, setNativeFs] = useState(false);
  const [pseudoFs, setPseudoFs] = useState(false);
  const fullscreen = nativeFs || pseudoFs;

  const fit = useCallback(() => {
    const el = stageRef.current;
    const src = useStudio.getState().source;
    if (!el || !src || !el.clientWidth || !el.clientHeight) return;
    const scale = Math.min(el.clientWidth / src.width, el.clientHeight / src.height) * 0.94;
    setView({ scale, x: (el.clientWidth - src.width * scale) / 2, y: (el.clientHeight - src.height * scale) / 2 });
    interacted.current = false;
  }, []);

  const zoomAt = useCallback((px, py, factor) => {
    interacted.current = true;
    setView((v) => {
      const scale = clamp(v.scale * factor, 0.05, 40);
      const k = scale / v.scale;
      return { scale, x: px - (px - v.x) * k, y: py - (py - v.y) * k };
    });
  }, []);

  const zoomCenter = (factor) => {
    const el = stageRef.current;
    if (el) zoomAt(el.clientWidth / 2, el.clientHeight / 2, factor);
  };

  // Draw the original (and a placeholder for the processed layer) whenever a new image arrives.
  useEffect(() => {
    if (!images.original || !origRef.current) return;
    imageDataToCanvas(images.original, origRef.current);
    if (!images.processed) imageDataToCanvas(images.original, procRef.current);
    fit();
  }, [sourceVersion, fit]);

  useEffect(() => {
    if (images.processed && procRef.current) imageDataToCanvas(images.processed, procRef.current);
  }, [processedVersion]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => {
      setStageSize({ w: el.clientWidth, h: el.clientHeight });
      if (!interacted.current) fit();
    });
    ro.observe(el);
    const onWheel = (e) => {
      if (!useStudio.getState().source) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      ro.disconnect();
      el.removeEventListener('wheel', onWheel);
    };
  }, [fit, zoomAt]);

  useEffect(() => {
    const onFs = () => setNativeFs(document.fullscreenElement === wrapRef.current);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  useEffect(() => {
    const t = setTimeout(fit, 80);
    return () => clearTimeout(t);
  }, [fullscreen, fit]);

  useEffect(() => {
    if (!pseudoFs) return undefined;
    const onKey = (e) => e.key === 'Escape' && setPseudoFs(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pseudoFs]);

  const toggleFullscreen = () => {
    const el = wrapRef.current;
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else if (pseudoFs) {
      setPseudoFs(false);
    } else if (el?.requestFullscreen) {
      el.requestFullscreen().catch(() => setPseudoFs(true));
    } else {
      setPseudoFs(true);
    }
  };

  // ---- pointer interaction -------------------------------------------------
  const toImage = (cx, cy) => {
    const r = stageRef.current.getBoundingClientRect();
    const v = viewRef.current;
    return { x: Math.floor((cx - r.left - v.x) / v.scale), y: Math.floor((cy - r.top - v.y) / v.scale) };
  };
  const inside = (p) => source && p.x >= 0 && p.y >= 0 && p.x < source.width && p.y < source.height;
  const updateHover = (cx, cy) => {
    const p = toImage(cx, cy);
    const next = inside(p) ? p : null;
    const prev = lastHover.current;
    if (prev?.x === next?.x && prev?.y === next?.y) return;
    lastHover.current = next;
    set({ hover: next });
  };

  const onPointerDown = (e) => {
    if (!source || (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 1)) return;
    stageRef.current.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    if (pts.length === 1) {
      gesture.current = { type: 'pan', sx: e.clientX, sy: e.clientY, origin: viewRef.current, moved: e.button === 1 };
    } else if (pts.length === 2) {
      const r = stageRef.current.getBoundingClientRect();
      gesture.current = {
        type: 'pinch',
        dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1,
        mx: (pts[0].x + pts[1].x) / 2 - r.left,
        my: (pts[0].y + pts[1].y) / 2 - r.top,
        origin: viewRef.current,
      };
    }
  };

  const onPointerMove = (e) => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (!g) {
      if (e.pointerType === 'mouse') updateHover(e.clientX, e.clientY);
      return;
    }
    if (g.type === 'pan') {
      const dx = e.clientX - g.sx;
      const dy = e.clientY - g.sy;
      if (!g.moved && Math.hypot(dx, dy) > 4) g.moved = true;
      if (g.moved) {
        if (!panning) setPanning(true);
        interacted.current = true;
        setView({ ...g.origin, x: g.origin.x + dx, y: g.origin.y + dy });
      }
      if (e.pointerType === 'mouse') updateHover(e.clientX, e.clientY);
    } else if (g.type === 'pinch' && pointers.current.size >= 2) {
      const pts = [...pointers.current.values()];
      const r = stageRef.current.getBoundingClientRect();
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
      const mx = (pts[0].x + pts[1].x) / 2 - r.left;
      const my = (pts[0].y + pts[1].y) / 2 - r.top;
      const o = g.origin;
      const scale = clamp((o.scale * dist) / g.dist, 0.05, 40);
      const ix = (g.mx - o.x) / o.scale;
      const iy = (g.my - o.y) / o.scale;
      interacted.current = true;
      setView({ scale, x: mx - ix * scale, y: my - iy * scale });
    }
  };

  const onPointerUp = (e) => {
    const g = gesture.current;
    pointers.current.delete(e.pointerId);
    if (g?.type === 'pan' && !g.moved && e.type === 'pointerup') {
      const p = toImage(e.clientX, e.clientY);
      if (inside(p)) set({ pinned: p });
    }
    if (pointers.current.size === 0) {
      gesture.current = null;
      setPanning(false);
    } else if (g?.type === 'pinch') {
      const [pt] = pointers.current.values();
      gesture.current = { type: 'pan', sx: pt.x, sy: pt.y, origin: viewRef.current, moved: true };
    }
  };

  const onPointerLeave = (e) => {
    if (e.pointerType === 'mouse' && !gesture.current) {
      lastHover.current = null;
      set({ hover: null });
    }
  };

  const onKeyDown = (e) => {
    if (!source) return;
    const actions = {
      '+': () => zoomCenter(1.25),
      '=': () => zoomCenter(1.25),
      '-': () => zoomCenter(0.8),
      0: fit,
      1: () => zoomCenter(1 / viewRef.current.scale),
      f: toggleFullscreen,
    };
    const fn = actions[e.key];
    if (fn) {
      e.preventDefault();
      fn();
    }
  };

  // ---- compare divider ----------------------------------------------------
  const moveDivider = (clientX) => {
    const r = stageRef.current.getBoundingClientRect();
    const v = viewRef.current;
    set({ comparePos: clamp((clientX - r.left - v.x) / (source.width * v.scale), 0, 1) });
  };

  // ---- drag & drop ---------------------------------------------------------
  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = [...(e.dataTransfer?.files ?? [])].find((f) => f.type.startsWith('image/'));
    if (file) ingestBlob(file, file.name);
    else useStudio.getState().notify('Drop an image file (PNG, JPG, WebP…)', 'error');
  };

  const dividerX = source ? view.x + comparePos * source.width * view.scale : 0;
  const lineTop = clamp(view.y, 0, stageSize.h);
  const lineBottom = source ? clamp(view.y + source.height * view.scale, 0, stageSize.h) : 0;
  const showDivider = viewMode === 'split' && source && dividerX >= 0 && dividerX <= stageSize.w && lineBottom > lineTop;
  const rendering = view.scale >= 2 ? 'pixelated' : 'auto';
  const marker = Math.max(1, 14 / view.scale);

  return (
    <section
      ref={wrapRef}
      className={cn(
        'glass relative flex h-full min-h-0 flex-col overflow-hidden bg-ink-950',
        pseudoFs ? 'fixed inset-0 z-[80] rounded-none' : 'rounded-2xl',
        fullscreen && 'bg-ink-950',
      )}
      onDragOver={(e) => {
        e.preventDefault();
        if (!dragOver) setDragOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false);
      }}
      onDrop={onDrop}
    >
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-white/5 px-2 sm:px-3">
        <Segmented size="sm" options={VIEW_MODES} value={viewMode} onChange={(v) => set({ viewMode: v })} />
        <StatusChip />
        <div className="ml-auto flex items-center gap-0.5">
          {viewMode !== 'grid' && (
            <>
              <IconButton icon={ZoomOut} label="Zoom out (−)" onClick={() => zoomCenter(0.8)} disabled={!source} />
              <button
                type="button"
                onClick={fit}
                title="Fit to view (0)"
                className="min-w-12 rounded-md px-1 py-1 text-center font-mono text-[11px] text-fg-muted hover:bg-white/5 hover:text-fg"
              >
                {Math.round(view.scale * 100)}%
              </button>
              <IconButton icon={ZoomIn} label="Zoom in (+)" onClick={() => zoomCenter(1.25)} disabled={!source} />
              <IconButton icon={Scan} label="Fit to view (0)" onClick={fit} className="hidden sm:inline-flex" disabled={!source} />
              <button
                type="button"
                onClick={() => zoomCenter(1 / view.scale)}
                title="Actual pixels (1)"
                className="hidden rounded-md px-1.5 py-1 font-mono text-[11px] text-fg-muted hover:bg-white/5 hover:text-fg sm:block"
              >
                1:1
              </button>
            </>
          )}
          <div className="mx-1 h-5 w-px bg-white/[0.08]" />
          <IconButton icon={fullscreen ? Minimize : Maximize} label={fullscreen ? 'Exit fullscreen (F)' : 'Fullscreen (F)'} onClick={toggleFullscreen} />
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          ref={stageRef}
          tabIndex={0}
          aria-label="Image canvas. Scroll or pinch to zoom, drag to pan, click to pin a pixel."
          className={cn('checkerboard absolute inset-0 touch-none select-none overflow-hidden outline-none', viewMode === 'grid' && 'invisible')}
          style={{ cursor: !source ? 'default' : panning ? 'grabbing' : 'crosshair' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={onPointerLeave}
          onDoubleClick={fit}
          onKeyDown={onKeyDown}
        >
          <div
            className={cn('absolute left-0 top-0 origin-top-left', !source && 'hidden')}
            style={{
              width: source?.width ?? 0,
              height: source?.height ?? 0,
              transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale})`,
              boxShadow: '0 30px 80px -20px rgba(0,0,0,0.8)',
            }}
          >
            <canvas ref={origRef} className={cn('absolute inset-0 h-full w-full', viewMode === 'single' && 'invisible')} style={{ imageRendering: rendering }} />
            <canvas
              ref={procRef}
              className={cn('absolute inset-0 h-full w-full', viewMode === 'original' && 'invisible')}
              style={{ imageRendering: rendering, clipPath: viewMode === 'split' ? `inset(0 0 0 ${comparePos * 100}%)` : 'none' }}
            />
            {pinned && source && (
              <div
                className="pointer-events-none absolute rounded-[1px]"
                style={{
                  left: pinned.x + 0.5 - marker / 2,
                  top: pinned.y + 0.5 - marker / 2,
                  width: marker,
                  height: marker,
                  border: `${2 / view.scale}px solid #fff`,
                  boxShadow: `0 0 0 ${1 / view.scale}px rgba(0,0,0,.7), 0 0 0 ${4 / view.scale}px rgba(107,123,255,.55)`,
                }}
              />
            )}
          </div>

          {showDivider && (
            <>
              <div
                className="pointer-events-none absolute w-0.5 -translate-x-1/2 bg-white/90 shadow-[0_0_12px_rgba(0,0,0,0.6)]"
                style={{ left: dividerX, top: lineTop, height: lineBottom - lineTop }}
              />
              <button
                type="button"
                aria-label="Drag to compare original and processed"
                className="absolute grid size-9 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize touch-none place-items-center rounded-full glass-strong text-white ring-1 ring-white/40 transition-[scale] hover:scale-110 active:scale-95"
                style={{ left: dividerX, top: (lineTop + lineBottom) / 2 }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  dividerDrag.current = true;
                }}
                onPointerMove={(e) => {
                  e.stopPropagation();
                  if (dividerDrag.current) moveDivider(e.clientX);
                }}
                onPointerUp={(e) => {
                  e.stopPropagation();
                  dividerDrag.current = false;
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                    e.preventDefault();
                    e.stopPropagation();
                    set({ comparePos: clamp(comparePos + (e.key === 'ArrowLeft' ? -0.02 : 0.02), 0, 1) });
                  }
                }}
              >
                <ChevronsLeftRight size={16} />
              </button>
            </>
          )}

          {source && viewMode === 'split' && (
            <>
              <Pill className="left-3">Original</Pill>
              <Pill className="right-3">Processed</Pill>
            </>
          )}
          {source && viewMode === 'single' && <Pill className="left-3">Processed</Pill>}
          {source && viewMode === 'original' && <Pill className="left-3">Original</Pill>}

          {source && (
            <div className="pointer-events-none absolute bottom-3 left-3 hidden rounded-md bg-ink-950/70 px-2 py-1 text-[10px] text-fg-dim backdrop-blur-md md:block">
              Scroll to zoom · drag to pan · click to pin a pixel · double-click to fit
            </div>
          )}

          {status === 'loading' && !source && (
            <div className="absolute inset-0 grid place-items-center animate-fade-in">
              <div className="flex flex-col items-center gap-3">
                <div className="skeleton h-56 w-40 rounded-xl" />
                <div className="flex items-center gap-2 text-xs text-fg-muted">
                  <Spinner /> Loading sample image…
                </div>
              </div>
            </div>
          )}

          {status === 'error' && !source && (
            <div className="absolute inset-0 grid place-items-center p-6 animate-fade-in">
              <div className="flex max-w-sm flex-col items-center gap-3 text-center">
                <div className="grid size-12 place-items-center rounded-xl border border-rose-400/20 bg-rose-500/10 text-rose-300">
                  <AlertTriangle size={20} />
                </div>
                <div className="text-sm font-medium">Couldn’t load an image</div>
                <div className="text-xs text-fg-dim">{error}</div>
                <div className="flex gap-2">
                  <Button variant="primary" icon={ImagePlus} onClick={openFilePicker}>
                    Open image
                  </Button>
                  <Button onClick={loadSample}>Retry sample</Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {viewMode === 'grid' && <CompareGrid />}

        {dragOver && (
          <div className="pointer-events-none absolute inset-2 z-30 grid place-items-center rounded-xl border-2 border-dashed border-accent bg-accent/10 backdrop-blur-sm animate-fade-in">
            <div className="flex flex-col items-center gap-2 text-sm font-medium text-fg">
              <UploadCloud size={28} className="text-accent" />
              Drop image to open
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
