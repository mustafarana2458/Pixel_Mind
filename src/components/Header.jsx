import { ImagePlus, PanelLeft, PanelRight, RotateCcw } from 'lucide-react';
import { useStudio } from '../store/studio.js';
import { loadSample, openFilePicker } from '../store/engine.js';
import { formatBytes } from '../lib/imageIO.js';
import { Button, IconButton } from './ui.jsx';
import ExportMenu from './ExportMenu.jsx';

export function Logo() {
  return (
    <div className="flex items-center gap-2.5 select-none">
      <div className="relative grid size-8 place-items-center rounded-lg accent-gradient shadow-lg shadow-accent/25">
        <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
          {[0, 1, 2].flatMap((r) =>
            [0, 1, 2].map((c) => (
              <rect
                key={`${r}${c}`}
                x={3 + c * 6.5}
                y={3 + r * 6.5}
                width="5"
                height="5"
                rx="1.2"
                fill="white"
                opacity={r === c ? 1 : Math.abs(r - c) === 1 ? 0.6 : 0.3}
              />
            )),
          )}
        </svg>
      </div>
      <div className="leading-none">
        <div className="text-[15px] font-semibold tracking-tight">
          Pixel<span className="text-gradient">Mind</span>
        </div>
        <div className="mt-0.5 hidden text-[10px] uppercase tracking-[0.18em] text-fg-dim sm:block">Image Studio</div>
      </div>
    </div>
  );
}

export default function Header() {
  const source = useStudio((s) => s.source);
  const set = useStudio((s) => s.set);

  return (
    <header className="relative z-30 flex h-14 shrink-0 items-center gap-2 border-b border-white/5 bg-ink-900/70 px-2 backdrop-blur-xl sm:gap-3 sm:px-4">
      <IconButton icon={PanelLeft} label="Tools" className="lg:hidden" onClick={() => set({ drawer: 'left' })} />
      <Logo />

      {source && (
        <div className="ml-3 hidden min-w-0 items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.03] py-1 pl-3 pr-3 text-[11px] text-fg-muted md:flex animate-fade-in">
          <span className="size-1.5 rounded-full bg-emerald-400/80" aria-hidden="true" />
          <span className="max-w-48 truncate text-fg">{source.name}</span>
          <span className="text-fg-dim">·</span>
          <span className="font-mono">
            {source.originalWidth}×{source.originalHeight}
          </span>
          {source.size ? (
            <>
              <span className="text-fg-dim">·</span>
              <span className="font-mono">{formatBytes(source.size)}</span>
            </>
          ) : null}
        </div>
      )}

      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        <Button variant="ghost" icon={ImagePlus} onClick={openFilePicker} title="Open image (or drop / paste one)">
          <span className="hidden sm:inline">Open</span>
        </Button>
        <IconButton icon={RotateCcw} label="Reload sample image" onClick={loadSample} />
        <ExportMenu />
        <IconButton icon={PanelRight} label="Settings" className="lg:hidden" onClick={() => set({ drawer: 'right' })} />
      </div>
    </header>
  );
}
