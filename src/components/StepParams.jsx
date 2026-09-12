import { Copy, FlaskConical, MousePointerClick, RotateCcw, Trash2 } from 'lucide-react';
import { useStudio } from '../store/studio.js';
import { FILTER_MAP, defaultParams, getKernelSpec } from '../lib/filters.js';
import { Button, EmptyState, ParamControl, SectionTitle, Toggle } from './ui.jsx';
import KernelEditor, { cellColor, formatKernelValue } from './KernelEditor.jsx';

function KernelMatrix({ spec }) {
  const maxAbs = Math.max(...spec.kernel.map(Math.abs), 1e-9);
  return (
    <div>
      <div
        className="grid gap-1 rounded-xl border border-white/5 bg-ink-950/60 p-1.5"
        style={{ gridTemplateColumns: `repeat(${spec.size}, minmax(0, 1fr))` }}
      >
        {spec.kernel.map((v, i) => (
          <div
            key={i}
            className="grid h-8 place-items-center rounded-md font-mono text-[11px] text-fg"
            style={{ background: cellColor(v, maxAbs) }}
          >
            {formatKernelValue(v)}
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5 font-mono text-[10px] text-fg-dim">
        <span className="rounded bg-white/5 px-1.5 py-0.5">÷ {formatKernelValue(spec.divisor)}</span>
        {spec.bias ? <span className="rounded bg-white/5 px-1.5 py-0.5">+ {spec.bias}</span> : null}
        <span className="rounded bg-white/5 px-1.5 py-0.5">{spec.mode === 'gray' ? 'luminance' : 'per RGB channel'}</span>
        {spec.post === 'abs' && <span className="rounded bg-white/5 px-1.5 py-0.5">|result| × {spec.gain}</span>}
      </div>
      {spec.note && <p className="mt-2 text-[10px] text-fg-dim">{spec.note}</p>}
    </div>
  );
}

export default function StepParams() {
  const step = useStudio((s) => s.steps.find((st) => st.uid === s.selectedStepId));
  const index = useStudio((s) => s.steps.findIndex((st) => st.uid === s.selectedStepId));
  const updateStepParams = useStudio((s) => s.updateStepParams);
  const resetStepParams = useStudio((s) => s.resetStepParams);
  const toggleStep = useStudio((s) => s.toggleStep);
  const duplicateStep = useStudio((s) => s.duplicateStep);
  const removeStep = useStudio((s) => s.removeStep);
  const loadIntoLab = useStudio((s) => s.loadIntoLab);
  const set = useStudio((s) => s.set);

  if (!step) {
    return (
      <EmptyState
        icon={MousePointerClick}
        title="No step selected"
        action={
          <Button size="sm" onClick={() => set({ leftTab: 'library', drawer: window.innerWidth < 1024 ? 'left' : null })}>
            Open library
          </Button>
        }
      >
        Select a step in the Pipeline, or add a filter from the Library, to tune its parameters here.
      </EmptyState>
    );
  }

  const filter = FILTER_MAP[step.filterId];
  const params = { ...defaultParams(step.filterId), ...step.params };
  const spec = getKernelSpec(step.filterId, params);
  const update = (patch) => updateStepParams(step.uid, patch);

  return (
    <div key={step.uid} className="space-y-6 p-4 animate-fade-in">
      <div>
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-fg-dim">
          <span className="rounded bg-accent/15 px-1.5 py-0.5 font-mono text-accent">Step {index + 1}</span>
          {filter.category}
        </div>
        <div className="mt-2 flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold">{filter.name}</h3>
          <Toggle checked={step.enabled} onChange={() => toggleStep(step.uid)} label={step.enabled ? 'Disable step' : 'Enable step'} />
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-fg-dim">{filter.description}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Button size="sm" icon={RotateCcw} onClick={() => resetStepParams(step.uid)}>
            Reset
          </Button>
          <Button size="sm" icon={Copy} onClick={() => duplicateStep(step.uid)}>
            Duplicate
          </Button>
          <Button size="sm" variant="danger" icon={Trash2} onClick={() => removeStep(step.uid)}>
            Remove
          </Button>
        </div>
      </div>

      {step.filterId === 'customKernel' ? (
        <section>
          <SectionTitle>Kernel</SectionTitle>
          <KernelEditor value={params} onChange={update} />
        </section>
      ) : (
        <>
          <section>
            <SectionTitle>Parameters</SectionTitle>
            {filter.params.length ? (
              <div className="space-y-3.5">
                {filter.params.map((p) => (
                  <ParamControl key={p.key} spec={p} value={params[p.key]} onChange={(v) => update({ [p.key]: v })} />
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-fg-dim">This filter has no parameters.</p>
            )}
          </section>

          <section>
            <SectionTitle
              action={
                spec.kernel && (
                  <Button size="sm" variant="ghost" icon={FlaskConical} onClick={() => loadIntoLab(spec)}>
                    Edit in Lab
                  </Button>
                )
              }
            >
              Kernel
            </SectionTitle>
            {spec.kernel ? (
              <KernelMatrix spec={spec} />
            ) : (
              <p className="rounded-lg border border-white/5 bg-white/[0.02] p-3 text-[11px] leading-relaxed text-fg-dim">{spec.reason}</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
