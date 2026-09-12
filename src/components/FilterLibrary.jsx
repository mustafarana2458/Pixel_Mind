import { useMemo, useState } from 'react';
import { ChevronDown, Plus, Replace, Search, X } from 'lucide-react';
import { useStudio } from '../store/studio.js';
import { CATEGORIES, FILTERS } from '../lib/filters.js';
import { Segmented, cn } from './ui.jsx';

export default function FilterLibrary() {
  const thumbs = useStudio((s) => s.thumbs);
  const libraryMode = useStudio((s) => s.libraryMode);
  const selectedFilterId = useStudio((s) => s.steps.find((st) => st.uid === s.selectedStepId)?.filterId);
  const hasSelection = useStudio((s) => s.steps.some((st) => st.uid === s.selectedStepId));
  const set = useStudio((s) => s.set);
  const applyFromLibrary = useStudio((s) => s.applyFromLibrary);
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState({});

  const byCategory = useMemo(() => {
    const q = query.trim().toLowerCase();
    const visible = FILTERS.filter((f) => !f.hidden && (!q || f.name.toLowerCase().includes(q) || f.category.toLowerCase().includes(q)));
    return CATEGORIES.map((c) => ({ category: c, items: visible.filter((f) => f.category === c) })).filter((g) => g.items.length);
  }, [query]);

  let order = 0;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-2 border-b border-white/5 p-3">
        <div className="flex items-center gap-2 rounded-lg border border-white/[0.07] bg-ink-950/60 px-2.5 focus-within:border-accent/60 transition-colors">
          <Search size={13} className="text-fg-dim" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search 23 filters…"
            className="min-w-0 flex-1 bg-transparent py-1.5 text-xs outline-none placeholder:text-fg-dim"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="text-fg-dim hover:text-fg">
              <X size={12} />
            </button>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] uppercase tracking-[0.12em] text-fg-dim">On click</span>
          <Segmented
            size="sm"
            value={libraryMode}
            onChange={(v) => set({ libraryMode: v })}
            options={[
              { value: 'add', label: 'Add step', icon: Plus },
              { value: 'replace', label: 'Replace', icon: Replace, title: 'Replace the selected pipeline step' },
            ]}
          />
        </div>
      </div>

      <div className="thin-scroll flex-1 min-h-0 space-y-4 overflow-y-auto p-3">
        {byCategory.length === 0 && <div className="py-8 text-center text-xs text-fg-dim">No filters match “{query}”.</div>}
        {byCategory.map(({ category, items }) => (
          <section key={category}>
            <button
              type="button"
              onClick={() => setCollapsed((c) => ({ ...c, [category]: !c[category] }))}
              className="mb-2 flex w-full items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-fg-dim hover:text-fg-muted"
            >
              <ChevronDown size={12} className={cn('transition-transform', collapsed[category] && '-rotate-90')} />
              {category}
              <span className="ml-auto font-mono font-normal normal-case tracking-normal">{items.length}</span>
            </button>
            {!collapsed[category] && (
              <div className="grid grid-cols-2 gap-2">
                {items.map((f) => {
                  const active = f.id === selectedFilterId;
                  const delay = order++ * 18;
                  const ActionIcon = libraryMode === 'replace' && hasSelection ? Replace : Plus;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      title={f.description}
                      onClick={() => applyFromLibrary(f.id)}
                      style={{ animationDelay: `${delay}ms` }}
                      className={cn(
                        'group relative overflow-hidden rounded-lg border text-left transition-all duration-200 animate-rise hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/40',
                        active ? 'border-accent/60 bg-accent/10' : 'border-white/[0.06] bg-ink-800/60 hover:border-accent/40',
                      )}
                    >
                      <div className="aspect-[4/3] overflow-hidden bg-ink-850">
                        {thumbs[f.id] ? (
                          <img
                            src={thumbs[f.id]}
                            alt=""
                            draggable={false}
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110 animate-fade-in"
                          />
                        ) : (
                          <div className="skeleton h-full w-full" />
                        )}
                      </div>
                      <div className="flex items-center gap-1 px-2 py-1.5">
                        {active && <span className="size-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />}
                        <span className="truncate text-[11px] font-medium text-fg">{f.name}</span>
                      </div>
                      <span className="absolute right-1.5 top-1.5 grid size-5 place-items-center rounded-md bg-ink-900/85 text-fg opacity-0 transition-opacity group-hover:opacity-100">
                        <ActionIcon size={11} />
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
