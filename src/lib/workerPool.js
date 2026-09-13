import ProcessorWorker from '../workers/processor.worker.js?worker';

/**
 * A small fixed pool of processing workers.
 *  - worker 0 renders the main preview (it keeps a filter cache)
 *  - the remaining workers serve the comparison grid, thumbnails and exports
 */
class WorkerPool {
  constructor() {
    const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;
    this.size = Math.min(4, Math.max(2, cores - 1));
    this.jobs = new Map();
    this.nextId = 1;
    this.workers = Array.from({ length: this.size }, () => {
      const w = new ProcessorWorker();
      w.onmessage = (e) => this.handle(e.data);
      w.onerror = (e) => console.error('[PixelMind worker]', e.message || e);
      return w;
    });
  }

  handle(data) {
    const job = this.jobs.get(data.id);
    if (!job) return;
    this.jobs.delete(data.id);
    if (data.ok) job.resolve(data);
    else job.reject(new Error(data.error));
  }

  post(index, msg, transfer = []) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.jobs.set(id, { resolve, reject });
      this.workers[index % this.size].postMessage({ ...msg, id }, transfer);
    });
  }

  /** Uploads a copy of the image to every worker under `key`, tagged with the source version it belongs to. */
  setSource(key, imageData, version) {
    return Promise.all(
      this.workers.map((_, i) => {
        const copy = new Uint8ClampedArray(imageData.data);
        return this.post(i, { type: 'source', key, version, width: imageData.width, height: imageData.height, buffer: copy.buffer }, [copy.buffer]);
      }),
    );
  }

  get auxIndex() {
    return this.size - 1;
  }
}

export const pool = new WorkerPool();

/**
 * Latest-wins request channel pinned to one worker. While a job runs, newer
 * requests replace any queued one; superseded requests resolve with `null`.
 * This keeps slider drags responsive without building a backlog.
 */
export function createLatestChannel(workerIndex) {
  let busy = false;
  let pending = null;

  async function pump() {
    if (busy || !pending) return;
    const { msg, transfer, resolve } = pending;
    pending = null;
    busy = true;
    try {
      resolve(await pool.post(workerIndex, msg, transfer));
    } catch (err) {
      console.error('[PixelMind]', err);
      resolve(null);
    } finally {
      busy = false;
      pump();
    }
  }

  return (msg, transfer = []) =>
    new Promise((resolve) => {
      if (pending) pending.resolve(null);
      pending = { msg, transfer, resolve };
      pump();
    });
}
