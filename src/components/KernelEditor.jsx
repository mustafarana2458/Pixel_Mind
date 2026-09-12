import { useEffect, useRef, useState } from 'react';
import { Crosshair, Eraser, RotateCw } from 'lucide-react';
import { effectiveDivisor } from '../lib/filters.js';
import { resizeKernel, rotateKernel } from '../lib/presets.js';
import { IconButton, NumberField, Segmented, Slider, ToggleRow, cn } from './ui.jsx';

export function formatKernelValue(v) {
  if (Number.isInteger(v)) return String(v);
  const a = Math.abs(v);
  return String(+v.toFixed(a >= 10 ? 1 : a >= 1 ? 2 : 3));
}

export function cellColor(v, maxAbs) {
  if (!v) return 'rgba(255,255,255,0.025)';
  const t = Math.min(1, Math.abs(v) / (maxAbs || 1));
  return v > 0 ? `rgba(107,123,255,${0.1 + t * 0.42})` : `rgba(240,96,122,${0.1 + t * 0.42})`;
}

const CELL_SIZES = {
  2: 'h-11 text-sm',
  3: 'h-11 text-sm',
  5: 'h-9 text-xs',
  7: 'h-8 text-[10px]',
};

function KernelCell({ value, onChange, isCenter, maxAbs, size }) {
  const [draft, setDraft] = useState(formatKernelValue(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(formatKernelValue(value));
  }, [value]);

  const nudge = (delta) => {
    const next = Math.round((value + delta) * 1000) / 1000;
    onChange(next);
    setDraft(formatKernelValue(next));
  };

  return (
    <input
      inputMode="decimal"
      aria-label="Kernel weight"
      value={draft}
      onFocus={(e) => {
        focused.current = true;
        e.target.select();
      }}
      onBlur={() => {
        focused.current = false;
        setDraft(formatKernelValue(value));
      }}
      onChange={(e) => {
        setDraft(e.target.value);
        const n = parseFloat(e.target.value);
        if (Number.isFinite(n)) onChange(n);
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          nudge((e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 0.1 : 1));
        }
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
      className={cn(
        'num-input w-full min-w-0 rounded-md border text-center font-mono text-fg outline-none transition-[background-color,border-color,box-shadow] duration-200 focus:border-accent focus:ring-2 focus:ring-accent/30',
        isCenter ? 'border-white/25' : 'border-white/5',
        CELL_SIZES[size],
      )}
      style={{ background: cellColor(value, maxAbs) }}
    />
  );
}

/** Editable kernel grid with divisor / bias / strength controls. `value` holds kernel params; `onChange` receives a patch. */
export default function KernelEditor({ value, onChange }) {
  const { size, kernel, divisor, bias, strength, normalize } = value;
  const sum = kernel.reduce((a, b) => a + b, 0);
  const maxAbs = Math.max(...kernel.map(Math.abs), 1e-9);
  const effDiv = effectiveDivisor(value);
  const center = (size * size - 1) / 2;

  const identity = () => {
    const k = Array(size * size).fill(0);
    k[center] = 1;
    onChange({ kernel: k });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Segmented
          size="sm"
          value={size}
          onChange={(n) => onChange({ size: n, kernel: resizeKernel(kernel, size, n) })}
          options={[3, 5, 7].map((n) => ({ value: n, label: `${n}×${n}` }))}
        />
        <div className="flex items-center">
          <IconButton size="sm" icon={RotateCw} label="Rotate 90°" onClick={() => onChange({ kernel: rotateKernel(kernel, size) })} />
          <IconButton size="sm" icon={Crosshair} label="Reset to identity" onClick={identity} />
          <IconButton size="sm" icon={Eraser} label="Clear all weights" onClick={() => onChange({ kernel: Array(size * size).fill(0) })} />
        </div>
      </div>

      <div
        className="grid gap-1 rounded-xl border border-white/5 bg-ink-950/60 p-1.5"
        style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
      >
        {kernel.map((v, i) => (
          <KernelCell
            key={`${size}-${i}`}
            value={v}
            size={size}
            maxAbs={maxAbs}
            isCenter={i === center}
            onChange={(nv) => onChange({ kernel: kernel.map((k, j) => (j === i ? nv : k)) })}
          />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-1.5 text-center">
        {[
          ['Σ weights', formatKernelValue(Math.round(sum * 1000) / 1000)],
          ['÷ divisor', formatKernelValue(Math.round(effDiv * 1000) / 1000)],
          ['Gain', formatKernelValue(Math.round((sum / effDiv) * 1000) / 1000)],
        ].map(([label, v]) => (
          <div key={label} className="rounded-lg border border-white/5 bg-white/[0.02] px-2 py-1.5">
            <div className="text-[9px] uppercase tracking-wider text-fg-dim">{label}</div>
            <div className="font-mono text-xs text-fg">{v}</div>
          </div>
        ))}
      </div>

      <ToggleRow label="Normalize" hint="Divide by the kernel sum (1 when sum is 0)" checked={normalize} onChange={(v) => onChange({ normalize: v })} />

      <div className={cn('flex items-center justify-between gap-3 transition-opacity', normalize && 'opacity-40')}>
        <span className="text-[11px] font-medium text-fg-muted">Divisor</span>
        <NumberField
          value={divisor}
          step={0.01}
          decimals={3}
          disabled={normalize}
          label="Divisor"
          onChange={(v) => onChange({ divisor: v === 0 ? 1 : v })}
          className="w-20 border border-white/[0.08] bg-ink-950/60 py-1"
        />
      </div>

      <Slider label="Bias" value={bias} min={-255} max={255} step={1} defaultValue={0} onChange={(v) => onChange({ bias: v })} />
      <Slider label="Strength" value={strength} min={0} max={2} step={0.01} defaultValue={1} unit="×" onChange={(v) => onChange({ strength: v })} />
    </div>
  );
}
