import { useEffect } from 'react';
import { AlertCircle, CheckCircle2, FlaskConical, Layers, Settings2, SlidersHorizontal, Workflow, X } from 'lucide-react';
import { useStudio } from './store/studio.js';
import { ingestBlob, useProcessingEngine } from './store/engine.js';
import { IconButton, PanelTabs, cn } from './components/ui.jsx';
import Header from './components/Header.jsx';
import FilterLibrary from './components/FilterLibrary.jsx';
import Pipeline from './components/Pipeline.jsx';
import CanvasStage from './components/CanvasStage.jsx';
import BottomPanel from './components/BottomPanel.jsx';
import AdjustmentsPanel from './components/AdjustmentsPanel.jsx';
import StepParams from './components/StepParams.jsx';
import KernelLab from './components/KernelLab.jsx';

function Toast() {
  const toast = useStudio((s) => s.toast);
  if (!toast) return null;
  const error = toast.tone === 'error';
  return (
    <div
      key={toast.id}
      role="status"
      className="fixed bottom-5 left-1/2 z-[90] flex -translate-x-1/2 items-center gap-2 rounded-full glass-strong px-4 py-2 text-xs text-fg animate-rise"
    >
      {error ? <AlertCircle size={14} className="text-rose-300" /> : <CheckCircle2 size={14} className="text-emerald-400" />}
      {toast.message}
    </div>
  );
}

function Sidebar({ side, children }) {
  const drawer = useStudio((s) => s.drawer);
  const set = useStudio((s) => s.set);
  const open = drawer === side;
  return (
    <aside
      className={cn(
        'glass flex min-h-0 shrink-0 flex-col overflow-hidden',
        'max-lg:fixed max-lg:inset-y-0 max-lg:z-50 max-lg:w-[88vw] max-lg:max-w-[360px] max-lg:bg-ink-850/95 max-lg:transition-transform max-lg:duration-300 max-lg:ease-out',
        side === 'left'
          ? cn('max-lg:left-0 lg:w-[264px] xl:w-[292px] lg:rounded-2xl', open ? 'max-lg:translate-x-0' : 'max-lg:-translate-x-full')
          : cn('max-lg:right-0 lg:w-[300px] xl:w-[340px] lg:rounded-2xl', open ? 'max-lg:translate-x-0' : 'max-lg:translate-x-full'),
      )}
    >
      <div className="absolute right-2 top-2 z-10 lg:hidden">
        <IconButton icon={X} label="Close panel" onClick={() => set({ drawer: null })} />
      </div>
      {children}
    </aside>
  );
}

export default function App() {
  useProcessingEngine();
  const leftTab = useStudio((s) => s.leftTab);
  const rightTab = useStudio((s) => s.rightTab);
  const drawer = useStudio((s) => s.drawer);
  const stepCount = useStudio((s) => s.steps.length);
  const set = useStudio((s) => s.set);

  useEffect(() => {
    const onPaste = (e) => {
      const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'));
      const file = item?.getAsFile();
      if (file) ingestBlob(file, file.name || 'pasted-image.png');
    };
    const onKey = (e) => e.key === 'Escape' && useStudio.getState().drawer && set({ drawer: null });
    window.addEventListener('paste', onPaste);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('paste', onPaste);
      window.removeEventListener('keydown', onKey);
    };
  }, [set]);

  return (
    <div className="flex h-dvh flex-col overflow-hidden text-fg">
      <Header />

      <div className="thin-scroll flex min-h-0 flex-1 gap-3 p-2 sm:p-3 max-lg:flex-col max-lg:overflow-y-auto">
        <Sidebar side="left">
          <PanelTabs
            value={leftTab}
            onChange={(id) => set({ leftTab: id })}
            tabs={[
              { id: 'library', label: 'Library', icon: Layers },
              { id: 'pipeline', label: 'Pipeline', icon: Workflow, badge: stepCount },
            ]}
          />
          <div className="min-h-0 flex-1">{leftTab === 'library' ? <FilterLibrary /> : <Pipeline />}</div>
        </Sidebar>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
          <div className="min-h-0 max-lg:h-[62dvh] max-lg:min-h-[360px] max-lg:shrink-0 lg:flex-1">
            <CanvasStage />
          </div>
          <BottomPanel />
        </main>

        <Sidebar side="right">
          <PanelTabs
            value={rightTab}
            onChange={(id) => set({ rightTab: id })}
            tabs={[
              { id: 'adjust', label: 'Adjust', icon: SlidersHorizontal },
              { id: 'params', label: 'Params', icon: Settings2 },
              { id: 'kernel', label: 'Kernel Lab', icon: FlaskConical },
            ]}
          />
          <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">
            {rightTab === 'adjust' && <AdjustmentsPanel />}
            {rightTab === 'params' && <StepParams />}
            {rightTab === 'kernel' && <KernelLab />}
          </div>
        </Sidebar>
      </div>

      {drawer && <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-fade-in lg:hidden" onClick={() => set({ drawer: null })} />}
      <Toast />
    </div>
  );
}
