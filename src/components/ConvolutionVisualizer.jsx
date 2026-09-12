import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Info, MousePointerClick, Pause, Play, RotateCcw } from 'lucide-react';
import { useStudio, images } from '../store/studio.js';
import { FILTER_MAP, getKernelSpec, luminance } from '../lib/filters.js';
import { EmptyState, IconButton, Segmented, cn } from './ui.jsx';
import { formatKernelValue } from './KernelEditor.jsx';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const fmt = (v) => formatKernelValue(Math.round(v * 1000) / 1000);
const CELL_PX = { 2: 60, 3: 60, 5: 50, 7: 42 };
const CHANNEL_NAMES = ['R', 'G', 'B'];

function computeCalc(spec, pinned, channel) {
  const img = images.original;
  if (!img || !pinned || !spec?.kernel) return null;
  const { size, kernel, divisor = 1, bias = 0, mode, post, gain = 1, strength = 1 } = spec;
  const half = (size - 1) >> 1;
  const cells = [];
  let sum = 0;
  for (let ky = 0; ky < size; ky++) {
    for (let kx = 0; kx < size; kx++) {
      const sx = clamp(pinned.x + kx - half, 0, img.width - 1);
      const sy = clamp(pinned.y + ky - half, 0, img.height - 1);
      const i = (sy * img.width + sx) * 4;
      const r = img.data[i];
      const g = img.data[i + 1];
      const b = img.data[i + 2];
      const v = mode === 'gray' ? luminance(r, g, b) : [r, g, b][channel];
      const w = kernel[ky * size + kx];
      const p = v * w;
      sum += p;
      cells.push({ v, w, p, cum: sum, sx, sy, color: `rgb(${r},${g},${b})` });
    }
  }
  const center = cells[half * size + half].v;
  const divided = sum / divisor;
  const stages = [{ label: 'Σ products', value: sum }];
  if (divisor !== 1) stages.push({ label: `÷ ${fmt(divisor)}`, value: divided });
  let out;
  if (post === 'abs') {
    out = Math.abs(divided) * gain;
    stages.push({ label: gain !== 1 ? `|x| × ${fmt(gain)}` : '|x|', value: out });
  } else if (post === 'signed') {
    out = 128 + divided * gain * 0.5;
    stages.push({ label: `128 + x·${fmt(gain / 2)}`, value: out });
  } else {
    out = divided + bias;
    if (bias) stages.push({ label: `${bias > 0 ? '+' : '−'} ${fmt(Math.abs(bias))} bias`, value: out });
    if (strength !== 1) {
      const clamped = clamp(Math.round(out), 0, 255);
      out = center + (clamped - center) * strength;
      stages.push({ label: `mix ${fmt(strength)} with input`, value: out });
    }
  }
  const final = clamp(Math.round(out), 0, 255);
  stages.push({ label: 'clamp 0–255', value: final });
  return { size, cells, sum, stages, final, mode };
}

export default function ConvolutionVisualizer() {
  const pinned = useStudio((s) => s.pinned);
  const sourceVersion = useStudio((s) => s.sourceVersion);
  const selected = useStudio((s) => s.steps.find((x) => x.uid === s.selectedStepId));
  const lab = useStudio((s) => s.lab);
  const [origin, setOrigin] = useState('step');
  const [channel, setChannel] = useState(0);
  const [k, setK] = useState(-1);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const listRef = useRef(null);

  const stepSpec = selected ? getKernelSpec(selected.filterId, selected.params) : null;
  const fellBack = origin === 'step' && !stepSpec?.kernel;
  const useLab = origin === 'lab' || fellBack;
  const spec = useLab ? getKernelSpec('customKernel', lab) : stepSpec;
  const title = useLab ? 'Kernel Lab' : FILTER_MAP[selected.filterId].name;
  const specSig = JSON.stringify(spec);

  const calc = useMemo(
    () => computeCalc(spec, pinned, channel),
    [specSig, pinned?.x, pinned?.y, sourceVersion, channel], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const n = calc?.cells.length ?? 0;

  useEffect(() => setK(-1), [specSig, pinned?.x, pinned?.y, sourceVersion, channel]);

  useEffect(() => {
    if (!playing || !n) return undefined;
    const interval = Math.max(35, (n > 25 ? 220 : n > 9 ? 320 : 480) / speed);
    const id = setInterval(() => setK((i) => (i >= n + 5 ? -1 : i + 1)), interval);
    return () => clearInterval(id);
  }, [playing, n, speed]);

  useEffect(() => {
    const list = listRef.current;
    const el = list?.querySelector('[data-current="true"]');
    if (list && el) list.scrollTop = el.offsetTop - list.clientHeight / 2 + el.clientHeight / 2;
  }, [k]);

  if (!pinned || !images.original) {
    return (
      <EmptyState icon={MousePointerClick} title="Pick a pixel">
        Click anywhere on the image to see the kernel × neighborhood calculation for that pixel.
      </EmptyState>
    );
  }

  const cur = Math.min(k, n);
  const done = k >= n;
  const current = k >= 0 && k < n ? calc.cells[k] : null;
  const runningSum = k < 0 ? 0 : calc.cells[Math.min(k, n - 1)].cum;
  const cellPx = CELL_PX[calc.size] ?? 42;
  const outColor =
    calc.mode === 'gray'
      ? `rgb(${calc.final},${calc.final},${calc.final})`
      : `rgb(${channel === 0 ? calc.final : 0},${channel === 1 ? calc.final : 0},${channel === 2 ? calc.final : 0})`;

  return (
    <div className="flex min-h-0 flex-col gap-4 xl:flex-row">
      <div className="flex shrink-0 flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            size="sm"
            value={origin}
            onChange={setOrigin}
            options={[
              { value: 'step', label: 'Selected step' },
              { value: 'lab', label: 'Kernel Lab' },
            ]}
          />
          {calc.mode === 'gray' ? (
            <span className="rounded-md bg-white/[0.06] px-2 py-1 text-[11px] text-fg-muted">Luminance</span>
          ) : (
            <Segmented size="sm" value={channel} onChange={setChannel} options={CHANNEL_NAMES.map((label, value) => ({ value, label, title: `${label} channel` }))} />
          )}
        </div>

        <div className="thin-scroll overflow-x-auto">
          <div className="inline-grid gap-1 rounded-xl border border-white/5 bg-ink-950/60 p-1.5" style={{ gridTemplateColumns: `repeat(${calc.size}, ${cellPx}px)` }}>
            {calc.cells.map((c, i) => {
              const isCurrent = i === k;
              const isDone = i < cur;
              const isCenter = i === ((calc.size - 1) >> 1) * calc.size + ((calc.size - 1) >> 1);
              return (
                <div
                  key={i}
                  className={cn(
                    'relative flex flex-col justify-between rounded-md border p-1 font-mono transition-all duration-200',
                    isCurrent
                      ? 'z-10 scale-110 border-accent bg-accent/25 shadow-[0_0_0_3px_rgba(107,123,255,0.25),0_8px_20px_-6px_rgba(107,123,255,0.6)]'
                      : isDone || done
                        ? 'border-accent/25 bg-accent/[0.07]'
                        : 'border-white/[0.06] bg-ink-900/70',
                    c.w === 0 && !isCurrent && 'opacity-60',
                  )}
                  style={{ width: cellPx, height: cellPx }}
                  title={`(${c.sx}, ${c.sy})  ${Math.round(c.v)} × ${fmt(c.w)} = ${fmt(c.p)}`}
                >
                  <div className="flex items-center justify-between gap-0.5">
                    <span className={cn('size-2.5 shrink-0 rounded-sm border', isCenter ? 'border-white' : 'border-white/20')} style={{ background: c.color }} />
                    <span className="truncate text-[8px] text-fg-dim">×{fmt(c.w)}</span>
                  </div>
                  <div className="text-center text-[11px] leading-none text-fg">{Math.round(c.v)}</div>
                  <div className={cn('truncate text-center text-[8px] leading-none', isDone || isCurrent || done ? 'text-fg-muted' : 'text-fg-dim/60')}>
                    {fmt(c.p)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <IconButton size="sm" icon={RotateCcw} label="Restart" onClick={() => setK(-1)} />
          <IconButton
            size="sm"
            icon={ChevronLeft}
            label="Previous term"
            onClick={() => {
              setPlaying(false);
              setK((i) => Math.max(-1, Math.min(i, n) - 1));
            }}
          />
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? 'Pause' : 'Play'}
            className="grid size-7 place-items-center rounded-full accent-gradient text-white shadow-md shadow-accent/30 transition-transform active:scale-95"
          >
            {playing ? <Pause size={13} /> : <Play size={13} className="translate-x-px" />}
          </button>
          <IconButton
            size="sm"
            icon={ChevronRight}
            label="Next term"
            onClick={() => {
              setPlaying(false);
              setK((i) => Math.min(n, i + 1));
            }}
          />
          <div className="ml-2 flex items-center gap-1.5">
            <span className="text-[10px] text-fg-dim">Speed</span>
            <Segmented
              size="sm"
              value={speed}
              onChange={setSpeed}
              options={[
                { value: 0.5, label: '½×' },
                { value: 1, label: '1×' },
                { value: 3, label: '3×' },
              ]}
            />
          </div>
        </div>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
          <span className="font-medium text-fg">{title}</span>
          <span className="font-mono text-fg-dim">
            {calc.size}×{calc.size} · pixel ({pinned.x}, {pinned.y})
          </span>
          {fellBack && selected && (
            <span className="flex items-center gap-1 rounded-full bg-amber-400/10 px-2 py-0.5 text-[10px] text-amber-200/90" title={stepSpec?.reason}>
              <Info size={10} /> {FILTER_MAP[selected.filterId].name} has no kernel — showing Kernel Lab
            </span>
          )}
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg border border-white/5 bg-white/[0.025] p-2.5">
            <div className="text-[9px] uppercase tracking-wider text-fg-dim">Current term {current ? `${k + 1}/${n}` : ''}</div>
            <div key={k} className="mt-1 font-mono text-sm text-fg animate-fade-in">
              {current ? (
                <>
                  {Math.round(current.v)} <span className="text-fg-dim">×</span> {fmt(current.w)} <span className="text-fg-dim">=</span>{' '}
                  <span className="text-accent">{fmt(current.p)}</span>
                </>
              ) : done ? (
                <span className="text-fg-muted">All {n} terms summed</span>
              ) : (
                <span className="text-fg-dim">Ready…</span>
              )}
            </div>
          </div>
          <div className="rounded-lg border border-white/5 bg-white/[0.025] p-2.5">
            <div className="flex items-center justify-between text-[9px] uppercase tracking-wider text-fg-dim">
              <span>Running Σ</span>
              <span className="font-mono normal-case">{Math.max(0, cur)}/{n}</span>
            </div>
            <div className="mt-1 font-mono text-sm text-fg">{fmt(runningSum)}</div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/5">
              <div className="h-full rounded-full accent-gradient transition-[width] duration-200" style={{ width: `${(Math.max(0, cur) / n) * 100}%` }} />
            </div>
          </div>
        </div>

        <div ref={listRef} className="thin-scroll relative max-h-24 min-h-12 overflow-y-auto rounded-lg border border-white/5 bg-ink-950/50 p-1.5 font-mono text-[10px]">
          {calc.cells.slice(0, Math.max(0, Math.min(k + 1, n))).map((c, i) => (
            <div
              key={i}
              data-current={i === k}
              className={cn('flex gap-3 rounded px-1.5 py-0.5 animate-fade-in', i === k ? 'bg-accent/20 text-fg' : 'text-fg-dim')}
            >
              <span className="w-16 shrink-0">
                ({c.sx},{c.sy})
              </span>
              <span className="flex-1">
                {Math.round(c.v)} × {fmt(c.w)} = {fmt(c.p)}
              </span>
              <span className="text-fg-muted">Σ {fmt(c.cum)}</span>
            </div>
          ))}
          {k < 0 && <div className="px-1.5 py-0.5 text-fg-dim">Terms appear here as the kernel sweeps the neighborhood.</div>}
        </div>

        <div className={cn('flex flex-wrap items-center gap-1.5 rounded-lg border p-2 transition-colors duration-300', done ? 'border-accent/40 bg-accent/[0.08]' : 'border-white/5 bg-white/[0.02]')}>
          {calc.stages.map((s, i) => (
            <div key={i} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight size={11} className="text-fg-dim" />}
              <div className="rounded-md bg-ink-950/60 px-1.5 py-1">
                <div className="text-[8px] uppercase tracking-wider text-fg-dim">{s.label}</div>
                <div className="font-mono text-[11px] text-fg">{done ? fmt(s.value) : '···'}</div>
              </div>
            </div>
          ))}
          <div className="ml-auto flex items-center gap-2 pl-2">
            <span className="text-[10px] text-fg-dim">Output {calc.mode === 'gray' ? 'L' : CHANNEL_NAMES[channel]}</span>
            <span
              className={cn('size-7 rounded-md border border-white/15 transition-all duration-300', done ? 'scale-100 opacity-100' : 'scale-75 opacity-30')}
              style={{ background: outColor }}
              aria-hidden="true"
            />
            <span className="font-mono text-sm text-fg">{done ? calc.final : '—'}</span>
          </div>
        </div>
        <p className="text-[10px] text-fg-dim">
          Reads the source image at preview resolution with edge clamping. {spec.note ?? ''}
        </p>
      </div>
    </div>
  );
}
