import { RotateCcw } from 'lucide-react';
import { useStudio } from '../store/studio.js';
import { ADJUSTMENT_GROUPS, DEFAULT_ADJUSTMENTS, isNeutral } from '../lib/adjust.js';
import { Button, SectionTitle, Slider } from './ui.jsx';

export default function AdjustmentsPanel() {
  const adjustments = useStudio((s) => s.adjustments);
  const setAdjustment = useStudio((s) => s.setAdjustment);
  const resetAdjustments = useStudio((s) => s.resetAdjustments);

  return (
    <div className="space-y-6 p-4 animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Color adjustments</h3>
          <p className="mt-0.5 text-[11px] leading-relaxed text-fg-dim">Applied after the filter pipeline. Double-click a slider to reset it.</p>
        </div>
        <Button size="sm" icon={RotateCcw} onClick={resetAdjustments} disabled={isNeutral(adjustments)}>
          Reset
        </Button>
      </div>

      {ADJUSTMENT_GROUPS.map((group) => (
        <section key={group.title}>
          <SectionTitle>{group.title}</SectionTitle>
          <div className="space-y-3.5">
            {group.items.map((item) => (
              <Slider
                key={item.key}
                label={item.label}
                value={adjustments[item.key]}
                min={item.min}
                max={item.max}
                step={item.step}
                unit={item.unit}
                track={item.track}
                defaultValue={DEFAULT_ADJUSTMENTS[item.key]}
                onChange={(v) => setAdjustment(item.key, v)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
