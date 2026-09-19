/**
 * Render Queue com coalescência automática por animationFrame / microtask.
 * Garante que múltiplos updates no mesmo ciclo resultem em exatamente 1 patch visual.
 */
export class RenderQueue {
  constructor() {
    this._tasks = new Map();
    this._scheduled = false;
  }

  enqueue(key, patchFn) {
    if (typeof patchFn !== "function") return;
    this._tasks.set(String(key), patchFn);

    if (this._scheduled) return;
    this._scheduled = true;

    const scheduler = globalThis.requestAnimationFrame ?? ((cb) => setTimeout(cb, 16));
    scheduler(() => {
      this._flush();
    });
  }

  _flush() {
    this._scheduled = false;
    const batch = [...this._tasks.entries()];
    this._tasks.clear();

    for (const [key, fn] of batch) {
      try {
        fn();
      } catch (err) {
        console.error(`GMS Reputation | Erro ao executar patch na RenderQueue para chave "${key}":`, err);
      }
    }
  }

  cancel(key) {
    this._tasks.delete(String(key));
  }

  clear() {
    this._tasks.clear();
    this._scheduled = false;
  }
}

export const renderQueue = new RenderQueue();
