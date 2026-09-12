import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Copy, FlaskConical, GripVertical, Image as ImageIcon, Layers, SlidersHorizontal, Sparkles, Trash2 } from 'lucide-react';
import { useStudio, effectiveSteps } from '../store/studio.js';
import { FILTER_MAP, summarizeParams } from '../lib/filters.js';
import { DEFAULT_ADJUSTMENTS } from '../lib/adjust.js';
import { Button, EmptyState, IconButton, Toggle, cn } from './ui.jsx';

function Connector() {
  return <div className="ml-[21px] h-2.5 w-px bg-gradient-to-b from-white/15 to-white/5" aria-hidden="true" />;
}

function Node({ icon: Icon, title, subtitle, accent, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg border border-dashed px-2.5 py-2 text-left',
        accent ? 'border-accent/40 bg-accent/[0.06]' : 'border-white/10 bg-white/[0.02]',
        onClick && 'transition-colors hover:border-white/20',
      )}
    >
      <span className={cn('grid size-6 shrink-0 place-items-center rounded-md', accent ? 'accent-gradient text-white' : 'bg-white/[0.06] text-fg-muted')}>
        <Icon size={13} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-medium text-fg">{title}</span>
        {subtitle && <span className="block truncate font-mono text-[10px] text-fg-dim">{subtitle}</span>}
      </span>
    </Tag>
  );
}

function StepCard({ step, index }) {
  const selected = useStudio((s) => s.selectedStepId === step.uid);
  const selectStep = useStudio((s) => s.selectStep);
  const toggleStep = useStudio((s) => s.toggleStep);
  const duplicateStep = useStudio((s) => s.duplicateStep);
  const removeStep = useStudio((s) => s.removeStep);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: step.uid });
  const filter = FILTER_MAP[step.filterId];

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('relative', isDragging && 'z-20')}
    >
      <div
        className={cn(
          'group flex items-center gap-1.5 rounded-lg border p-1.5 pr-1 transition-[border-color,background-color,box-shadow,opacity] duration-200 animate-rise',
          selected ? 'border-accent/60 bg-accent/10 shadow-[0_0_0_3px_rgba(107,123,255,0.12)]' : 'border-white/[0.07] bg-ink-800/80 hover:border-white/15',
          !step.enabled && 'opacity-55',
          isDragging && 'shadow-2xl shadow-black/60 ring-1 ring-accent/60',
        )}
      >
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Reorder ${filter?.name}`}
          className="touch-none cursor-grab rounded p-1 text-fg-dim hover:bg-white/5 hover:text-fg active:cursor-grabbing"
        >
          <GripVertical size={14} />
        </button>
        <span className="grid size-5 shrink-0 place-items-center rounded-md bg-white/5 font-mono text-[10px] text-fg-muted">{index + 1}</span>
        <button type="button" className="min-w-0 flex-1 px-1 text-left" onClick={() => selectStep(step.uid)}>
          <span className={cn('block truncate text-xs font-medium', step.enabled ? 'text-fg' : 'text-fg-muted line-through decoration-white/30')}>
            {filter?.name ?? step.filterId}
          </span>
          <span className="block truncate font-mono text-[10px] text-fg-dim">{summarizeParams(step.filterId, step.params) || 'No parameters'}</span>
        </button>
        <Toggle size="sm" checked={step.enabled} onChange={() => toggleStep(step.uid)} label={step.enabled ? 'Disable step' : 'Enable step'} />
        <div className="flex transition-opacity lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100">
          <IconButton size="sm" icon={Copy} label="Duplicate" onClick={() => duplicateStep(step.uid)} />
          <IconButton size="sm" icon={Trash2} label="Remove" onClick={() => removeStep(step.uid)} className="hover:!text-rose-300" />
        </div>
      </div>
      <Connector />
    </div>
  );
}

export default function Pipeline() {
  const steps = useStudio((s) => s.steps);
  const source = useStudio((s) => s.source);
  const lastMs = useStudio((s) => s.lastMs);
  const adjustments = useStudio((s) => s.adjustments);
  const labLive = useStudio((s) => effectiveSteps(s) !== s.steps);
  const moveStep = useStudio((s) => s.moveStep);
  const clearSteps = useStudio((s) => s.clearSteps);
  const set = useStudio((s) => s.set);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const changedAdjustments = Object.keys(DEFAULT_ADJUSTMENTS).filter((k) => adjustments[k] !== DEFAULT_ADJUSTMENTS[k]).length;
  const activeCount = steps.filter((s) => s.enabled).length;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-white/5 px-3 py-2.5">
        <div>
          <div className="text-xs font-semibold">Processing chain</div>
          <div className="text-[10px] text-fg-dim">
            {activeCount} of {steps.length} steps active · drag to reorder
          </div>
        </div>
        <Button size="sm" variant="danger" icon={Trash2} onClick={clearSteps} disabled={!steps.length}>
          Clear
        </Button>
      </div>

      <div className="thin-scroll flex-1 min-h-0 overflow-y-auto p-3">
        <Node icon={ImageIcon} title="Source image" subtitle={source ? `${source.width}×${source.height} preview` : 'Loading…'} />
        <Connector />

        {steps.length === 0 ? (
          <>
            <div className="rounded-lg border border-dashed border-white/10">
              <EmptyState icon={Layers} title="Empty pipeline" action={<Button size="sm" onClick={() => set({ leftTab: 'library' })}>Browse filters</Button>}>
                Add filters from the Library. Steps run top to bottom and can be reordered or toggled.
              </EmptyState>
            </div>
            <Connector />
          </>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={({ active, over }) => over && moveStep(active.id, over.id)}>
            <SortableContext items={steps.map((s) => s.uid)} strategy={verticalListSortingStrategy}>
              {steps.map((step, i) => (
                <StepCard key={step.uid} step={step} index={i} />
              ))}
            </SortableContext>
          </DndContext>
        )}

        {labLive && (
          <>
            <Node icon={FlaskConical} title="Kernel Lab" subtitle="live preview" accent />
            <Connector />
          </>
        )}
        <Node
          icon={SlidersHorizontal}
          title="Color adjustments"
          subtitle={changedAdjustments ? `${changedAdjustments} changed` : 'neutral'}
          onClick={() => set({ rightTab: 'adjust' })}
        />
        <Connector />
        <Node icon={Sparkles} title="Output" subtitle={lastMs != null ? `rendered in ${Math.round(lastMs)} ms` : '—'} accent />
      </div>
    </div>
  );
}
