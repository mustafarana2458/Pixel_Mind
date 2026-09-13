import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { useStudio, images } from '../store/studio.js';
import { pool, createLatestChannel } from '../lib/workerPool.js';
import { CATEGORIES, FILTERS, FILTER_MAP, defaultParams } from '../lib/filters.js';
import { imageDataToCanvas } from '../lib/imageIO.js';
import { IconButton, Select, Spinner, Toggle } from './ui.jsx';

const FILTER_GROUPS = CATEGORIES.map((c) => ({
  label: c,
  options: FILTERS.filter((f) => !f.hidden && f.category === c).map((f) => ({ value: f.id, label: f.name })),
}));

function GridCell({ index, filterId, request }) {
  const canvasRef = useRef(null);
  const sourceVersion = useStudio((s) => s.sourceVersion);
  const stackSig = useStudio((s) => (s.gridStack ? JSON.stringify(s.steps) : ''));
  const set = useStudio((s) => s.set);
  const addStep = useStudio((s) => s.addStep);
  const [busy, setBusy] = useState(true);
  const [ms, setMs] = useState(null);

  useEffect(() => {
    if (!images.grid || !images.original) return undefined;
    let alive = true;
    const st = useStudio.getState();
    const base = st.gridStack ? st.steps : [];
    setBusy(true);
    request({
      type: 'run',
      key: 'grid',
      steps: [...base, { uid: 'grid', filterId, enabled: true, params: defaultParams(filterId) }],
      scale: images.grid.width / images.original.width,
    }).then((res) => {
      if (!res || !alive || !canvasRef.current) return;
      // Rendered from a different image than the one on screen; the sourceVersion change re-runs this effect.
      if (res.sourceVersion !== useStudio.getState().sourceVersion) return;
      imageDataToCanvas(new ImageData(new Uint8ClampedArray(res.buffer), res.width, res.height), canvasRef.current);
      setMs(res.ms);
      setBusy(false);
    });
    return () => {
      alive = false;
    };
  }, [filterId, sourceVersion, stackSig, request]);

  const changeFilter = (id) => {
    const next = [...useStudio.getState().gridFilters];
    next[index] = id;
    set({ gridFilters: next });
  };

  return (
    <div className="relative flex min-h-0 flex-col overflow-hidden rounded-xl border border-white/[0.06] bg-ink-900 animate-rise" style={{ animationDelay: `${index * 60}ms` }}>
      <div className="flex items-center gap-1.5 border-b border-white/5 bg-ink-850/80 px-1.5 py-1.5">
        <span className="grid size-5 shrink-0 place-items-center rounded-md accent-gradient text-[10px] font-bold text-white">{index + 1}</span>
        <Select value={filterId} onChange={changeFilter} groups={FILTER_GROUPS} className="flex-1" label={`Grid cell ${index + 1} filter`} />
        <IconButton size="sm" icon={Plus} label={`Add ${FILTER_MAP[filterId]?.name} to pipeline`} onClick={() => addStep(filterId)} />
      </div>
      <div className="checkerboard relative min-h-0 flex-1">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full object-contain p-1.5" />
        {busy && (
          <div className="absolute right-2 top-2 rounded-full bg-ink-950/80 p-1.5">
            <Spinner className="size-3" />
          </div>
        )}
        {ms != null && (
          <span className="absolute bottom-2 left-2 rounded bg-ink-950/80 px-1.5 py-0.5 font-mono text-[10px] text-fg-muted">{Math.round(ms)} ms</span>
        )}
      </div>
    </div>
  );
}

export default function CompareGrid() {
  const gridFilters = useStudio((s) => s.gridFilters);
  const gridStack = useStudio((s) => s.gridStack);
  const set = useStudio((s) => s.set);
  const channels = useMemo(() => gridFilters.map((_, i) => createLatestChannel(1 + (i % Math.max(1, pool.size - 1)))), []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="absolute inset-0 z-10 flex flex-col gap-2 bg-ink-950 p-2 animate-fade-in">
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="text-[11px] text-fg-muted">
          Compare 4 filters side by side · rendered in parallel across {pool.size - 1 || 1} worker{pool.size > 2 ? 's' : ''}
        </div>
        <label className="flex items-center gap-2 text-[11px] text-fg-muted">
          <span className="hidden sm:inline">Stack on pipeline</span>
          <span className="sm:hidden">Stack</span>
          <Toggle size="sm" checked={gridStack} onChange={(v) => set({ gridStack: v })} label="Apply on top of the current pipeline" />
        </label>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-2">
        {gridFilters.map((id, i) => (
          <GridCell key={i} index={i} filterId={id} request={channels[i]} />
        ))}
      </div>
    </div>
  );
}
