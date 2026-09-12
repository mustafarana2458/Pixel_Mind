import { memo, useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useStudio } from '../store/studio.js';
import { histogramStats } from '../lib/histogram.js';
import { Segmented, cn } from './ui.jsx';

export const CHANNELS = [
  { key: 'r', label: 'Red', short: 'R', color: '#ee5d5a' },
  { key: 'g', label: 'Green', short: 'G', color: '#52c47e' },
  { key: 'b', label: 'Blue', short: 'B', color: '#5b8def' },
  { key: 'l', label: 'Luma', short: 'L', color: '#c9ced8', dashed: true },
];

const nf = new Intl.NumberFormat();

function HistTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-lg glass-strong px-2.5 py-2 text-[11px]">
      <div className="mb-1 font-mono text-fg">Level {label}</div>
      {CHANNELS.filter((c) => payload.some((p) => p.dataKey === c.key)).map((c) => (
        <div key={c.key} className="flex items-center gap-2">
          <span className="h-0.5 w-3 rounded-full" style={{ background: c.color }} aria-hidden="true" />
          <span className="w-10 text-fg-muted">{c.label}</span>
          <span className="ml-auto font-mono text-fg">{nf.format(row[`${c.key}Raw`])}</span>
        </div>
      ))}
    </div>
  );
}

const Chart = memo(function Chart({ data, visible }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: 6 }}>
        <defs>
          {CHANNELS.map((c) => (
            <linearGradient key={c.key} id={`hist-${c.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={c.color} stopOpacity={0.32} />
              <stop offset="100%" stopColor={c.color} stopOpacity={0.02} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.045)" />
        <XAxis
          dataKey="v"
          type="number"
          domain={[0, 255]}
          ticks={[0, 64, 128, 192, 255]}
          tick={{ fill: '#646b79', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
          axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
          tickLine={false}
          height={20}
        />
        <YAxis hide domain={[0, 'dataMax']} />
        <Tooltip content={<HistTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.35)', strokeWidth: 1 }} isAnimationActive={false} />
        {CHANNELS.filter((c) => visible[c.key]).map((c) => (
          <Area
            key={c.key}
            dataKey={c.key}
            type="linear"
            stroke={c.color}
            strokeWidth={c.dashed ? 1.5 : 1.5}
            strokeDasharray={c.dashed ? '4 3' : undefined}
            fill={c.dashed ? 'none' : `url(#hist-${c.key})`}
            isAnimationActive={false}
            dot={false}
            activeDot={{ r: 3, strokeWidth: 2, stroke: '#0e1117', fill: c.color }}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
});

export default function Histogram() {
  const processed = useStudio((s) => s.histogram);
  const original = useStudio((s) => s.originalHistogram);
  const [which, setWhich] = useState('processed');
  const [scale, setScale] = useState('linear');
  const [visible, setVisible] = useState({ r: true, g: true, b: true, l: true });
  const hist = which === 'processed' ? processed : original;

  const data = useMemo(() => {
    if (!hist) return [];
    const rows = new Array(256);
    for (let v = 0; v < 256; v++) {
      const row = { v };
      for (const c of CHANNELS) {
        const n = hist[c.key][v];
        row[c.key] = scale === 'log' ? Math.log1p(n) : n;
        row[`${c.key}Raw`] = n;
      }
      rows[v] = row;
    }
    return rows;
  }, [hist, scale]);

  const stats = useMemo(() => histogramStats(hist), [hist]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        <div className="flex items-center gap-1" role="group" aria-label="Visible channels">
          {CHANNELS.map((c) => (
            <button
              key={c.key}
              type="button"
              aria-pressed={visible[c.key]}
              onClick={() => setVisible((v) => ({ ...v, [c.key]: !v[c.key] }))}
              className={cn(
                'flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-[11px] transition-colors',
                visible[c.key] ? 'border-white/10 bg-white/[0.05] text-fg' : 'border-transparent text-fg-dim hover:text-fg-muted',
              )}
            >
              <span
                className="h-0.5 w-3 rounded-full"
                style={{
                  background: c.dashed ? `repeating-linear-gradient(90deg, ${c.color} 0 3px, transparent 3px 5px)` : c.color,
                  opacity: visible[c.key] ? 1 : 0.35,
                }}
                aria-hidden="true"
              />
              {c.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <Segmented
            size="sm"
            value={which}
            onChange={setWhich}
            options={[
              { value: 'processed', label: 'Processed' },
              { value: 'original', label: 'Original' },
            ]}
          />
          <Segmented
            size="sm"
            value={scale}
            onChange={setScale}
            options={[
              { value: 'linear', label: 'Lin' , title: 'Linear scale' },
              { value: 'log', label: 'Log', title: 'Logarithmic scale' },
            ]}
          />
        </div>
      </div>

      <div className="relative min-h-[110px] flex-1">
        {hist ? <Chart data={data} visible={visible} /> : <div className="skeleton absolute inset-0 rounded-lg" />}
      </div>

      <div className="mt-1.5 grid grid-cols-5 gap-1 border-t border-white/5 pt-1.5">
        {[
          ['Mean', stats ? stats.mean.toFixed(1) : '—'],
          ['Median', stats ? stats.median : '—'],
          ['Std dev', stats ? stats.std.toFixed(1) : '—'],
          ['Clip ▼', stats ? `${(stats.clipLow * 100).toFixed(1)}%` : '—'],
          ['Clip ▲', stats ? `${(stats.clipHigh * 100).toFixed(1)}%` : '—'],
        ].map(([label, value]) => (
          <div key={label} className="min-w-0">
            <div className="truncate text-[9px] uppercase tracking-wider text-fg-dim">{label}</div>
            <div className="font-mono text-[11px] text-fg">{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
