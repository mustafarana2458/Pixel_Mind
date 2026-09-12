import { useRef, useState } from 'react';
import { Download, FlaskConical, Plus, Save, Trash2, Upload } from 'lucide-react';
import { useStudio } from '../store/studio.js';
import { BUILTIN_PRESETS, isValidPreset, loadUserPresets, sanitizePreset, saveUserPresets } from '../lib/presets.js';
import { downloadBlob } from '../lib/imageIO.js';
import { Button, IconButton, SectionTitle, Toggle, cn } from './ui.jsx';
import KernelEditor from './KernelEditor.jsx';

export default function KernelLab() {
  const lab = useStudio((s) => s.lab);
  const setLab = useStudio((s) => s.setLab);
  const labToPipeline = useStudio((s) => s.labToPipeline);
  const notify = useStudio((s) => s.notify);
  const [userPresets, setUserPresets] = useState(loadUserPresets);
  const [name, setName] = useState('');
  const importRef = useRef(null);
  const { live, ...kernelValue } = lab;

  const persist = (list) => {
    setUserPresets(list);
    saveUserPresets(list);
  };

  const applyPreset = (p) => setLab({ size: p.size, kernel: [...p.kernel], divisor: p.divisor, bias: p.bias, strength: p.strength, normalize: p.normalize });

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      notify('Give the preset a name first', 'error');
      return;
    }
    const preset = sanitizePreset({ ...kernelValue, name: trimmed });
    persist([...userPresets.filter((p) => p.name !== preset.name), preset]);
    setName('');
    notify(`Saved preset “${preset.name}”`);
  };

  const importFile = async (file) => {
    try {
      const data = JSON.parse(await file.text());
      const list = (Array.isArray(data) ? data : [data]).filter(isValidPreset).map(sanitizePreset);
      if (!list.length) throw new Error('No valid presets in that file');
      const names = new Set(list.map((p) => p.name));
      persist([...userPresets.filter((p) => !names.has(p.name)), ...list]);
      notify(`Imported ${list.length} preset${list.length > 1 ? 's' : ''}`);
    } catch (err) {
      notify(err.message || 'Import failed', 'error');
    }
  };

  return (
    <div className="space-y-6 p-4 animate-fade-in">
      <div>
        <div className="flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <FlaskConical size={15} className="text-accent" /> Custom Kernel Lab
          </h3>
          <label className="flex items-center gap-2 text-[11px] text-fg-muted">
            <span className={cn('size-1.5 rounded-full', live ? 'bg-emerald-400 animate-pulse' : 'bg-white/20')} aria-hidden="true" />
            Live
            <Toggle checked={live} onChange={(v) => setLab({ live: v })} label="Live preview" />
          </label>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-fg-dim">
          Design a convolution kernel. While this tab is open with Live on, it previews as the last step of the chain. Use ↑/↓ in a cell to nudge values.
        </p>
      </div>

      <KernelEditor value={kernelValue} onChange={setLab} />

      <Button variant="primary" icon={Plus} className="h-9 w-full" onClick={labToPipeline}>
        Add kernel to pipeline
      </Button>

      <section>
        <SectionTitle>Built-in presets</SectionTitle>
        <div className="flex flex-wrap gap-1.5">
          {BUILTIN_PRESETS.map((p) => (
            <button
              key={p.name}
              type="button"
              onClick={() => applyPreset(p)}
              className="rounded-md border border-white/[0.07] bg-white/[0.03] px-2 py-1 text-[11px] text-fg-muted transition-colors hover:border-accent/50 hover:text-fg"
            >
              {p.name}
            </button>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle
          action={
            <div className="flex">
              <IconButton size="sm" icon={Upload} label="Import presets (JSON)" onClick={() => importRef.current?.click()} />
              <IconButton
                size="sm"
                icon={Download}
                label="Export presets (JSON)"
                disabled={!userPresets.length}
                onClick={() => downloadBlob(new Blob([JSON.stringify(userPresets, null, 2)], { type: 'application/json' }), 'pixelmind-kernels.json')}
              />
              <input
                ref={importRef}
                type="file"
                accept="application/json,.json"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importFile(f);
                  e.target.value = '';
                }}
              />
            </div>
          }
        >
          My presets
        </SectionTitle>
        <div className="flex gap-1.5">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
            placeholder="Preset name"
            maxLength={40}
            className="min-w-0 flex-1 rounded-md border border-white/[0.08] bg-ink-950/60 px-2 py-1.5 text-xs outline-none placeholder:text-fg-dim focus:border-accent/60"
          />
          <Button size="sm" icon={Save} onClick={save} className="h-auto">
            Save
          </Button>
        </div>
        <div className="mt-2 space-y-1">
          {userPresets.length === 0 && <p className="py-2 text-[11px] text-fg-dim">Saved presets are stored in this browser.</p>}
          {userPresets.map((p) => (
            <div key={p.name} className="group flex items-center gap-2 rounded-md border border-white/5 bg-white/[0.02] pl-2 pr-1 animate-rise">
              <button type="button" onClick={() => applyPreset(p)} className="min-w-0 flex-1 py-1.5 text-left">
                <span className="block truncate text-[11px] text-fg">{p.name}</span>
                <span className="font-mono text-[10px] text-fg-dim">
                  {p.size}×{p.size}
                  {p.normalize ? ' · normalized' : ` · ÷${p.divisor}`}
                  {p.bias ? ` · +${p.bias}` : ''}
                </span>
              </button>
              <IconButton
                size="sm"
                icon={Trash2}
                label={`Delete ${p.name}`}
                className="hover:!text-rose-300"
                onClick={() => persist(userPresets.filter((x) => x.name !== p.name))}
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
