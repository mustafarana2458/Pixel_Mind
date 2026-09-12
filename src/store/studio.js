import { create } from 'zustand';
import { arrayMove } from '@dnd-kit/sortable';
import { FILTER_MAP, defaultParams } from '../lib/filters.js';
import { DEFAULT_ADJUSTMENTS } from '../lib/adjust.js';
import { resizeKernel } from '../lib/presets.js';

/** Heavy pixel buffers live outside React state; version counters in the store signal changes. */
export const images = { full: null, original: null, processed: null, grid: null, icon: null };

let counter = 0;
const uid = () => `step-${Date.now().toString(36)}-${(counter++).toString(36)}`;
const makeStep = (filterId, params) => ({ uid: uid(), filterId, enabled: true, params: params ?? defaultParams(filterId) });

export const LAB_DEFAULT = { size: 3, kernel: [0, -1, 0, -1, 5, -1, 0, -1, 0], divisor: 1, bias: 0, strength: 1, normalize: true };

const initialSteps = [makeStep('unsharpMask'), makeStep('vignette')];

let toastTimer = 0;

export const useStudio = create((set, get) => ({
  // image
  source: null,
  status: 'loading',
  error: null,
  sourceVersion: 0,

  // processing
  steps: initialSteps,
  selectedStepId: initialSteps[0].uid,
  adjustments: { ...DEFAULT_ADJUSTMENTS },
  lab: { ...LAB_DEFAULT, live: true },
  processedVersion: 0,
  processing: false,
  lastMs: null,
  histogram: null,
  originalHistogram: null,
  thumbs: {},

  // ui
  libraryMode: 'add',
  leftTab: 'library',
  rightTab: 'adjust',
  bottomTab: 'analysis',
  bottomOpen: true,
  viewMode: 'split',
  comparePos: 0.5,
  gridFilters: ['gaussianBlur', 'sobel', 'emboss', 'sepia'],
  gridStack: false,
  drawer: null,
  toast: null,

  // inspection
  hover: null,
  pinned: null,

  set: (patch) => set(patch),

  notify: (message, tone = 'info') => {
    clearTimeout(toastTimer);
    set({ toast: { message, tone, id: Date.now() } });
    toastTimer = setTimeout(() => set({ toast: null }), 2200);
  },

  addStep: (filterId, params) => {
    const step = makeStep(filterId, params);
    set((s) => ({ steps: [...s.steps, step], selectedStepId: step.uid }));
    get().notify(`Added ${FILTER_MAP[filterId]?.name ?? filterId}`);
    return step;
  },

  applyFromLibrary: (filterId) => {
    const { libraryMode, selectedStepId, steps } = get();
    const target = steps.find((s) => s.uid === selectedStepId);
    if (libraryMode === 'replace' && target) {
      set((s) => ({
        steps: s.steps.map((st) => (st.uid === target.uid ? { ...st, filterId, params: defaultParams(filterId), enabled: true } : st)),
      }));
      get().notify(`Replaced step with ${FILTER_MAP[filterId].name}`);
    } else {
      get().addStep(filterId);
    }
  },

  updateStepParams: (id, patch) =>
    set((s) => ({ steps: s.steps.map((st) => (st.uid === id ? { ...st, params: { ...st.params, ...patch } } : st)) })),

  resetStepParams: (id) =>
    set((s) => ({ steps: s.steps.map((st) => (st.uid === id ? { ...st, params: defaultParams(st.filterId) } : st)) })),

  toggleStep: (id) => set((s) => ({ steps: s.steps.map((st) => (st.uid === id ? { ...st, enabled: !st.enabled } : st)) })),

  removeStep: (id) =>
    set((s) => {
      const idx = s.steps.findIndex((st) => st.uid === id);
      const steps = s.steps.filter((st) => st.uid !== id);
      const selectedStepId = s.selectedStepId === id ? (steps[Math.min(idx, steps.length - 1)]?.uid ?? null) : s.selectedStepId;
      return { steps, selectedStepId };
    }),

  duplicateStep: (id) =>
    set((s) => {
      const idx = s.steps.findIndex((st) => st.uid === id);
      if (idx < 0) return {};
      const copy = { ...structuredClone(s.steps[idx]), uid: uid() };
      const steps = [...s.steps];
      steps.splice(idx + 1, 0, copy);
      return { steps, selectedStepId: copy.uid };
    }),

  moveStep: (activeId, overId) =>
    set((s) => {
      const from = s.steps.findIndex((st) => st.uid === activeId);
      const to = s.steps.findIndex((st) => st.uid === overId);
      if (from < 0 || to < 0 || from === to) return {};
      return { steps: arrayMove(s.steps, from, to) };
    }),

  clearSteps: () => set({ steps: [], selectedStepId: null }),

  selectStep: (id) => set({ selectedStepId: id, rightTab: 'params' }),

  setAdjustment: (key, value) => set((s) => ({ adjustments: { ...s.adjustments, [key]: value } })),
  resetAdjustments: () => set({ adjustments: { ...DEFAULT_ADJUSTMENTS } }),

  setLab: (patch) => set((s) => ({ lab: { ...s.lab, ...patch } })),

  setLabSize: (size) => set((s) => ({ lab: { ...s.lab, size, kernel: resizeKernel(s.lab.kernel, s.lab.size, size) } })),

  loadIntoLab: (spec) => {
    let { size, kernel } = spec;
    if (size === 2) {
      kernel = [kernel[0], kernel[1], 0, kernel[2], kernel[3], 0, 0, 0, 0];
      size = 3;
    }
    set((s) => ({
      rightTab: 'kernel',
      lab: {
        ...s.lab,
        size,
        kernel: [...kernel],
        divisor: spec.divisor ?? 1,
        bias: spec.bias ?? 0,
        strength: spec.strength ?? 1,
        normalize: spec.normalize ?? false,
      },
    }));
  },

  labToPipeline: () => {
    const { live, ...params } = get().lab;
    get().addStep('customKernel', structuredClone(params));
  },
}));

/** The steps actually rendered: the pipeline plus the Kernel Lab when it is live-previewing. */
export function effectiveSteps(s) {
  if (s.rightTab === 'kernel' && s.lab.live) {
    const { live, ...params } = s.lab;
    return [...s.steps, { uid: 'kernel-lab', filterId: 'customKernel', enabled: true, params }];
  }
  return s.steps;
}
