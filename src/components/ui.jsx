import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Dices, RotateCcw } from 'lucide-react';

export const cn = (...classes) => classes.filter(Boolean).join(' ');

export function Spinner({ className }) {
  return <span className={cn('inline-block size-3.5 rounded-full border-2 border-white/15 border-t-accent animate-spin', className)} />;
}

export function Button({ variant = 'subtle', size = 'md', icon: Icon, children, className, ...props }) {
  const variants = {
    primary: 'accent-gradient text-white shadow-lg shadow-accent/20 hover:brightness-110',
    subtle: 'bg-white/[0.06] hover:bg-white/10 text-fg border border-white/[0.08]',
    ghost: 'text-fg-muted hover:text-fg hover:bg-white/[0.06]',
    danger: 'text-fg-muted hover:text-rose-300 hover:bg-rose-500/10',
  };
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium whitespace-nowrap transition-all duration-150 active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100',
        size === 'sm' ? 'h-7 px-2.5 text-[11px]' : 'h-8 px-3 text-xs',
        variants[variant],
        className,
      )}
      {...props}
    >
      {Icon && <Icon size={size === 'sm' ? 12 : 14} />}
      {children}
    </button>
  );
}

export function IconButton({ icon: Icon, label, active, size = 'md', className, ...props }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-md transition-colors duration-150 disabled:opacity-40',
        size === 'sm' ? 'size-6' : 'size-8',
        active ? 'bg-accent/15 text-accent' : 'text-fg-muted hover:text-fg hover:bg-white/[0.06]',
        className,
      )}
      {...props}
    >
      <Icon size={size === 'sm' ? 13 : 16} />
    </button>
  );
}

export function Segmented({ options, value, onChange, size = 'md', stretch, className }) {
  return (
    <div
      role="tablist"
      className={cn('p-0.5 rounded-lg bg-ink-950/60 border border-white/5', stretch ? 'flex w-full' : 'inline-flex', className)}
    >
      {options.map((o) => {
        const active = o.value === value;
        const Icon = o.icon;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="tab"
            aria-selected={active}
            title={o.title ?? o.label}
            onClick={() => onChange(o.value)}
            className={cn(
              'flex items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap transition-all duration-200',
              size === 'sm' ? 'px-2 py-1 text-[11px]' : 'px-3 py-1.5 text-xs',
              stretch && 'flex-1',
              active
                ? 'bg-white/10 text-fg shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_4px_12px_-4px_rgba(0,0,0,0.6)]'
                : 'text-fg-muted hover:text-fg',
            )}
          >
            {Icon && <Icon size={size === 'sm' ? 12 : 14} className={active ? 'text-accent' : ''} />}
            {o.label && <span className={o.hideLabelOnMobile ? 'hidden sm:inline' : ''}>{o.label}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function PanelTabs({ tabs, value, onChange, className, children }) {
  return (
    <div className={cn('flex items-end gap-0.5 px-2 pt-2 border-b border-white/5 shrink-0', className)}>
      {tabs.map((t) => {
        const active = t.id === value;
        const Icon = t.icon;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={cn(
              'relative flex items-center gap-1.5 px-2.5 pb-2.5 pt-1.5 text-xs font-medium whitespace-nowrap transition-colors',
              active ? 'text-fg' : 'text-fg-dim hover:text-fg-muted',
            )}
          >
            {Icon && <Icon size={13} className={active ? 'text-accent' : ''} />}
            {t.label}
            {t.badge != null && (
              <span className="ml-0.5 rounded-full bg-white/[0.08] px-1.5 text-[10px] font-mono text-fg-muted">{t.badge}</span>
            )}
            <span
              className={cn(
                'absolute inset-x-2 -bottom-px h-0.5 rounded-full accent-gradient transition-all duration-300',
                active ? 'opacity-100 scale-x-100' : 'opacity-0 scale-x-0',
              )}
            />
          </button>
        );
      })}
      {children}
    </div>
  );
}

export function SectionTitle({ children, action }) {
  return (
    <div className="flex items-center justify-between gap-2 mb-2.5 min-h-6">
      <h4 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-fg-dim">{children}</h4>
      {action}
    </div>
  );
}

export function Toggle({ checked, onChange, label, size = 'md', className }) {
  const s = size === 'sm' ? { track: 'w-7 h-4', knob: 'size-3', on: 'translate-x-3' } : { track: 'w-9 h-5', knob: 'size-4', on: 'translate-x-4' };
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className={cn(
        'relative inline-flex shrink-0 items-center rounded-full p-0.5 transition-colors duration-200',
        s.track,
        checked ? 'accent-gradient' : 'bg-white/10',
        className,
      )}
    >
      <span className={cn('rounded-full bg-white shadow transition-transform duration-200', s.knob, checked && s.on)} />
    </button>
  );
}

export function ToggleRow({ label, hint, checked, onChange }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[11px] font-medium text-fg-muted">{label}</div>
        {hint && <div className="text-[10px] text-fg-dim">{hint}</div>}
      </div>
      <Toggle checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

export function Select({ value, onChange, options, groups, className, label }) {
  return (
    <div className={cn('relative min-w-0', className)}>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none rounded-md bg-ink-950/70 border border-white/[0.08] pl-2 pr-7 py-1.5 text-xs text-fg outline-none transition-colors hover:border-white/15 focus:border-accent/60"
      >
        {options?.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
        {groups?.map((g) => (
          <optgroup key={g.label} label={g.label}>
            {g.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <ChevronDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-fg-dim" />
    </div>
  );
}

const decimalsFor = (step) => (step < 0.01 ? 3 : step < 0.1 ? 2 : step < 1 ? 1 : 0);

export function NumberField({ value, onChange, min = -Infinity, max = Infinity, step = 1, decimals, className, disabled, label }) {
  const d = decimals ?? decimalsFor(step);
  const [draft, setDraft] = useState(null);
  const shown = draft ?? (Number.isFinite(value) ? (+value.toFixed(d)).toString() : '');
  const commit = () => {
    if (draft == null) return;
    const n = parseFloat(draft);
    if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
    setDraft(null);
  };
  return (
    <input
      aria-label={label}
      inputMode="decimal"
      disabled={disabled}
      value={shown}
      onFocus={(e) => e.target.select()}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          setDraft(null);
          e.currentTarget.blur();
        }
      }}
      className={cn(
        'num-input w-12 rounded bg-transparent px-1 text-right font-mono text-[11px] text-fg outline-none transition-colors hover:bg-white/5 focus:bg-ink-950 focus:ring-1 focus:ring-accent/60 disabled:opacity-40',
        className,
      )}
    />
  );
}

export function Slider({ label, value, min, max, step = 1, onChange, unit, defaultValue, track, disabled, decimals }) {
  const pct = ((value - min) / (max - min)) * 100;
  const hasCenter = defaultValue != null && defaultValue > min && defaultValue < max;
  let trackBg;
  if (track) {
    trackBg = track;
  } else if (hasCenter) {
    const c = ((defaultValue - min) / (max - min)) * 100;
    const lo = Math.min(c, pct);
    const hi = Math.max(c, pct);
    trackBg = `linear-gradient(90deg, rgb(255 255 255 / 0.09) 0 ${lo}%, var(--color-accent) ${lo}% ${hi}%, rgb(255 255 255 / 0.09) ${hi}% 100%)`;
  }
  const changed = defaultValue != null && value !== defaultValue;
  return (
    <div className={cn('group', disabled && 'opacity-40 pointer-events-none')}>
      <div className="flex items-center justify-between gap-2">
        <label className={cn('text-[11px] font-medium transition-colors', changed ? 'text-fg' : 'text-fg-muted')}>{label}</label>
        <div className="flex items-center gap-0.5">
          {changed && (
            <button
              type="button"
              onClick={() => onChange(defaultValue)}
              title="Reset"
              aria-label={`Reset ${label}`}
              className="p-0.5 text-fg-dim opacity-0 transition-opacity hover:text-fg group-hover:opacity-100 focus:opacity-100"
            >
              <RotateCcw size={10} />
            </button>
          )}
          <NumberField value={value} onChange={onChange} min={min} max={max} step={step} decimals={decimals} label={label} />
          {unit && <span className="text-[10px] text-fg-dim w-4">{unit}</span>}
        </div>
      </div>
      <input
        type="range"
        className="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        onDoubleClick={() => defaultValue != null && onChange(defaultValue)}
        style={{ '--fill': `${pct}%`, ...(trackBg && { '--track': trackBg }) }}
      />
    </div>
  );
}

export function ParamControl({ spec, value, onChange }) {
  if (spec.type === 'range') {
    return (
      <Slider
        label={spec.label}
        value={value ?? spec.default}
        min={spec.min}
        max={spec.max}
        step={spec.step}
        unit={spec.unit}
        defaultValue={spec.default}
        onChange={onChange}
      />
    );
  }
  if (spec.type === 'select') {
    return (
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-medium text-fg-muted">{spec.label}</span>
        <Select value={value ?? spec.default} onChange={onChange} options={spec.options} className="w-40" label={spec.label} />
      </div>
    );
  }
  if (spec.type === 'toggle') {
    return <ToggleRow label={spec.label} checked={!!(value ?? spec.default)} onChange={onChange} />;
  }
  if (spec.type === 'seed') {
    return (
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-medium text-fg-muted">
          {spec.label} <span className="ml-1 font-mono text-fg">{value ?? spec.default}</span>
        </span>
        <Button size="sm" icon={Dices} onClick={() => onChange(Math.floor(Math.random() * 9999))}>
          Shuffle
        </Button>
      </div>
    );
  }
  return null;
}

export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center animate-fade-in">
      {Icon && (
        <div className="mb-1 grid size-11 place-items-center rounded-xl bg-white/[0.04] border border-white/[0.06] text-fg-muted">
          <Icon size={20} />
        </div>
      )}
      <div className="text-sm font-medium text-fg">{title}</div>
      {children && <div className="max-w-64 text-xs leading-relaxed text-fg-dim">{children}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** Closes a popover when a pointer goes down outside `ref`. */
export function useDismiss(open, onClose) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);
  return ref;
}
