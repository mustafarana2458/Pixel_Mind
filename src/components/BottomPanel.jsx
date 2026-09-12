import { BarChart3, ChevronDown, ChevronUp, Grid3x3 } from 'lucide-react';
import { useStudio } from '../store/studio.js';
import { IconButton, PanelTabs, cn } from './ui.jsx';
import Histogram from './Histogram.jsx';
import PixelInspector from './PixelInspector.jsx';
import ConvolutionVisualizer from './ConvolutionVisualizer.jsx';

const TABS = [
  { id: 'analysis', label: 'Histogram & Pixel', icon: BarChart3 },
  { id: 'convolution', label: 'Convolution', icon: Grid3x3 },
];

export default function BottomPanel() {
  const tab = useStudio((s) => s.bottomTab);
  const open = useStudio((s) => s.bottomOpen);
  const set = useStudio((s) => s.set);

  return (
    <section
      className={cn(
        'glass flex shrink-0 flex-col overflow-hidden rounded-2xl transition-[height] duration-300 ease-out',
        !open ? 'lg:h-[45px]' : tab === 'analysis' ? 'lg:h-[270px]' : 'lg:h-[360px]',
      )}
    >
      <PanelTabs tabs={TABS} value={tab} onChange={(id) => set({ bottomTab: id, bottomOpen: true })}>
        <IconButton
          icon={open ? ChevronDown : ChevronUp}
          label={open ? 'Collapse panel' : 'Expand panel'}
          size="sm"
          className="mb-2 ml-auto"
          onClick={() => set({ bottomOpen: !open })}
        />
      </PanelTabs>
      {open && (
        <div key={tab} className="thin-scroll min-h-0 flex-1 overflow-auto p-3 animate-fade-in">
          {tab === 'analysis' ? (
            <div className="flex h-full flex-col gap-3 md:flex-row">
              <div className="h-[210px] min-w-0 flex-1 md:h-auto">
                <Histogram />
              </div>
              <div className="shrink-0 md:w-[360px] md:border-l md:border-white/5 md:pl-3">
                <PixelInspector />
              </div>
            </div>
          ) : (
            <ConvolutionVisualizer />
          )}
        </div>
      )}
    </section>
  );
}
