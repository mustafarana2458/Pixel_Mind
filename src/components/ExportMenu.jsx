import { useCallback, useState } from 'react';
import { Download } from 'lucide-react';
import { useStudio } from '../store/studio.js';
import { EXPORT_FORMATS, exportImage } from '../store/engine.js';
import { Button, Segmented, Slider, Spinner, cn, useDismiss } from './ui.jsx';

export default function ExportMenu() {
  const source = useStudio((s) => s.source);
  const notify = useStudio((s) => s.notify);
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState('png');
  const [quality, setQuality] = useState(0.92);
  const [scope, setScope] = useState('full');
  const [filename, setFilename] = useState('');
  const [busy, setBusy] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = useDismiss(open, close);

  const baseName = source ? `${source.name.replace(/\.[a-z0-9]+$/i, '')}-pixelmind` : 'pixelmind';
  const fmt = EXPORT_FORMATS[format];

  const run = async () => {
    setBusy(true);
    try {
      const res = await exportImage({ format, quality, scope, filename: filename || baseName });
      notify(`Exported ${res.width}×${res.height} ${fmt.label}`);
      setOpen(false);
    } catch (err) {
      notify(err.message || 'Export failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={ref} className="relative">
      <Button variant="primary" icon={Download} onClick={() => setOpen((o) => !o)} disabled={!source} aria-expanded={open}>
        <span className="hidden sm:inline">Export</span>
      </Button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-[min(18rem,calc(100vw-1rem))] rounded-xl glass-strong p-4 space-y-4 animate-rise">
          <div>
            <div className="text-sm font-semibold">Export image</div>
            <div className="text-[11px] text-fg-dim">Renders the full pipeline and adjustments in a background worker.</div>
          </div>

          <div className="space-y-1.5">
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-fg-dim">Format</div>
            <Segmented
              stretch
              value={format}
              onChange={setFormat}
              options={Object.entries(EXPORT_FORMATS).map(([value, f]) => ({ value, label: f.label }))}
            />
          </div>

          <div className={cn('transition-opacity', !fmt.lossy && 'opacity-40 pointer-events-none')}>
            <Slider label="Quality" value={Math.round(quality * 100)} min={10} max={100} step={1} unit="%" onChange={(v) => setQuality(v / 100)} />
          </div>

          <div className="space-y-1.5">
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-fg-dim">Resolution</div>
            <Segmented
              stretch
              value={scope}
              onChange={setScope}
              options={[
                { value: 'full', label: source ? `Full ${source.fullWidth}×${source.fullHeight}` : 'Full' },
                { value: 'preview', label: source ? `Preview ${source.width}×${source.height}` : 'Preview' },
              ]}
              size="sm"
            />
          </div>

          <div className="space-y-1.5">
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-fg-dim">File name</div>
            <div className="flex items-center rounded-md border border-white/[0.08] bg-ink-950/70 focus-within:border-accent/60">
              <input
                value={filename}
                placeholder={baseName}
                onChange={(e) => setFilename(e.target.value)}
                className="min-w-0 flex-1 bg-transparent px-2 py-1.5 text-xs outline-none placeholder:text-fg-dim"
              />
              <span className="pr-2 font-mono text-[11px] text-fg-dim">.{fmt.ext}</span>
            </div>
          </div>

          <Button variant="primary" className="w-full h-9" onClick={run} disabled={busy}>
            {busy ? <Spinner className="border-t-white" /> : <Download size={14} />}
            {busy ? 'Rendering…' : `Download ${fmt.label}`}
          </Button>
        </div>
      )}
    </div>
  );
}
