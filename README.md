<div align="center">

# 🧠 PixelMind

**A professional, browser-based image processing studio.**

Apply filters, build processing pipelines, design custom convolution kernels, and see exactly how every pixel is calculated — all in real time, with no backend.

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38BDF8?logo=tailwindcss&logoColor=white)
![Web Workers](https://img.shields.io/badge/Web_Workers-enabled-6B7BFF)
![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)

</div>

---

## 📖 Table of Contents

- [About](#-about)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Getting Started](#-getting-started)
- [Usage](#-usage)
- [Folder Structure](#-folder-structure)
- [How It Works](#-how-it-works)
- [Screenshots](#-screenshots)
- [License](#-license)

---

## 💡 About

PixelMind is an image processing studio that runs entirely in the browser. It pairs a polished dark interface with a real-time processing engine built on the Canvas API and Web Workers, so heavy filters never freeze the UI.

It works as a practical photo tool and as a learning environment: the **Convolution Visualizer** animates the kernel × pixel math step by step, and the **Kernel Lab** lets you design and test your own kernels live.

---

## ✨ Features

### 🖼️ Canvas & Viewing
- **Before/after comparison slider** plus single *Result*, *Original*, and *Grid* views
- **Zoom & pan** with mouse wheel, trackpad, pinch gestures, or drag
- **Fullscreen preview** and keyboard shortcuts
- **Drag & drop**, click-to-upload, or **paste** an image from the clipboard
- A default image loads automatically on startup

### 🎛️ Filter Library — 23 filters
| Category | Filters |
| --- | --- |
| **Basic** | Identity |
| **Blur** | Box Blur, Gaussian Blur, Motion Blur |
| **Sharpen & Detail** | Sharpen, Unsharp Mask, Emboss, Edge Enhance |
| **Edge Detection** | Sobel X, Sobel Y, Sobel Magnitude, Laplacian, Prewitt, Scharr, Roberts Cross |
| **Color** | Invert, Grayscale, Sepia, Threshold, Posterize |
| **Stylize** | Pixelate, Vignette, Noise |

Every filter shows a live thumbnail of the current image.

### 🔗 Filter Pipeline
- Chain multiple filters into a processing pipeline
- **Drag & drop** to reorder steps
- Toggle, duplicate, or remove any step
- Fine-tune each step's parameters individually

### 🧪 Custom Kernel Lab
- Editable **3×3, 5×5, and 7×7** kernel grids
- **Divisor**, **bias**, and **strength** controls
- **Normalize** toggle
- **Live preview** on the canvas
- 10 built-in presets; save your own presets to the browser and import/export them as JSON

### 🎨 Color Adjustments
Brightness · Contrast · Saturation · Exposure · Highlights · Shadows · Temperature · Tint · Gamma

### 🔍 Analysis Tools
- **Pixel Inspector** — hover to see original vs. processed RGB, hex, luminance, X/Y position, and a 10×10 magnified pixel grid
- **Histogram** — RGB + luminance with linear/log scale and mean, median, standard deviation, and clipping stats; updates live
- **Convolution Visualizer** — click any pixel to watch the kernel × image patch calculation play out step by step, with animated highlights
- **Multi-Filter Comparison Grid** — render 4 filters side by side on the same image, in parallel

### 💾 Export
- Download as **PNG**, **JPG**, or **WebP**
- Adjustable quality for lossy formats
- Export at **full resolution** (up to 4096 px) or preview size

### ⚡ Performance & UX
- All heavy processing runs in a **pool of Web Workers**, so the UI stays responsive
- Stale requests are skipped during slider drags, so updates never pile up
- **Mobile responsive** layout with slide-out panels
- Smooth animations and a professional dark glass theme

---

## 🛠️ Tech Stack

| Technology | Purpose |
| --- | --- |
| [React 18](https://react.dev/) | UI framework |
| [Vite 6](https://vitejs.dev/) | Dev server and build tool |
| [Tailwind CSS 4](https://tailwindcss.com/) | Styling |
| [Canvas API](https://developer.mozilla.org/docs/Web/API/Canvas_API) | Image decoding, rendering, and export |
| [Web Workers](https://developer.mozilla.org/docs/Web/API/Web_Workers_API) | Off-main-thread pixel processing |
| [Recharts](https://recharts.org/) | Histogram chart |
| [Zustand](https://zustand-demo.pmnd.rs/) | State management |
| [dnd-kit](https://dndkit.com/) | Drag & drop pipeline reordering |
| [Lucide](https://lucide.dev/) | Icons |

No backend is required — everything runs client-side.

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) **18 or newer**
- npm (bundled with Node.js)

### Installation

```bash
# 1. Clone the repository
git clone <your-repo-url> pixelmind
cd pixelmind

# 2. Install dependencies
npm install

# 3. Start the development server
npm run dev
```

Then open **http://localhost:5173** in your browser.

### Available Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server with hot reload |
| `npm run build` | Create an optimized production build in `dist/` |
| `npm run preview` | Serve the production build locally |

---

## 🎮 Usage

1. **Load an image**: the default image loads automatically. Use **Open**, drag & drop, or paste to use your own.
2. **Add filters** from the **Library** tab; each click adds a step to the pipeline.
3. **Reorder or toggle steps** in the **Pipeline** tab.
4. **Tune parameters** in the **Params** tab, and color in the **Adjust** tab.
5. **Compare** results with the split slider or the 4-up **Grid** view.
6. **Inspect** pixels by hovering; **click** a pixel to explore its convolution math.
7. **Export** the final image as PNG, JPG, or WebP.

### ⌨️ Keyboard Shortcuts (canvas focused)

| Key | Action |
| --- | --- |
| `+` / `-` | Zoom in / out |
| `0` | Fit to view |
| `1` | Actual pixels (100%) |
| `F` | Toggle fullscreen |
| `←` / `→` | Move the comparison slider (when the handle is focused) |
| Double-click | Fit to view |

---

## 📁 Folder Structure

```
pixelmind/
├── public/
│   ├── favicon.svg              # App icon
│   └── map-background.png       # Default image loaded on startup
├── src/
│   ├── components/
│   │   ├── AdjustmentsPanel.jsx    # Color adjustment sliders
│   │   ├── BottomPanel.jsx         # Histogram / inspector / visualizer panel
│   │   ├── CanvasStage.jsx         # Canvas, zoom/pan, compare slider, fullscreen
│   │   ├── CompareGrid.jsx         # 4-up multi-filter comparison
│   │   ├── ConvolutionVisualizer.jsx # Step-by-step kernel math animation
│   │   ├── ExportMenu.jsx          # PNG / JPG / WebP export
│   │   ├── FilterLibrary.jsx       # Searchable filter catalog with thumbnails
│   │   ├── Header.jsx              # Top bar and branding
│   │   ├── Histogram.jsx           # RGB + luminance histogram (Recharts)
│   │   ├── KernelEditor.jsx        # Editable kernel grid
│   │   ├── KernelLab.jsx           # Custom kernel lab and presets
│   │   ├── Pipeline.jsx            # Drag & drop processing chain
│   │   ├── PixelInspector.jsx      # Hover pixel info and magnifier
│   │   ├── StepParams.jsx          # Per-step parameter controls
│   │   └── ui.jsx                  # Shared UI primitives
│   ├── lib/
│   │   ├── adjust.js               # Color adjustment math
│   │   ├── blur.js                 # Fast planar box / Gaussian blurs
│   │   ├── filters.js              # Filter registry, convolution, kernels
│   │   ├── histogram.js            # Histogram computation and stats
│   │   ├── imageIO.js              # Image decoding, resizing, downloads
│   │   ├── presets.js              # Kernel presets and storage
│   │   └── workerPool.js           # Web Worker pool
│   ├── store/
│   │   ├── engine.js               # Image loading, processing, export
│   │   └── studio.js               # Zustand app state
│   ├── workers/
│   │   └── processor.worker.js     # Off-thread pixel processing
│   ├── App.jsx                     # Root layout
│   ├── index.css                   # Tailwind theme and global styles
│   └── main.jsx                    # Entry point
├── index.html
├── package.json
├── vite.config.js
└── README.md
```

---

## ⚙️ How It Works

```
 UI (React + Zustand)
        │  pipeline steps + adjustments
        ▼
 Worker Pool ──► processor.worker.js ──► filters.js / blur.js / adjust.js
        │                                         │
        └──────────── processed pixels + histogram ◄┘
        ▼
 Canvas (preview, inspector, histogram)
```

- **Preview-first editing**: edits run on a preview copy (longest side 1200 px) for speed. Exports re-render at full resolution, with pixel-based settings such as blur radius scaled to match.
- **Upload once, reuse**: the image is sent to each worker once, so jobs don't copy pixel data back and forth.
- **Cached pipeline**: the worker caches the last filtered result, so dragging a color slider skips re-running the filters.
- **Latest request wins**: while a job runs, newer requests replace older queued ones, so rapid slider moves never build a backlog.

---

<!--
### Main Studio
![Main studio view](docs/screenshots/studio.png)

### Before / After Comparison
![Comparison slider](docs/screenshots/compare.png)

### Custom Kernel Lab
![Kernel Lab](docs/screenshots/kernel-lab.png)

### Convolution Visualizer
![Convolution Visualizer](docs/screenshots/convolution.png)

### Multi-Filter Grid
![Comparison grid](docs/screenshots/grid.png)

### Mobile
![Mobile layout](docs/screenshots/mobile.png)
-->

---

## 📄 License

This project is licensed under the **MIT License**.

```
MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

<div align="center">

Made with ❤️ using React, Vite, and the Canvas API

</div>
